import { Injectable, Logger } from '@nestjs/common';

import {
	ITtsProvider,
	TtsSynthesisOptions,
	TtsSynthesisResult,
} from '../../../modules/buddy/platforms/tts-provider.platform';
import { ConfigService } from '../../../modules/config/services/config.service';
import { BUDDY_VOICEAI_API_BASE_URL, BUDDY_VOICEAI_PLUGIN_NAME } from '../buddy-voiceai.constants';
import { BuddyVoiceaiConfigModel } from '../models/config.model';

const TTS_DEFAULT_TIMEOUT = 30_000;

@Injectable()
export class VoiceaiTtsProvider implements ITtsProvider {
	private readonly logger = new Logger(VoiceaiTtsProvider.name);

	constructor(private readonly configService: ConfigService) {}

	getType(): string {
		return BUDDY_VOICEAI_PLUGIN_NAME;
	}

	getName(): string {
		return 'Voice.ai TTS';
	}

	getDescription(): string {
		return 'Text-to-speech provider using Voice.ai API';
	}

	isConfigured(pluginConfig: Record<string, unknown>): boolean {
		const apiKey = pluginConfig.apiKey;
		const voiceId = pluginConfig.voiceId;

		return typeof apiKey === 'string' && apiKey.length > 0 && typeof voiceId === 'string' && voiceId.length > 0;
	}

	async synthesize(text: string, options?: TtsSynthesisOptions): Promise<TtsSynthesisResult> {
		const config = this.getPluginConfig();
		const apiKey = config?.apiKey ?? '';

		if (!apiKey) {
			throw new Error('Voice.ai API key is not configured');
		}

		const voiceId = options?.voice ?? config?.voiceId;

		if (!voiceId) {
			throw new Error('Voice.ai voice ID is not configured. Set a voice ID in the plugin configuration.');
		}

		try {
			const url = `${BUDDY_VOICEAI_API_BASE_URL}/tts/v2/audio/speech`;

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					text,
					voice: voiceId,
					audio_format: 'mp3',
					streaming: false,
				}),
				signal: AbortSignal.timeout(TTS_DEFAULT_TIMEOUT),
			});

			if (!response.ok) {
				throw new Error(`Voice.ai API returned ${response.status}: ${response.statusText}`);
			}

			const arrayBuffer = await response.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);

			this.logger.debug(`Voice.ai TTS generated ${buffer.length} bytes for text: "${text.substring(0, 50)}..."`);

			return { buffer, contentType: 'audio/mpeg' };
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Voice.ai TTS error: ${err.message}`);

			throw err;
		}
	}

	private getPluginConfig(): BuddyVoiceaiConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyVoiceaiConfigModel>(BUDDY_VOICEAI_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
