import { Injectable, Logger } from '@nestjs/common';

import { MessageRole } from '../../../modules/buddy/buddy.constants';
import { ChatMessage, ILlmProvider, LlmOptions } from '../../../modules/buddy/platforms/llm-provider.platform';
import { ConfigService } from '../../../modules/config/services/config.service';
import {
	BUDDY_OPENAI_DEFAULT_MODEL,
	BUDDY_OPENAI_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_OPENAI_PLUGIN_API_TAG_NAME,
	BUDDY_OPENAI_PLUGIN_NAME,
} from '../buddy-openai.constants';
import { BuddyOpenaiConfigModel } from '../models/config.model';

// Module path as variable to prevent TypeScript from statically resolving optional peer dependency
const OPENAI_SDK_MODULE = 'openai';

@Injectable()
export class OpenAiProvider implements ILlmProvider {
	private readonly logger = new Logger(OpenAiProvider.name);

	constructor(private readonly configService: ConfigService) {}

	getType(): string {
		return BUDDY_OPENAI_PLUGIN_NAME;
	}

	getName(): string {
		return BUDDY_OPENAI_PLUGIN_API_TAG_NAME;
	}

	getDescription(): string {
		return BUDDY_OPENAI_PLUGIN_API_TAG_DESCRIPTION;
	}

	getDefaultModel(): string {
		return BUDDY_OPENAI_DEFAULT_MODEL;
	}

	async sendMessage(
		systemPrompt: string,
		messages: ChatMessage[],
		_apiKey: string,
		model: string,
		options?: LlmOptions,
	): Promise<string> {
		const config = this.getPluginConfig();
		const apiKey = config?.apiKey ?? _apiKey;
		const resolvedModel = config?.model ?? model;
		const timeout = options?.timeout ?? 30_000;

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const { default: OpenAI } = await import(OPENAI_SDK_MODULE);
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
		const client = new OpenAI({ apiKey, timeout });

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
		const response = await client.chat.completions.create({
			model: resolvedModel,
			messages: [
				{ role: 'system' as const, content: systemPrompt },
				...messages.map((m) => ({
					role: m.role === MessageRole.USER ? ('user' as const) : ('assistant' as const),
					content: m.content,
				})),
			],
		});

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		return (response.choices[0]?.message?.content as string) ?? '';
	}

	private getPluginConfig(): BuddyOpenaiConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyOpenaiConfigModel>(BUDDY_OPENAI_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
