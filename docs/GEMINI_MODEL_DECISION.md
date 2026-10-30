# Gemini model decision

Decision date: 2026-10-30 (supersedes the 2026-10-26 runtime selection)
Evaluation set: `docs/evaluations/gemini-assistants-v1.json`

## Decision

Use `gemini-3.1-flash-lite` for the optional guardian, donor, and school-review assistants.
Do not fall back to a paid model when quota is unavailable.

## Comparison

| Candidate | Structured and multimodal fit | Student zero-cost boundary | Decision |
| --- | --- | --- | --- |
| Gemini 3.1 Flash-Lite | Supports structured JSON output and multimodal input with low latency for narrow review tasks | Available on the Gemini Developer API free tier, subject to project quota | Selected after a live schema-valid review completed in 13.8 seconds |
| Gemini 3.8 Flash | Supports the required structured and multimodal features, but repeatedly exceeded both 20- and 45-second review bounds and returned `504 DEADLINE_EXCEEDED` in live synthetic checks | Available on the Gemini Developer API free tier, subject to project quota | Replaced for this latency-sensitive workflow |
| Gemini 4 Argon | Higher-capability model, but unnecessary for these narrow grounded tasks | Not offered on the free tier | Excluded from runtime and live evaluation |

The selection is intentionally based on task fit, privacy controls, latency, and cost rather
than model size. Official references reviewed: [models](https://ai.google.dev/gemini-api/docs/models),
[structured output](https://ai.google.dev/gemini-api/docs/structured-output), and
[pricing](https://ai.google.dev/gemini-api/docs/pricing).

## Enforced evaluation gates

- Synthetic anonymous examples only; no production learner, guardian, or donor content.
- Exact Pydantic-owned schemas with extra fields rejected after model output.
- Identifier, contact-data, injection, cross-user, and authority checks remain application-owned.
- One request per attempt, 45-second timeout, 14,000-character text ceiling, 1,200 output tokens,
  and a 2 MB evidence-image ceiling.
- `store=false`; HarambeeOne persists only model/status/timing metadata, never prompts or answers.
- Quota exhaustion, timeout, unavailable service, malformed output, or unsafe output visibly returns
  the user to the unchanged manual workflow.
- School publication and every financial action remain human-authorized and deterministic.

Automated coverage exercises grounded success, privacy refusal, cross-user isolation, authority
claims, malformed output, timeout, quota exhaustion, and input limits. The versioned JSON file is
also the importable Google AI Studio evaluation fixture for manual model review.
