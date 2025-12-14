# Task: AI Assistant Backend Module
ID: FEATURE-AI-ASSISTANT-BACKEND
Type: feature
Scope: backend
Size: medium
Parent: FEATURE-AI-ASSISTANT
Status: planned

## 1. Business goal

In order to provide the core intelligence and orchestration for the AI assistant
As a developer
I want to create a NestJS module that handles assistant requests, manages conversations, and coordinates with LLM/STT/TTS providers

## 2. Context

- Follow existing module patterns in `src/modules/weather/` for service structure
- Follow plugin patterns in `src/plugins/` for provider implementations
- Use existing WebSocket gateway for real-time communication
- Use existing configuration module for settings persistence
- Integrate with existing device services for smart home control

### Reference Files

- `src/modules/weather/weather.module.ts` - Module structure
- `src/modules/weather/services/weather.service.ts` - Service with external API integration
- `src/modules/websocket/gateway/websocket.gateway.ts` - WebSocket events
- `src/modules/config/services/config.service.ts` - Configuration management
- `src/modules/devices/services/devices.service.ts` - Device control

## 3. Scope

**In scope**

- Assistant NestJS module with proper structure
- AssistantService for request orchestration
- Configuration model for multi-provider settings
- WebSocket command handlers for assistant events
- Device context builder for LLM prompts
- Conversation history management
- Provider factory pattern for LLM/STT/TTS
- REST API endpoints for configuration
- Integration with existing device and weather services

**Out of scope**

- Actual LLM provider implementations (separate task: FEATURE-AI-ASSISTANT-LLM-PROVIDERS)
- Actual STT/TTS implementations (separate task: FEATURE-AI-ASSISTANT-VOICE-PROVIDERS)
- Panel/Admin UI (separate tasks)

## 4. Acceptance criteria

- [ ] `AssistantModule` created with proper NestJS structure
- [ ] `AssistantService` orchestrates message processing flow
- [ ] `AssistantConfigModel` supports multi-provider configuration
- [ ] Configuration persisted via existing ConfigModule
- [ ] WebSocket events: `assistant/message`, `assistant/response`, `assistant/emotion`
- [ ] `DeviceContextService` builds context from current device states
- [ ] `ConversationService` manages conversation history with timeout
- [ ] Provider interfaces defined: `ILLMProvider`, `ISTTProvider`, `ITTSProvider`
- [ ] Factory classes created for provider instantiation
- [ ] REST endpoints for getting/updating assistant config
- [ ] Unit tests for AssistantService and ConversationService
- [ ] OpenAPI documentation for new endpoints

## 5. Example scenarios

### Scenario: Process text message

Given a valid assistant configuration with LLM provider set
When a WebSocket `assistant/message` event is received with text content
Then the AssistantService retrieves current device context
And builds a system prompt with device states
And sends the message to the configured LLM provider
And extracts response text and emotion from LLM response
And emits `assistant/response` event with text and emotion
And stores the exchange in conversation history

### Scenario: Process voice message

Given STT provider is configured
When a WebSocket `assistant/message` event is received with audio content
Then the audio is sent to the STT provider for transcription
And the transcribed text is processed as a text message
And if TTS is configured, response audio is generated
And emits `assistant/response` event with text, emotion, and audio URL

### Scenario: Device control intent

Given user sends "turn off the kitchen lights"
When the LLM processes the message with device context
Then the LLM returns a response with device control action
And AssistantService executes the device control via DevicesService
And returns confirmation to the user

## 6. Technical constraints

- Follow existing module structure in `src/modules/`
- Use existing TypeORM patterns for any persistence
- Use existing DTOs and validation patterns
- Register module in `app.module.ts`
- Use existing event emitter for internal events
- Use existing WebSocket command registry pattern
- Do not introduce heavy dependencies (no TensorFlow, etc.)
- Keep provider logic in separate factory/strategy classes

## 7. Implementation hints

### Module Structure

```
src/modules/assistant/
├── assistant.module.ts
├── assistant.constants.ts
├── controllers/
│   └── assistant.controller.ts
├── services/
│   ├── assistant.service.ts
│   ├── conversation.service.ts
│   ├── device-context.service.ts
│   └── provider-registry.service.ts
├── factories/
│   ├── llm-provider.factory.ts
│   ├── stt-provider.factory.ts
│   └── tts-provider.factory.ts
├── interfaces/
│   ├── llm-provider.interface.ts
│   ├── stt-provider.interface.ts
│   └── tts-provider.interface.ts
├── models/
│   ├── config.model.ts
│   ├── conversation.model.ts
│   └── message.model.ts
├── dto/
│   ├── assistant-message.dto.ts
│   ├── assistant-response.dto.ts
│   └── assistant-config.dto.ts
├── handlers/
│   └── assistant-command.handler.ts
└── assistant.openapi.ts
```

### Configuration Model

```typescript
interface AssistantConfigModel {
  enabled: boolean;
  llm: {
    provider: 'ollama' | 'openai' | 'anthropic' | 'google' | 'disabled';
    // Provider-specific settings...
  };
  stt: {
    provider: 'local-whisper' | 'openai-whisper' | 'deepgram' | 'disabled';
    // Provider-specific settings...
  };
  tts: {
    provider: 'piper' | 'openai' | 'elevenlabs' | 'disabled';
    // Provider-specific settings...
  };
  wakeWord: {
    provider: 'openwakeword' | 'porcupine' | 'disabled';
    // Provider-specific settings...
  };
  conversationTimeout: number;
  maxHistoryLength: number;
}
```

### WebSocket Events

```typescript
// Register in websocket.constants.ts
export const AssistantEventType = {
  MESSAGE: 'assistant/message',
  RESPONSE: 'assistant/response',
  EMOTION: 'assistant/emotion',
  THINKING: 'assistant/thinking',
  ERROR: 'assistant/error',
} as const;
```

### System Prompt Template

```typescript
const buildSystemPrompt = (context: DeviceContext) => `
You are a helpful smart home assistant. You can control devices and answer questions.

Current devices and their states:
${context.devices.map(d => `- ${d.name}: ${d.state}`).join('\n')}

Current weather: ${context.weather?.summary || 'Not available'}
Current time: ${context.currentTime}

When responding:
1. Be concise and friendly
2. Include an emotion tag: [emotion:happy|thinking|surprised|sorry|neutral]
3. For device control, respond with action: [action:setProperty:deviceId:property:value]

Example response:
[emotion:happy] I've turned off the kitchen lights for you. [action:setProperty:abc123:on:false]
`;
```

## 8. AI instructions (for Junie / AI)

- Read FEATURE-AI-ASSISTANT.md first for full context
- Start with module skeleton and interfaces
- Implement services with mock/stub providers first
- Add WebSocket handlers after services work
- Use existing patterns from weather module as reference
- Write unit tests alongside implementation
- Document all public interfaces with JSDoc
- Keep provider implementations as stubs - real implementations in separate task
