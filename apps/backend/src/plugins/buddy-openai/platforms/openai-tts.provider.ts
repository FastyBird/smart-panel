import { Injectable, Logger } from '@nestjs/common';

import {
	ITtsProvider,
	TtsSynthesisOptions,
	TtsSynthesisResult,
} from '../../../modules/buddy/platforms/tts-provider.platform';
import { ConfigService } from '../../../modules/config/services/config.service';
import { BUDDY_OPENAI_PLUGIN_NAME } from '../buddy-openai.constants';
import { BuddyOpenaiConfigModel } from '../models/config.model';

const TTS_DEFAULT_VOICE = 'alloy';
const TTS_DEFAULT_TIMEOUT = 30_000;

// Module path as variable to prevent TypeScript from statically resolving optional peer dependency
const OPENAI_SDK_MODULE = 'openai';

@Injectable()
export class OpenAiTtsProvider implements ITtsProvider {
	private readonly logger = new Logger(OpenAiTtsProvider.name);

	constructor(private readonly configService: ConfigService) {}

	getType(): string {
		return BUDDY_OPENAI_PLUGIN_NAME;
	}

	getName(): string {
		return 'OpenAI TTS';
	}

	getDescription(): string {
		return 'Text-to-speech provider using OpenAI TTS API';
	}

	isConfigured(pluginConfig: Record<string, unknown>): boolean {
		const apiKey = pluginConfig.apiKey;

		return typeof apiKey === 'string' && apiKey.length > 0;
	}

	async synthesize(text: string, options?: TtsSynthesisOptions): Promise<TtsSynthesisResult> {
		const config = this.getPluginConfig();
		const apiKey = config?.apiKey ?? '';

		if (!apiKey) {
			throw new Error('OpenAI API key is not configured');
		}

		const voice = options?.voice ?? TTS_DEFAULT_VOICE;
		const speed = options?.speed ?? 1.0;

		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const { default: OpenAI } = await import(OPENAI_SDK_MODULE);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
			const client = new OpenAI({ apiKey, timeout: TTS_DEFAULT_TIMEOUT });

			/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
			const response = await client.audio.speech.create({
				model: 'tts-1',
				voice,
				input: text,
				response_format: 'mp3',
				speed,
			});

			const arrayBuffer = await response.arrayBuffer();
			/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

			const buffer = Buffer.from(arrayBuffer as ArrayBuffer);

			this.logger.debug(`OpenAI TTS generated ${buffer.length} bytes for text: "${text.substring(0, 50)}..."`);

			return { buffer, contentType: 'audio/mpeg' };
		} catch (error) {
			const err = error as Error;

			this.logger.error(`OpenAI TTS error: ${err.message}`);

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
}
