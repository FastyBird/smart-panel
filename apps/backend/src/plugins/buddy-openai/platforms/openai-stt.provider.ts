import { Injectable, Logger } from '@nestjs/common';

import { ISttProvider, SttTranscriptionOptions } from '../../../modules/buddy/platforms/stt-provider.platform';
import { ConfigService } from '../../../modules/config/services/config.service';
import { BUDDY_OPENAI_PLUGIN_NAME } from '../buddy-openai.constants';
import { BuddyOpenaiConfigModel } from '../models/config.model';

const WHISPER_DEFAULT_MODEL = 'whisper-1';
const DEFAULT_TIMEOUT = 30_000;

// Module path as variable to prevent TypeScript from statically resolving optional peer dependency
const OPENAI_SDK_MODULE = 'openai';

@Injectable()
export class OpenAiSttProvider implements ISttProvider {
	private readonly logger = new Logger(OpenAiSttProvider.name);

	constructor(private readonly configService: ConfigService) {}

	getType(): string {
		return BUDDY_OPENAI_PLUGIN_NAME;
	}

	getName(): string {
		return 'OpenAI';
	}

	getDescription(): string {
		return 'Speech-to-text transcription using the OpenAI Whisper API';
	}

	isConfigured(pluginConfig: Record<string, unknown>): boolean {
		const apiKey = pluginConfig.apiKey;

		return typeof apiKey === 'string' && apiKey.length > 0;
	}

	async transcribe(audioBuffer: Buffer, mimeType: string, options?: SttTranscriptionOptions): Promise<string> {
		const config = this.getPluginConfig();
		const apiKey = config?.apiKey ?? '';

		if (!apiKey) {
			throw new Error('OpenAI API key is not configured');
		}

		const language = options?.language;
		const extension = OpenAiSttProvider.getExtensionFromMime(mimeType);

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
				model: WHISPER_DEFAULT_MODEL,
				...(language ? { language } : {}),
			});
			/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			const text = (transcription.text as string) ?? '';

			this.logger.debug(`OpenAI Whisper transcription: ${text.substring(0, 100)}...`);

			return text.trim();
		} catch (error) {
			const err = error as Error;

			this.logger.error(`OpenAI Whisper transcription error: ${err.message}`);

			throw err;
		}
	}

	private getPluginConfig(): BuddyOpenaiConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyOpenaiConfigModel>(BUDDY_OPENAI_PLUGIN_NAME);
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
