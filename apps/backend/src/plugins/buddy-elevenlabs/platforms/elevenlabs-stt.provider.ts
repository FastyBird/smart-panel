import { Injectable, Logger } from '@nestjs/common';

import { ISttProvider, SttTranscriptionOptions } from '../../../modules/buddy/platforms/stt-provider.platform';
import { ConfigService } from '../../../modules/config/services/config.service';
import { BUDDY_ELEVENLABS_API_BASE, BUDDY_ELEVENLABS_PLUGIN_NAME } from '../buddy-elevenlabs.constants';
import { BuddyElevenlabsConfigModel } from '../models/config.model';

const STT_DEFAULT_MODEL = 'scribe_v2';
const DEFAULT_TIMEOUT = 30_000;

@Injectable()
export class ElevenLabsSttProvider implements ISttProvider {
	private readonly logger = new Logger(ElevenLabsSttProvider.name);

	constructor(private readonly configService: ConfigService) {}

	getType(): string {
		return BUDDY_ELEVENLABS_PLUGIN_NAME;
	}

	getName(): string {
		return 'ElevenLabs';
	}

	getDescription(): string {
		return 'Speech-to-text transcription using the ElevenLabs Scribe API';
	}

	isConfigured(pluginConfig: Record<string, unknown>): boolean {
		const apiKey = pluginConfig.apiKey;

		return typeof apiKey === 'string' && apiKey.length > 0;
	}

	async transcribe(audioBuffer: Buffer, mimeType: string, options?: SttTranscriptionOptions): Promise<string> {
		const config = this.getPluginConfig();
		const apiKey = config?.apiKey ?? '';

		if (!apiKey) {
			throw new Error('ElevenLabs API key is not configured');
		}

		const extension = ElevenLabsSttProvider.getExtensionFromMime(mimeType);

		try {
			const formData = new FormData();
			formData.append('file', new Blob([audioBuffer], { type: mimeType }), `audio.${extension}`);
			formData.append('model_id', STT_DEFAULT_MODEL);

			if (options?.language) {
				formData.append('language_code', options.language);
			}

			const response = await fetch(`${BUDDY_ELEVENLABS_API_BASE}/v1/speech-to-text`, {
				method: 'POST',
				headers: {
					'xi-api-key': apiKey,
				},
				body: formData,
				signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
			});

			if (!response.ok) {
				throw new Error(`ElevenLabs STT API returned ${response.status}: ${response.statusText}`);
			}

			const result = (await response.json()) as { text?: string };
			const text = result.text ?? '';

			this.logger.debug(`ElevenLabs Scribe transcription: ${text.substring(0, 100)}...`);

			return text.trim();
		} catch (error) {
			const err = error as Error;

			this.logger.error(`ElevenLabs Scribe transcription error: ${err.message}`);

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

	static getExtensionFromMime(mimeType: string): string {
		switch (mimeType) {
			case 'audio/wav':
			case 'audio/wave':
			case 'audio/x-wav':
				return 'wav';
			case 'audio/webm':
				return 'webm';
			case 'audio/ogg':
				return 'ogg';
			case 'audio/mpeg':
				return 'mp3';
			default:
				return 'wav';
		}
	}
}
