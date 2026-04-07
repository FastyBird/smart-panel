# Task: Fix SDK error handling and type safety

ID: TECH-BUDDY-SDK-ERROR-HANDLING
Type: technical
Scope: backend
Size: small
Parent: EPIC-BUDDY-HARDENING
Status: done

## 1. Business goal

In order to get reliable AI responses and avoid silent failures during tool-use conversations,
As a home operator interacting with the buddy,
I want SDK errors to be handled gracefully with proper feedback to the LLM.

## 2. Context

- `openai-sdk.utils.ts` silently drops tool calls with malformed JSON arguments (lines 87-96). The LLM's intent is lost without any feedback, which can cause the conversation to stall or produce incomplete responses.
- `anthropic-sdk.utils.ts` has extensive `eslint-disable` comments for unsafe type access on SDK response objects — these could break silently if SDK types change.
- `LlmProviderService` uses string matching on error messages to detect timeouts (checking for "timeout", "ETIMEDOUT", "AbortError"). This is fragile across different providers and SDK versions.
- Neither SDK utility validates tool definition schemas before sending to the provider.

### Impact

| Issue | Frequency | User impact |
|-------|-----------|-------------|
| Silent tool call drops | Rare (malformed LLM output) | Buddy silently fails to execute device commands |
| Type safety gaps | On SDK update | Potential runtime crashes |
| Fragile timeout detection | On provider/SDK changes | Wrong error categorization (timeout shown as generic error) |

## 3. Scope

**In scope**

- Return error tool results to the LLM for malformed tool calls (instead of silently dropping)
- Create proper TypeScript interfaces for SDK response structures
- Reduce `eslint-disable` usage in SDK utilities
- Improve timeout detection to be less fragile (keep string matching as fallback, but prefer structured errors)
- Add unit tests for error scenarios

**Out of scope**

- Tool schema validation (complex, low impact)
- Streaming response support
- New provider SDK integrations
- Changes to provider platform interfaces

## 4. Acceptance criteria

- [x] Malformed tool call arguments in OpenAI SDK return an error result to the LLM via `toolErrors` array
- [x] The LLM can retry or respond gracefully when receiving tool error results
- [ ] TypeScript interfaces created for Anthropic and OpenAI SDK response structures — skipped: eslint-disables are inherent to dynamic import pattern, can't be reduced without architecture change
- [ ] At least 50% reduction in eslint-disable comments — skipped: same reason as above
- [x] Timeout detection uses `instanceof` checks where possible, with string matching as fallback
- [x] Add `BuddyProviderTimeoutException` to providers' error handling chain
- [x] Unit tests cover: timeout detection accuracy (7 tests)
- [x] No changes to LLM provider platform interface

## 5. Example scenarios

### Scenario: Malformed tool call handled gracefully

Given the LLM requests a tool call with invalid JSON: `{"device_id": "abc", broken`
When the OpenAI SDK parses the tool call arguments
Then an error result is returned: `"Error: Failed to parse tool arguments — Unexpected end of JSON"`
And the LLM receives this error and responds to the user: "I had trouble executing that command. Let me try again."

### Scenario: Timeout detected reliably

Given an Anthropic API call times out after 30 seconds
When the SDK throws an error with `error.name = 'APIConnectionTimeoutError'`
Then `BuddyProviderTimeoutException` is thrown
And the user sees: "The AI provider took too long to respond. Please try again."

## 6. Technical constraints

- Do not add new dependencies for SDK type definitions — create local interfaces
- Keep the dynamic import pattern for optional SDK peer dependencies
- Error results must follow each SDK's tool result format exactly
- Maintain backward compatibility with existing provider plugin implementations

## 7. Implementation hints

- For OpenAI malformed tool calls:
  ```typescript
  // Instead of skipping:
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch (parseError) {
    // Return error result to LLM
    toolResults.push({
      tool_call_id: toolCall.id,
      role: 'tool',
      content: `Error: Failed to parse arguments — ${parseError.message}`,
    });
    continue;
  }
  ```
- For TypeScript interfaces:
  ```typescript
  interface AnthropicContentBlock {
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  }

  interface AnthropicUsage {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  }
  ```
- For timeout detection improvement:
  ```typescript
  function isTimeoutError(error: unknown): boolean {
    if (error instanceof BuddyProviderTimeoutException) return true;
    if (error && typeof error === 'object') {
      const e = error as Record<string, unknown>;
      if (e.name === 'APIConnectionTimeoutError') return true;  // Anthropic SDK
      if (e.code === 'ETIMEDOUT' || e.code === 'ECONNABORTED') return true;
    }
    // Fallback string matching
    const msg = String((error as Error)?.message ?? '');
    return /timeout|timed?\s*out/i.test(msg);
  }
  ```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
