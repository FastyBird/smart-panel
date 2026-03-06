import { Injectable, Logger } from '@nestjs/common';

import { ISttProvider, SttTranscriptionOptions } from '../../../modules/buddy/platforms/stt-provider.platform';
import { ConfigService } from '../../../modules/config/services/config.service';
import {
	BUDDY_STT_WHISPER_API_DEFAULT_MODEL,
	BUDDY_STT_WHISPER_API_PLUGIN_NAME,
} from '../buddy-stt-whisper-api.constants';
import { BuddySttWhisperApiConfigModel } from '../models/config.model';

// Module path as variable to prevent TypeScript from statically resolving optional peer dependency
const OPENAI_SDK_MODULE = 'openai';

const DEFAULT_TIMEOUT = 30_000;

@Injectable()
export class WhisperApiSttProvider implements ISttProvider {
	private readonly logger = new Logger(WhisperApiSttProvider.name);

	constructor(private readonly configService: ConfigService) {}

	getType(): string {
		return BUDDY_STT_WHISPER_API_PLUGIN_NAME;
	}

	getName(): string {
		return 'Whisper API (OpenAI)';
	}

	getDescription(): string {
		return 'Speech-to-text transcription using the OpenAI Whisper API';
	}

	isConfigured(pluginConfig: Record<string, unknown>): boolean {
		const apiKey = (pluginConfig['apiKey'] ?? pluginConfig['api_key']) as string | undefined;

		return !!apiKey && apiKey !== '***';
	}

	async transcribe(audioBuffer: Buffer, mimeType: string, options?: SttTranscriptionOptions): Promise<string> {
		const config = this.getPluginConfig();
		const apiKey = config.apiKey ?? '';

		if (!apiKey) {
			throw new Error('Whisper API key is not configured');
		}

		const model = config.model || BUDDY_STT_WHISPER_API_DEFAULT_MODEL;
		const language = options?.language ?? config.language;
		const extension = WhisperApiSttProvider.getExtensionFromMime(mimeType);

		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const { default: OpenAI, toFile } = await import(OPENAI_SDK_MODULE);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
			const client = new OpenAI({ apiKey, timeout: DEFAULT_TIMEOUT });

			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
			const file = await toFile(audioBuffer, `audio.${extension}`, { type: mimeType });

			/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
			const transcription = await client.audio.transcriptions.create({
				file,
				model,
				...(language ? { language } : {}),
			});
			/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			const text = (transcription.text as string) ?? '';

			this.logger.debug(`Whisper API transcription: ${text.substring(0, 100)}...`);

			return text.trim();
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Whisper API transcription error: ${err.message}`);

			throw err;
		}
	}

	private getPluginConfig(): BuddySttWhisperApiConfigModel {
		try {
			return this.configService.getPluginConfig<BuddySttWhisperApiConfigModel>(BUDDY_STT_WHISPER_API_PLUGIN_NAME);
		} catch {
			return new BuddySttWhisperApiConfigModel();
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
