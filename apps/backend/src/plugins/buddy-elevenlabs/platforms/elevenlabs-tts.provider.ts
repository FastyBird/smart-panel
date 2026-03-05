import { Injectable, Logger } from '@nestjs/common';

import {
	ITtsProvider,
	TtsSynthesisOptions,
	TtsSynthesisResult,
} from '../../../modules/buddy/platforms/tts-provider.platform';
import { ConfigService } from '../../../modules/config/services/config.service';
import { BUDDY_ELEVENLABS_DEFAULT_VOICE, BUDDY_ELEVENLABS_PLUGIN_NAME } from '../buddy-elevenlabs.constants';
import { BuddyElevenlabsConfigModel } from '../models/config.model';

const TTS_DEFAULT_TIMEOUT = 30_000;

@Injectable()
export class ElevenLabsTtsProvider implements ITtsProvider {
	private readonly logger = new Logger(ElevenLabsTtsProvider.name);

	constructor(private readonly configService: ConfigService) {}

	getType(): string {
		return BUDDY_ELEVENLABS_PLUGIN_NAME;
	}

	getName(): string {
		return 'ElevenLabs TTS';
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

		const voiceId = options?.voice ?? config?.voiceId ?? BUDDY_ELEVENLABS_DEFAULT_VOICE;

		try {
			const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					Accept: 'audio/mpeg',
					'Content-Type': 'application/json',
					'xi-api-key': apiKey,
				},
				body: JSON.stringify({
					text,
					model_id: 'eleven_monolingual_v1',
					voice_settings: {
						stability: 0.5,
						similarity_boost: 0.5,
					},
				}),
				signal: AbortSignal.timeout(TTS_DEFAULT_TIMEOUT),
			});

			if (!response.ok) {
				throw new Error(`ElevenLabs API returned ${response.status}: ${response.statusText}`);
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

	private getPluginConfig(): BuddyElevenlabsConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyElevenlabsConfigModel>(BUDDY_ELEVENLABS_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
