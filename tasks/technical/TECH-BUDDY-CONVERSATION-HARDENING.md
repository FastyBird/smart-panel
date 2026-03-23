# Task: Harden conversation service (prompt truncation, race conditions)

ID: TECH-BUDDY-CONVERSATION-HARDENING
Type: technical
Scope: backend
Size: medium
Parent: EPIC-BUDDY-HARDENING
Status: done

## 1. Business goal

In order to handle large smart homes reliably and prevent conversation failures from concurrency issues,
As a home operator with many devices,
I want the buddy conversation to work correctly regardless of home size and concurrent usage.

## 2. Context

- `BuddyConversationService` builds a system prompt that includes all spaces, devices, channels, properties, scenes, weather, and energy data.
- In large homes (50+ devices with 3-5 channels each, 200+ properties), the system prompt can exceed LLM token limits (e.g., Claude's 200k, GPT-4's 128k, Ollama models' 4-8k).
- There is no truncation or prioritization — the full context is always serialized.
- Transaction isolation in conversation title updates has a potential race condition with concurrent messages.
- The `shortIdMapping` used to compress device IDs accumulates across requests without explicit cleanup (potential memory concern).
- The `MAX_TOOL_ITERATIONS = 5` limit may be too low for complex multi-step tasks.

### Measured prompt sizes (estimates)

| Home size | Devices | Properties | Est. system prompt tokens |
|-----------|---------|------------|--------------------------|
| Small (apartment) | 10 | 40 | ~2,000 |
| Medium (house) | 30 | 150 | ~6,000 |
| Large (villa) | 80 | 400 | ~15,000 |
| Very large (estate) | 200+ | 1000+ | ~40,000+ |

## 3. Scope

**In scope**

- Add token estimation for system prompt and truncate/summarize when approaching limits
- Implement smart truncation strategy (prioritize current space, recently active devices, keep structure)
- Fix conversation title update race condition
- Add bounds on `shortIdMapping` memory growth
- Make `MAX_TOOL_ITERATIONS` configurable
- Add validation for empty/whitespace-only messages
- Add unit tests for truncation and edge cases

**Out of scope**

- Streaming LLM responses
- Conversation summarization (condensing old messages)
- Multi-model context splitting
- Changes to the LLM provider platform interface

## 4. Acceptance criteria

- [ ] System prompt is estimated for token count before sending to LLM
- [ ] When prompt exceeds a configurable threshold (default: 80% of model's context window), devices/properties are truncated with priority: current space > recently active > alphabetical
- [ ] Truncated prompts include a note: "Some devices omitted for brevity. Ask about specific rooms for details."
- [ ] Conversation title update uses proper locking to prevent race conditions
- [ ] `shortIdMapping` is scoped per-conversation (not global) or has a maximum size with eviction
- [ ] `MAX_TOOL_ITERATIONS` is configurable via `BuddyConfigModel`
- [ ] Empty or whitespace-only messages are rejected with 400 status
- [ ] Unit tests cover: small home (no truncation), large home (truncation triggers), very large home (aggressive truncation), empty message rejection

## 5. Example scenarios

### Scenario: Large home prompt truncation

Given a home with 100 devices across 15 rooms
And the configured LLM has an 8k token context window (Ollama)
When the user sends "What's the temperature?"
Then the system prompt includes full detail for the user's current space
And summarized data for other spaces (name + device count only)
And a note about omitted details
And the total prompt stays under 6.4k tokens (80% of 8k)

### Scenario: Empty message rejected

Given the user sends a message with only whitespace
When the controller validates the input
Then a 400 Bad Request is returned with message "Message content cannot be empty"

## 6. Technical constraints

- Token estimation should be fast (character-based heuristic is fine: ~4 chars per token for English)
- Different LLM providers have different context limits — use the configured model's limit or a sensible default
- Do not change the system prompt format for small homes (only truncate when needed)
- Keep the tool execution loop logic intact — only make iteration limit configurable

## 7. Implementation hints

- Add a `estimateTokens(text: string): number` utility (simple: `Math.ceil(text.length / 4)`)
- Build the system prompt in stages: base instructions → current space full → other spaces summary → scenes → weather/energy
- After each stage, check if estimated tokens exceed budget; if so, switch to summary mode
- For the title race condition, use `UPDATE ... WHERE id = ? AND title IS NULL` instead of read-then-write
- For shortIdMapping, use a `Map` per conversation ID, cleared when conversation is deleted
- Add `maxToolIterations` field to `BuddyConfigModel` (min: 3, max: 20, default: 5)

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
