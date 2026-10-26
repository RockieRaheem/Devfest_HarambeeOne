"""Run one synthetic, non-retained Gemini structured-output smoke request."""

from pydantic import BaseModel, ConfigDict

from harambeeone_api.gemini_client import GeminiUnavailableError, request_structured_gemini


class SmokeResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answer: str


def main() -> None:
    try:
        model, result = request_structured_gemini(
            system_instruction=(
                "Return a brief grounded answer using only the supplied synthetic fact."
            ),
            text_input=(
                "Synthetic fact: the campaign status is pending. Question: what is its status?"
            ),
            response_model=SmokeResult,
        )
    except GeminiUnavailableError as error:
        raise SystemExit(f"Live Gemini smoke: SAFE FALLBACK ({error})") from error
    print("Live Gemini smoke: PASS")
    print(f"Model: {model}")
    print(f"Valid structured output: {bool(result.answer)}")


if __name__ == "__main__":
    main()
