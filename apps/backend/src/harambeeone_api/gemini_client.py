import base64
import binascii
import json
import logging

from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError

from harambeeone_api.config import get_settings

MAX_TEXT_INPUT_CHARS = 14_000
MAX_IMAGE_BYTES = 2_000_000
MAX_OUTPUT_TOKENS = 1_200
REQUEST_TIMEOUT_SECONDS = 45.0

logger = logging.getLogger(__name__)


class GeminiUnavailableError(RuntimeError):
    """The optional AI service is unavailable; manual workflows must remain usable."""


class GeminiQuotaError(GeminiUnavailableError):
    """The free Gemini quota is exhausted and must not trigger a paid fallback."""


class GeminiTimeoutError(GeminiUnavailableError):
    """Gemini did not finish within the bounded review window."""


class GeminiResponseError(RuntimeError):
    """Gemini returned content that failed the application-owned contract."""


def request_structured_gemini[T: BaseModel](
    *,
    system_instruction: str,
    text_input: str,
    response_model: type[T],
    image_base64: str | None = None,
    image_mime_type: str | None = None,
) -> tuple[str, T]:
    """Make one stateless, bounded Gemini request and validate its structured output."""
    settings = get_settings()
    if not settings.gemini_api_key:
        raise GeminiUnavailableError("GEMINI_API_KEY is not configured")
    if len(system_instruction) + len(text_input) > MAX_TEXT_INPUT_CHARS:
        raise GeminiResponseError("Gemini request exceeds the text input limit")

    content: list[types.Part] = [types.Part.from_text(text=text_input)]
    if image_base64 and image_mime_type:
        try:
            image_bytes = base64.b64decode(image_base64, validate=True)
        except (ValueError, binascii.Error) as error:
            raise GeminiResponseError("Gemini image input is not valid base64") from error
        if len(image_bytes) > MAX_IMAGE_BYTES:
            raise GeminiResponseError("Gemini image input exceeds the size limit")
        content.append(types.Part.from_bytes(data=image_bytes, mime_type=image_mime_type))

    client = genai.Client(
        api_key=settings.gemini_api_key,
        http_options=types.HttpOptions(
            timeout=int(REQUEST_TIMEOUT_SECONDS * 1_000),
            retry_options=types.HttpRetryOptions(attempts=1),
        ),
    )
    try:
        try:
            response = client.models.generate_content(
                model=settings.gemini_model,
                contents=content,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    response_json_schema=response_model.model_json_schema(),
                    max_output_tokens=MAX_OUTPUT_TOKENS,
                    temperature=0.1,
                    store=False,
                    http_options=types.HttpOptions(
                        timeout=int(REQUEST_TIMEOUT_SECONDS * 1_000)
                    ),
                ),
            )
        except Exception as error:
            status_code = getattr(error, "status_code", None) or getattr(error, "code", None)
            error_type = type(error).__name__
            logger.warning(
                "Gemini provider request failed error_type=%s status=%s",
                error_type,
                status_code,
            )
            if status_code == 429 or error_type == "RateLimitError":
                raise GeminiQuotaError("Gemini free quota is exhausted") from error
            if "Timeout" in error_type or status_code == 504:
                raise GeminiTimeoutError("Gemini review timed out") from error
            raise GeminiUnavailableError("Gemini is temporarily unavailable") from error
        if not response.text:
            logger.warning(
                "Gemini structured response incomplete has_output=%s",
                bool(response.text),
            )
            raise GeminiResponseError("Gemini did not complete with text output")
        try:
            return settings.gemini_model, response_model.model_validate_json(
                response.text
            )
        except (ValidationError, ValueError, TypeError, json.JSONDecodeError) as error:
            validation_errors = (
                [
                    {
                        "location": [str(part) for part in item.get("loc", ())],
                        "type": item.get("type"),
                    }
                    for item in error.errors(include_input=False)
                ]
                if isinstance(error, ValidationError)
                else [{"type": type(error).__name__}]
            )
            logger.warning(
                "Gemini structured response failed validation errors=%s",
                validation_errors,
            )
            raise GeminiResponseError("Gemini returned invalid structured output") from error
    finally:
        client.close()
