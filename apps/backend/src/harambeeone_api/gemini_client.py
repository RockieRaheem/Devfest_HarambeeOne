import json

from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError

from harambeeone_api.config import get_settings

MAX_TEXT_INPUT_CHARS = 14_000
MAX_IMAGE_BYTES = 2_000_000
MAX_OUTPUT_TOKENS = 700
REQUEST_TIMEOUT_SECONDS = 20.0

class GeminiUnavailableError(RuntimeError):
    """The optional AI service is unavailable; manual workflows must remain usable."""


class GeminiQuotaError(GeminiUnavailableError):
    """The free Gemini quota is exhausted and must not trigger a paid fallback."""


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

    content: list[dict[str, str]] = [{"type": "text", "text": text_input}]
    if image_base64 and image_mime_type:
        content.append(
            {
                "type": "image",
                "data": image_base64,
                "mime_type": image_mime_type,
            }
        )

    client = genai.Client(
        api_key=settings.gemini_api_key,
        http_options=types.HttpOptions(
            timeout=int(REQUEST_TIMEOUT_SECONDS * 1_000),
            retry_options=types.HttpRetryOptions(attempts=1),
        ),
    )
    interactions = client.interactions
    # google-genai 2.33 coerces zero retry attempts to one. The generated
    # Interactions client exposes the translated retry policy, so override it
    # after construction to preserve the product's one-request free-tier bound.
    interactions.sdk_configuration.retry_config.max_retries = 0
    interactions.sdk_configuration.retry_config.retry_connection_errors = False
    try:
        try:
            interaction = interactions.create(
                model=settings.gemini_model,
                input=content,
                system_instruction=system_instruction,
                response_format={
                    "type": "text",
                    "mime_type": "application/json",
                    "schema": response_model.model_json_schema(),
                },
                generation_config={
                    "max_output_tokens": MAX_OUTPUT_TOKENS,
                    "temperature": 0.1,
                },
                store=False,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
        except Exception as error:
            status_code = getattr(error, "status_code", None) or getattr(
                error, "code", None
            )
            if status_code == 429 or type(error).__name__ == "RateLimitError":
                raise GeminiQuotaError("Gemini free quota is exhausted") from error
            raise GeminiUnavailableError("Gemini is temporarily unavailable") from error
        if interaction.status != "completed" or not interaction.output_text:
            raise GeminiResponseError("Gemini interaction did not complete with text output")
        try:
            return settings.gemini_model, response_model.model_validate_json(
                interaction.output_text
            )
        except (ValidationError, ValueError, TypeError, json.JSONDecodeError) as error:
            raise GeminiResponseError("Gemini returned invalid structured output") from error
    finally:
        client.close()
