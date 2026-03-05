# Task: Voice commands routed through intent system

ID: FEATURE-BUDDY-VOICE-INTENT-ROUTING
Type: feature
Scope: backend
Size: small
Parent: EPIC-BUDDY-MODULE
Status: done

## 1. Business goal

In order to control my home with voice commands,
As a home operator,
I want the buddy to understand device control commands and execute them through the intent system — not just answer questions.

## 2. Context

- Depends on FEATURE-BUDDY-VOICE-STT and Phase 1 conversation API.
- The buddy already receives full home context. This task adds "tool use" capability: the LLM can decide to execute actions (create intents) in addition to responding with text.
- Uses the existing intent system (`IntentsService.createIntent()`) to execute device commands, scene runs, etc.

## 3. Scope

**In scope**

- LLM tool/function definition for home control actions:
  - `control_device(deviceId, channelId, propertyId, value)` — set a device property
  - `run_scene(sceneId)` — execute a scene
  - `set_space_lighting(spaceId, mode)` — set lighting mode for a space
- Tool execution service that maps LLM tool calls to intent creation
- Response includes both the action result and a natural language confirmation

**Out of scope**

- Complex multi-step workflows
- Conditional logic ("if it's cold, turn on heating")
- Custom tool creation by users

## 4. Acceptance criteria

- [x] LLM system prompt includes available tools/functions with descriptions
- [x] When the LLM decides to call a tool, the backend executes it via the intent system
- [x] Tool execution results are fed back to the LLM for natural language response
- [x] Supported tools: `control_device`, `run_scene`, `set_space_lighting`
- [x] Failed tool execution results in a helpful error message from the buddy
- [x] Unit tests for tool execution mapping

## 5. Example scenarios

### Scenario: Voice device control

Given the operator says "Turn off the kitchen lights"
When the LLM receives this with the tool definitions
Then it calls `set_space_lighting(kitchenSpaceId, 'off')`
And the backend creates a lighting intent for the kitchen
And the buddy responds: "Done, kitchen lights are off."

## 6. Technical constraints

- Tool use depends on LLM provider supporting function calling (Claude, OpenAI do; Ollama varies)
- Gracefully degrade to text-only response if provider doesn't support tools
- Intent creation uses existing `SpaceIntentService` or `IntentsService`
- Tool execution timeout: 5 seconds (same as scene intent TTL)

## 7. Implementation hints

- **Claude tool use**: Use Anthropic SDK's `tools` parameter in message creation
- **OpenAI function calling**: Use `functions` parameter in chat completions
- **Tool result flow**: LLM call → tool call response → execute tool → feed result back → LLM final response
- **Tool definitions**: Define as structured objects matching the LLM provider's format

## 8. AI instructions

- Read this file entirely before making any code changes.
- Keep changes scoped to backend only.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
