from types import SimpleNamespace

import httpx
import pytest
from google.genai import errors
from pydantic import BaseModel, ConfigDict

from harambeeone_api import gemini_client


class ExampleResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answer: str


class FakeClient:
    def __init__(self, result=None, error: Exception | None = None):
        self.result = result
        self.error = error
        self.closed = False
        self.calls: list[dict] = []
        self.models = self

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return self.result

    def close(self):
        self.closed = True


def configure(monkeypatch, client: FakeClient) -> None:
    monkeypatch.setattr(
        gemini_client,
        "get_settings",
        lambda: SimpleNamespace(
            gemini_api_key="test-key", gemini_model="gemini-3.1-flash-lite"
        ),
    )
    monkeypatch.setattr(gemini_client.genai, "Client", lambda **_kwargs: client)


def test_structured_gemini_is_stateless_bounded_and_validated(monkeypatch) -> None:
    client = FakeClient(
        SimpleNamespace(text='{"answer":"Grounded answer"}')
    )
    configure(monkeypatch, client)

    model, result = gemini_client.request_structured_gemini(
        system_instruction="Use only supplied facts.",
        text_input="GROUNDING_FACTS={}",
        response_model=ExampleResult,
    )

    assert model == "gemini-3.1-flash-lite"
    assert result.answer == "Grounded answer"
    assert client.closed is True
    request = client.calls[0]
    config = request["config"]
    assert config.store is False
    assert config.http_options.timeout == 45_000
    assert config.max_output_tokens == 1_200
    assert config.response_json_schema["additionalProperties"] is False


def test_structured_gemini_rejects_malformed_output(monkeypatch) -> None:
    client = FakeClient(SimpleNamespace(text="not json"))
    configure(monkeypatch, client)

    with pytest.raises(gemini_client.GeminiResponseError):
        gemini_client.request_structured_gemini(
            system_instruction="Safe.", text_input="Facts.", response_model=ExampleResult
        )
    assert client.closed is True


def test_structured_gemini_rejects_incomplete_output(monkeypatch) -> None:
    client = FakeClient(
        SimpleNamespace(text="")
    )
    configure(monkeypatch, client)

    with pytest.raises(
        gemini_client.GeminiResponseError,
        match="did not complete",
    ):
        gemini_client.request_structured_gemini(
            system_instruction="Safe.", text_input="Facts.", response_model=ExampleResult
        )
    assert len(client.calls) == 1
    assert client.closed is True


def test_structured_gemini_exposes_free_quota_fallback_without_retry(monkeypatch) -> None:
    quota_error = errors.ClientError(429, {"error": {"message": "quota exhausted"}})
    client = FakeClient(error=quota_error)
    configure(monkeypatch, client)

    with pytest.raises(gemini_client.GeminiQuotaError):
        gemini_client.request_structured_gemini(
            system_instruction="Safe.", text_input="Facts.", response_model=ExampleResult
        )
    assert len(client.calls) == 1
    assert client.closed is True


def test_structured_gemini_exposes_timeout_as_manual_fallback(monkeypatch) -> None:
    client = FakeClient(error=httpx.ReadTimeout("timed out"))
    configure(monkeypatch, client)

    with pytest.raises(gemini_client.GeminiTimeoutError):
        gemini_client.request_structured_gemini(
            system_instruction="Safe.", text_input="Facts.", response_model=ExampleResult
        )
    assert client.closed is True


def test_structured_gemini_maps_provider_deadline_to_timeout(monkeypatch) -> None:
    deadline_error = errors.ServerError(
        504, {"error": {"message": "deadline", "status": "DEADLINE_EXCEEDED"}}
    )
    client = FakeClient(error=deadline_error)
    configure(monkeypatch, client)

    with pytest.raises(gemini_client.GeminiTimeoutError):
        gemini_client.request_structured_gemini(
            system_instruction="Safe.", text_input="Facts.", response_model=ExampleResult
        )
    assert len(client.calls) == 1
    assert client.closed is True


def test_structured_gemini_rejects_oversized_input_before_network(monkeypatch) -> None:
    client = FakeClient()
    configure(monkeypatch, client)

    with pytest.raises(gemini_client.GeminiResponseError):
        gemini_client.request_structured_gemini(
            system_instruction="Safe.",
            text_input="x" * gemini_client.MAX_TEXT_INPUT_CHARS,
            response_model=ExampleResult,
        )
    assert client.calls == []
