import { Injectable, Logger } from '@nestjs/common';

import {
	ITtsProvider,
	TtsSynthesisOptions,
	TtsSynthesisResult,
} from '../../../modules/buddy/platforms/tts-provider.platform';
import { ConfigService } from '../../../modules/config/services/config.service';
import { BUDDY_ELEVENLABS_API_BASE, BUDDY_ELEVENLABS_PLUGIN_NAME } from '../buddy-elevenlabs.constants';
import { BuddyElevenlabsConfigModel } from '../models/config.model';

const TTS_DEFAULT_TIMEOUT = 30_000;

interface ElevenLabsVoice {
	voice_id: string;
	name: string;
}

@Injectable()
export class ElevenLabsTtsProvider implements ITtsProvider {
	private readonly logger = new Logger(ElevenLabsTtsProvider.name);
	private cachedDefaultVoiceId = new Map<string, string>();

	constructor(private readonly configService: ConfigService) {}

	getType(): string {
		return BUDDY_ELEVENLABS_PLUGIN_NAME;
	}

	getName(): string {
		return 'ElevenLabs';
	}

	getDescription(): string {
		return 'Text-to-speech provider using ElevenLabs API';
	}

	isConfigured(pluginConfig: Record<string, unknown>): boolean {
		const apiKey = pluginConfig.apiKey;

		return typeof apiKey === 'string' && apiKey.length > 0;
	}

	async synthesize(text: string, options?: TtsSynthesisOptions): Promise<TtsSynthesisResult> {
		const config = this.getPluginConfig();
		const apiKey = config?.apiKey ?? '';

		if (!apiKey) {
			throw new Error('ElevenLabs API key is not configured');
		}

		const voiceId = options?.voice ?? config?.voiceId ?? (await this.getDefaultVoiceId(apiKey));

		try {
			const url = `${BUDDY_ELEVENLABS_API_BASE}/v1/text-to-speech/${encodeURIComponent(voiceId)}`;

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					Accept: 'audio/mpeg',
					'Content-Type': 'application/json',
					'xi-api-key': apiKey,
				},
				body: JSON.stringify({
					text,
					model_id: 'eleven_multilingual_v2',
					voice_settings: {
						stability: 0.5,
						similarity_boost: 0.5,
					},
				}),
				signal: AbortSignal.timeout(TTS_DEFAULT_TIMEOUT),
			});

			if (!response.ok) {
				const body = await response.text().catch(() => '');

				throw new Error(
					`ElevenLabs TTS API returned ${response.status}: ${response.statusText} (voice=${voiceId})${body ? ` - ${body}` : ''}`,
				);
			}

			const arrayBuffer = await response.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);

			this.logger.debug(`ElevenLabs TTS generated ${buffer.length} bytes for text: "${text.substring(0, 50)}..."`);

			return { buffer, contentType: 'audio/mpeg' };
		} catch (error) {
			const err = error as Error;

			this.logger.error(`ElevenLabs TTS error: ${err.message}`);

			throw err;
		}
	}

	private async getDefaultVoiceId(apiKey: string): Promise<string> {
		const cached = this.cachedDefaultVoiceId.get(apiKey);

		if (cached) {
			return cached;
		}

		try {
			const response = await fetch(`${BUDDY_ELEVENLABS_API_BASE}/v1/voices`, {
				headers: { 'xi-api-key': apiKey },
				signal: AbortSignal.timeout(TTS_DEFAULT_TIMEOUT),
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch voices: ${response.status}`);
			}

			const data = (await response.json()) as { voices?: ElevenLabsVoice[] };
			const firstVoice = data.voices?.[0];

			if (!firstVoice) {
				throw new Error('No voices available in ElevenLabs account');
			}

			this.logger.log(`Using ElevenLabs voice: ${firstVoice.name} (${firstVoice.voice_id})`);
			this.cachedDefaultVoiceId.set(apiKey, firstVoice.voice_id);

			return firstVoice.voice_id;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to discover ElevenLabs voices: ${err.message}`);

			throw new Error('ElevenLabs voice_id is not configured and auto-discovery failed');
		}
	}

	private getPluginConfig(): BuddyElevenlabsConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyElevenlabsConfigModel>(BUDDY_ELEVENLABS_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
