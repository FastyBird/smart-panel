# Task: AI Assistant Voice Provider Implementations (STT & TTS)
ID: FEATURE-AI-ASSISTANT-VOICE-PROVIDERS
Type: feature
Scope: backend
Size: medium
Parent: FEATURE-AI-ASSISTANT
Status: planned

## 1. Business goal

In order to support voice interaction with the AI assistant
As a user
I want to choose between local and cloud speech-to-text (STT) and text-to-speech (TTS) providers based on my preferences for privacy, cost, and quality

## 2. Context

- Implements `ISTTProvider` and `ITTSProvider` interfaces from FEATURE-AI-ASSISTANT-BACKEND
- Audio comes from panel app via WebSocket
- Backend processes audio and returns results
- Support both local (privacy-focused) and cloud (quality-focused) options

### STT Provider Options

| Provider | Type | Languages | Quality | Latency |
|----------|------|-----------|---------|---------|
| Whisper.cpp | Local | 99+ | Good | Medium |
| OpenAI Whisper | Cloud | 99+ | Excellent | Low |
| Deepgram | Cloud | 30+ | Excellent | Very Low |
| Google Speech | Cloud | 120+ | Excellent | Low |

### TTS Provider Options

| Provider | Type | Voices | Quality | Latency |
|----------|------|--------|---------|---------|
| Piper | Local | 100+ | Good | Very Low |
| OpenAI TTS | Cloud | 6 | Excellent | Low |
| ElevenLabs | Cloud | 1000+ | Excellent | Medium |
| Google TTS | Cloud | 200+ | Excellent | Low |

## 3. Scope

**In scope**

- `ISTTProvider` interface and implementations
- `ITTSProvider` interface and implementations
- Local STT: Whisper.cpp integration
- Cloud STT: OpenAI Whisper, Deepgram
- Local TTS: Piper TTS integration
- Cloud TTS: OpenAI TTS, ElevenLabs
- Audio format conversion utilities
- Provider factories
- Connection testing

**Out of scope**

- Wake word detection (separate concern)
- Real-time streaming transcription (future enhancement)
- Voice cloning (future enhancement)
- Multi-speaker detection

## 4. Acceptance criteria

- [ ] `ISTTProvider` interface implemented by all STT providers
- [ ] `ITTSProvider` interface implemented by all TTS providers
- [ ] Local Whisper provider transcribes audio files
- [ ] OpenAI Whisper provider uses Whisper API
- [ ] Piper TTS generates speech locally
- [ ] OpenAI TTS uses OpenAI audio API
- [ ] Audio format conversion (PCM ↔ MP3/WAV) works
- [ ] Language detection/specification supported
- [ ] Voice selection supported for TTS
- [ ] `testConnection()` validates each provider
- [ ] Unit tests for all providers
- [ ] Reasonable latency (<3s for typical requests)

## 5. Example scenarios

### Scenario: Local speech-to-text

Given Whisper.cpp is installed and configured
When a 5-second audio clip is sent for transcription
Then Whisper processes the audio locally
And returns transcribed text with confidence
And processing completes within 3 seconds

### Scenario: Cloud text-to-speech

Given OpenAI TTS is configured with voice "nova"
When text "Hello, I've turned off the lights" is sent
Then OpenAI TTS API generates audio
And returns MP3 audio data
And audio sounds natural and clear

### Scenario: Language handling

Given STT provider supports language hints
When audio in Czech is sent with language="cs"
Then transcription uses Czech language model
And returns accurately transcribed Czech text

## 6. Technical constraints

- Local providers may require native binaries (Whisper.cpp, Piper)
- Use child processes or WASM for native execution
- Audio formats: PCM 16-bit 16kHz input, MP3/WAV output
- Handle large audio files with streaming
- Respect rate limits for cloud providers
- Cache TTS results for repeated phrases (optional)
- Keep audio data in memory, don't write temp files if possible

## 7. Implementation hints

### File Structure

```
src/modules/assistant/providers/
├── stt/
│   ├── stt-provider.interface.ts
│   ├── stt-provider.factory.ts
│   ├── whisper-local.provider.ts
│   ├── whisper-openai.provider.ts
│   └── deepgram.provider.ts
├── tts/
│   ├── tts-provider.interface.ts
│   ├── tts-provider.factory.ts
│   ├── piper.provider.ts
│   ├── openai-tts.provider.ts
│   └── elevenlabs.provider.ts
└── audio/
    ├── audio-converter.ts
    └── audio-utils.ts
```

### STT Interface

```typescript
// stt-provider.interface.ts
export interface TranscriptionResult {
  text: string;
  language?: string;
  confidence?: number;
  duration?: number;
  words?: WordTiming[];
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface ISTTProvider {
  readonly name: string;
  readonly isLocal: boolean;
  readonly supportedLanguages: string[];

  transcribe(audio: Buffer, options?: STTOptions): Promise<TranscriptionResult>;
  testConnection(): Promise<boolean>;
}

export interface STTOptions {
  language?: string;      // ISO 639-1 code
  prompt?: string;        // Context hint for better accuracy
}
```

### TTS Interface

```typescript
// tts-provider.interface.ts
export interface SynthesisResult {
  audio: Buffer;
  format: 'mp3' | 'wav' | 'pcm';
  duration?: number;
}

export interface ITTSProvider {
  readonly name: string;
  readonly isLocal: boolean;
  readonly availableVoices: VoiceInfo[];

  synthesize(text: string, options?: TTSOptions): Promise<SynthesisResult>;
  testConnection(): Promise<boolean>;
}

export interface TTSOptions {
  voice?: string;         // Voice ID
  speed?: number;         // 0.5 - 2.0
  language?: string;      // ISO 639-1 code
}

export interface VoiceInfo {
  id: string;
  name: string;
  language: string;
  gender?: 'male' | 'female' | 'neutral';
}
```

### Local Whisper Provider

```typescript
// whisper-local.provider.ts
import { spawn } from 'child_process';

@Injectable()
export class WhisperLocalProvider implements ISTTProvider {
  readonly name = 'whisper-local';
  readonly isLocal = true;
  readonly supportedLanguages = ['en', 'cs', 'de', 'fr', /* ... */];

  constructor(private readonly config: WhisperLocalConfig) {}

  async transcribe(audio: Buffer, options?: STTOptions): Promise<TranscriptionResult> {
    // Write audio to temp file (whisper.cpp needs file input)
    const tempFile = await this.writeTempFile(audio);

    try {
      const args = [
        '-m', this.config.modelPath,
        '-f', tempFile,
        '-l', options?.language || 'auto',
        '--output-json',
      ];

      const result = await this.runWhisper(args);
      return this.parseOutput(result);
    } finally {
      await this.deleteTempFile(tempFile);
    }
  }

  private runWhisper(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.config.executablePath, args);
      let output = '';
      let error = '';

      process.stdout.on('data', data => output += data);
      process.stderr.on('data', data => error += data);

      process.on('close', code => {
        if (code === 0) resolve(output);
        else reject(new Error(`Whisper failed: ${error}`));
      });
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      // Check if whisper executable exists and model is available
      const result = await this.runWhisper(['--help']);
      return result.includes('whisper');
    } catch {
      return false;
    }
  }
}
```

### OpenAI Whisper Provider

```typescript
// whisper-openai.provider.ts
@Injectable()
export class WhisperOpenAIProvider implements ISTTProvider {
  readonly name = 'whisper-openai';
  readonly isLocal = false;
  readonly supportedLanguages = ['en', 'cs', 'de', /* 99+ languages */];

  private readonly baseUrl = 'https://api.openai.com/v1';

  async transcribe(audio: Buffer, options?: STTOptions): Promise<TranscriptionResult> {
    const formData = new FormData();
    formData.append('file', new Blob([audio]), 'audio.wav');
    formData.append('model', 'whisper-1');

    if (options?.language) {
      formData.append('language', options.language);
    }
    if (options?.prompt) {
      formData.append('prompt', options.prompt);
    }

    const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new STTProviderException(`OpenAI Whisper error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      text: data.text,
      language: options?.language,
    };
  }

  async testConnection(): Promise<boolean> {
    // Test with minimal audio
    const silentAudio = this.generateSilentAudio(0.5);
    try {
      await this.transcribe(silentAudio);
      return true;
    } catch {
      return false;
    }
  }
}
```

### Piper TTS Provider

```typescript
// piper.provider.ts
@Injectable()
export class PiperProvider implements ITTSProvider {
  readonly name = 'piper';
  readonly isLocal = true;

  get availableVoices(): VoiceInfo[] {
    return this.loadAvailableVoices();
  }

  async synthesize(text: string, options?: TTSOptions): Promise<SynthesisResult> {
    const voice = options?.voice || this.config.defaultVoice;
    const modelPath = this.getModelPath(voice);

    const args = [
      '--model', modelPath,
      '--output_raw',
    ];

    if (options?.speed) {
      args.push('--length_scale', String(1 / options.speed));
    }

    const audio = await this.runPiper(text, args);

    return {
      audio,
      format: 'pcm',
    };
  }

  private runPiper(text: string, args: string[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.config.executablePath, args);
      const chunks: Buffer[] = [];

      process.stdin.write(text);
      process.stdin.end();

      process.stdout.on('data', chunk => chunks.push(chunk));
      process.on('close', code => {
        if (code === 0) resolve(Buffer.concat(chunks));
        else reject(new Error('Piper synthesis failed'));
      });
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.synthesize('test');
      return true;
    } catch {
      return false;
    }
  }
}
```

### OpenAI TTS Provider

```typescript
// openai-tts.provider.ts
@Injectable()
export class OpenAITTSProvider implements ITTSProvider {
  readonly name = 'openai-tts';
  readonly isLocal = false;

  readonly availableVoices: VoiceInfo[] = [
    { id: 'alloy', name: 'Alloy', language: 'en', gender: 'neutral' },
    { id: 'echo', name: 'Echo', language: 'en', gender: 'male' },
    { id: 'fable', name: 'Fable', language: 'en', gender: 'neutral' },
    { id: 'onyx', name: 'Onyx', language: 'en', gender: 'male' },
    { id: 'nova', name: 'Nova', language: 'en', gender: 'female' },
    { id: 'shimmer', name: 'Shimmer', language: 'en', gender: 'female' },
  ];

  private readonly baseUrl = 'https://api.openai.com/v1';

  async synthesize(text: string, options?: TTSOptions): Promise<SynthesisResult> {
    const response = await fetch(`${this.baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: options?.voice || 'nova',
        speed: options?.speed || 1.0,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      throw new TTSProviderException(`OpenAI TTS error: ${response.statusText}`);
    }

    const audio = Buffer.from(await response.arrayBuffer());

    return {
      audio,
      format: 'mp3',
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.synthesize('test');
      return true;
    } catch {
      return false;
    }
  }
}
```

### Audio Converter

```typescript
// audio-converter.ts
export class AudioConverter {
  /**
   * Convert PCM to WAV format
   */
  static pcmToWav(pcm: Buffer, sampleRate = 16000, channels = 1): Buffer {
    const header = this.createWavHeader(pcm.length, sampleRate, channels);
    return Buffer.concat([header, pcm]);
  }

  /**
   * Create WAV header
   */
  private static createWavHeader(dataSize: number, sampleRate: number, channels: number): Buffer {
    const header = Buffer.alloc(44);
    const byteRate = sampleRate * channels * 2; // 16-bit

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size
    header.writeUInt16LE(1, 20);  // AudioFormat (PCM)
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(channels * 2, 32); // BlockAlign
    header.writeUInt16LE(16, 34); // BitsPerSample
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return header;
  }
}
```

## 8. AI instructions (for Junie / AI)

- Read FEATURE-AI-ASSISTANT.md and FEATURE-AI-ASSISTANT-BACKEND.md first
- Start with cloud providers (easier to test without native binaries)
- Local providers need native executables installed on system
- Test audio quality with actual speech, not synthetic audio
- Handle various audio formats gracefully
- Consider adding streaming support later (complex)
- Piper and Whisper.cpp can be installed via package managers
- Document installation requirements clearly
