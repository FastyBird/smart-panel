# Task: AI Assistant LLM Provider Implementations
ID: FEATURE-AI-ASSISTANT-LLM-PROVIDERS
Type: feature
Scope: backend
Size: medium
Parent: FEATURE-AI-ASSISTANT
Status: planned

## 1. Business goal

In order to support multiple LLM backends for the AI assistant
As a user
I want to choose between local (Ollama) and cloud (OpenAI, Anthropic, Google) language models based on my preferences for privacy, cost, and quality

## 2. Context

- Implements the `ILLMProvider` interface from FEATURE-AI-ASSISTANT-BACKEND
- Each provider is a separate class following Strategy pattern
- Factory creates appropriate provider based on configuration
- All providers must return consistent response format
- Support streaming for real-time responses

### Provider Options

| Provider | Type | Models | Pros | Cons |
|----------|------|--------|------|------|
| Ollama | Local | Llama 3.2, Mistral, Phi-3 | Free, Private, Offline | Requires resources |
| OpenAI | Cloud | GPT-4o, GPT-4o-mini | Best quality | Cost, Privacy |
| Anthropic | Cloud | Claude 3 Haiku/Sonnet | Good reasoning | Cost |
| Google | Cloud | Gemini 1.5 Flash/Pro | Fast, Cheap | Newer |

## 3. Scope

**In scope**

- `OllamaProvider` - Local LLM via Ollama API
- `OpenAIProvider` - OpenAI GPT models
- `AnthropicProvider` - Claude models
- `GoogleProvider` - Gemini models
- `LLMProviderFactory` - Creates providers from config
- Consistent response parsing (text + emotion + actions)
- Streaming support for all providers
- Error handling and fallbacks
- Connection testing/validation

**Out of scope**

- Custom/fine-tuned models
- Multi-model routing (use one provider at a time)
- Caching layer (future optimization)
- Usage tracking/billing

## 4. Acceptance criteria

- [ ] `ILLMProvider` interface implemented by all providers
- [ ] `OllamaProvider` connects to local Ollama instance
- [ ] `OpenAIProvider` uses OpenAI chat completions API
- [ ] `AnthropicProvider` uses Anthropic messages API
- [ ] `GoogleProvider` uses Gemini API
- [ ] All providers parse emotion and actions from responses
- [ ] Streaming responses work for all providers
- [ ] `testConnection()` validates provider configuration
- [ ] Graceful error handling with meaningful messages
- [ ] Unit tests for each provider
- [ ] Timeout handling for slow responses

## 5. Example scenarios

### Scenario: Ollama provider

Given Ollama is running at http://localhost:11434
And the model "llama3.2:3b" is available
When a chat request is sent
Then the provider calls Ollama's /api/chat endpoint
And parses the response for text, emotion, and actions
And returns a structured LLMResponse

### Scenario: Streaming response

Given OpenAI provider is configured
When a chat request is sent with streaming enabled
Then the provider uses OpenAI's streaming API
And yields response chunks as they arrive
And final response includes complete text and metadata

### Scenario: Provider unavailable

Given Ollama provider is configured
When Ollama server is not running
And a chat request is sent
Then the provider throws a clear error
And the error indicates the service is unavailable

## 6. Technical constraints

- Use native `fetch` or minimal HTTP client (no heavy SDKs)
- Follow existing service patterns in backend
- Parse JSON responses carefully with validation
- Handle rate limiting for cloud providers
- Implement reasonable timeouts (30s default)
- Log requests/responses at debug level
- Do not log API keys or sensitive data

## 7. Implementation hints

### File Structure

```
src/modules/assistant/providers/llm/
├── llm-provider.interface.ts
├── llm-provider.factory.ts
├── ollama.provider.ts
├── openai.provider.ts
├── anthropic.provider.ts
├── google.provider.ts
└── llm-response.parser.ts
```

### Interface Definition

```typescript
// llm-provider.interface.ts
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  text: string;
  emotion: EmotionType;
  actions: DeviceAction[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface ILLMProvider {
  readonly name: string;
  readonly isLocal: boolean;

  chat(messages: ChatMessage[]): Promise<LLMResponse>;
  stream(messages: ChatMessage[]): AsyncIterable<string>;
  testConnection(): Promise<boolean>;
}
```

### Ollama Provider

```typescript
// ollama.provider.ts
@Injectable()
export class OllamaProvider implements ILLMProvider {
  readonly name = 'ollama';
  readonly isLocal = true;

  constructor(
    private readonly config: OllamaConfig,
    private readonly responseParser: LLMResponseParser,
  ) {}

  async chat(messages: ChatMessage[]): Promise<LLMResponse> {
    const response = await fetch(`${this.config.url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new LLMProviderException(`Ollama error: ${response.statusText}`);
    }

    const data = await response.json();
    return this.responseParser.parse(data.message.content);
  }

  async *stream(messages: ChatMessage[]): AsyncIterable<string> {
    const response = await fetch(`${this.config.url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: true,
      }),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(Boolean);

      for (const line of lines) {
        const data = JSON.parse(line);
        if (data.message?.content) {
          yield data.message.content;
        }
      }
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.url}/api/tags`);
      const data = await response.json();
      return data.models?.some(m => m.name === this.config.model);
    } catch {
      return false;
    }
  }
}
```

### OpenAI Provider

```typescript
// openai.provider.ts
@Injectable()
export class OpenAIProvider implements ILLMProvider {
  readonly name = 'openai';
  readonly isLocal = false;

  private readonly baseUrl = 'https://api.openai.com/v1';

  async chat(messages: ChatMessage[]): Promise<LLMResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new LLMProviderException(`OpenAI error: ${error.error?.message}`);
    }

    const data = await response.json();
    return this.responseParser.parse(data.choices[0].message.content, {
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### Response Parser

```typescript
// llm-response.parser.ts
@Injectable()
export class LLMResponseParser {
  parse(content: string, usage?: TokenUsage): LLMResponse {
    // Extract emotion: [emotion:happy]
    const emotionMatch = content.match(/\[emotion:(\w+)\]/);
    const emotion = emotionMatch
      ? this.parseEmotion(emotionMatch[1])
      : EmotionType.NEUTRAL;

    // Extract actions: [action:setProperty:deviceId:property:value]
    const actionMatches = content.matchAll(/\[action:(\w+):([^\]]+)\]/g);
    const actions = Array.from(actionMatches).map(m => this.parseAction(m[1], m[2]));

    // Clean text (remove tags)
    const text = content
      .replace(/\[emotion:\w+\]/g, '')
      .replace(/\[action:[^\]]+\]/g, '')
      .trim();

    return { text, emotion, actions, usage };
  }

  private parseEmotion(value: string): EmotionType {
    const map: Record<string, EmotionType> = {
      happy: EmotionType.HAPPY,
      thinking: EmotionType.THINKING,
      surprised: EmotionType.SURPRISED,
      sorry: EmotionType.SORRY,
      neutral: EmotionType.NEUTRAL,
    };
    return map[value.toLowerCase()] || EmotionType.NEUTRAL;
  }

  private parseAction(type: string, params: string): DeviceAction {
    const parts = params.split(':');
    return {
      type,
      deviceId: parts[0],
      property: parts[1],
      value: parts[2],
    };
  }
}
```

### Factory

```typescript
// llm-provider.factory.ts
@Injectable()
export class LLMProviderFactory {
  constructor(
    private readonly responseParser: LLMResponseParser,
  ) {}

  create(config: LLMConfig): ILLMProvider {
    switch (config.provider) {
      case 'ollama':
        return new OllamaProvider(config, this.responseParser);
      case 'openai':
        return new OpenAIProvider(config, this.responseParser);
      case 'anthropic':
        return new AnthropicProvider(config, this.responseParser);
      case 'google':
        return new GoogleProvider(config, this.responseParser);
      default:
        throw new Error(`Unknown LLM provider: ${config.provider}`);
    }
  }
}
```

## 8. AI instructions (for Junie / AI)

- Read FEATURE-AI-ASSISTANT.md and FEATURE-AI-ASSISTANT-BACKEND.md first
- Start with Ollama provider (easiest to test locally)
- Add OpenAI provider next (most common cloud option)
- Use consistent error handling across all providers
- Test with actual API calls, not just mocks
- The response parser is critical - test edge cases
- Consider adding retry logic for transient failures
- Keep API keys secure - never log them
