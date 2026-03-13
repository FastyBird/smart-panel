# Task: Add service-level timeout enforcement for STT/TTS/LLM providers

ID: TECH-BUDDY-PROVIDER-TIMEOUT-ENFORCEMENT
Type: technical
Scope: backend
Size: small
Parent: EPIC-BUDDY-HARDENING
Status: planned

## 1. Business goal

In order to prevent the buddy system from hanging indefinitely when a provider is slow or unresponsive,
As a home operator,
I want all AI provider calls (LLM, STT, TTS) to have enforced timeouts at the service layer.

## 2. Context

- `SttProviderService`, `TtsProviderService`, and `LlmProviderService` delegate to registered provider plugins.
- Currently, timeout enforcement relies on individual providers implementing timeouts correctly.
- If a provider plugin doesn't implement timeout (or has a bug), the service call can hang indefinitely.
- The `LlmProviderService` passes a timeout option to providers but doesn't enforce it.
- The STT and TTS services have no timeout parameter at all.
- Error detection currently uses fragile string matching on error messages/names (e.g., checking for "timeout", "ETIMEDOUT", "AbortError").

### Current timeout gaps

| Service | Timeout passed? | Enforced at service level? | Risk |
|---------|----------------|---------------------------|------|
| `LlmProviderService` | Yes (via options) | No | Provider can ignore it |
| `SttProviderService` | No | No | Infinite hang possible |
| `TtsProviderService` | No | No | Infinite hang possible |

## 3. Scope

**In scope**

- Add `Promise.race` timeout wrappers in `SttProviderService.transcribe()`, `TtsProviderService.synthesize()`, and `LlmProviderService.sendMessage()`
- Make timeouts configurable via buddy config (with sensible defaults)
- Improve timeout error detection (use consistent exception types instead of string matching)
- Add unit tests for timeout enforcement

**Out of scope**

- Per-provider timeout configuration
- Circuit breaker pattern (future enhancement)
- Streaming provider support (would need different timeout approach)

## 4. Acceptance criteria

- [ ] `SttProviderService.transcribe()` enforces a configurable timeout (default: 30s)
- [ ] `TtsProviderService.synthesize()` enforces a configurable timeout (default: 15s)
- [ ] `LlmProviderService.sendMessage()` enforces a configurable timeout (default: 60s)
- [ ] Timeout values are configurable via `BuddyConfigModel` (fields: `sttTimeoutMs`, `ttsTimeoutMs`, `llmTimeoutMs`)
- [ ] When timeout fires, the service throws `BuddyProviderTimeoutException` consistently
- [ ] Timeout detection no longer relies on string matching — the service wrapper guarantees the exception type
- [ ] Unit tests verify: timeout fires correctly, normal calls complete within timeout, exception type is correct
- [ ] Existing error handling for non-timeout provider errors is preserved

## 5. Example scenarios

### Scenario: STT provider hangs

Given a Whisper local provider takes 45 seconds to process audio
And the STT timeout is configured at 30 seconds
When the user sends an audio message
Then `BuddyProviderTimeoutException` is thrown after 30 seconds
And the user receives a 504 response with an appropriate error message

### Scenario: Normal LLM call within timeout

Given an OpenAI provider responds in 5 seconds
And the LLM timeout is 60 seconds
When the user sends a text message
Then the response is returned normally
And no timeout error occurs

## 6. Technical constraints

- Use `Promise.race` with `AbortController` or a simple timeout promise
- The timeout wrapper must clean up properly (no dangling promises or leaked resources)
- Do not change provider platform interfaces — the timeout is a service concern
- Add timeout config fields to `BuddyConfigModel` and `UpdateBuddyConfigDto` with proper validation
- Timeout values should have min/max bounds (e.g., 5000ms – 120000ms)

## 7. Implementation hints

- Create a reusable utility:
  ```typescript
  async function withServiceTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    label: string,
  ): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new BuddyProviderTimeoutException(label)), timeoutMs);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }
  ```
- Apply in each service's main method:
  ```typescript
  // In SttProviderService.transcribe():
  const result = await withServiceTimeout(
    provider.transcribe(audio, options),
    this.getTimeout(),
    'Speech-to-text',
  );
  ```
- Remove string-matching timeout detection from `handleProviderError` in STT/TTS services (the wrapper guarantees the exception type now)
- Keep string-matching as a fallback for errors thrown by the provider itself before the timeout fires

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
