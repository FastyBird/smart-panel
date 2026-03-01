import { Injectable } from '@nestjs/common';

import { ChatMessage, ILlmProvider, LlmOptions } from '../../../modules/buddy/platforms/llm-provider.platform';
import { sendOpenAiMessage } from '../../../modules/buddy/platforms/openai-sdk.utils';
import { ConfigService } from '../../../modules/config/services/config.service';
import {
	BUDDY_OPENAI_DEFAULT_MODEL,
	BUDDY_OPENAI_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_OPENAI_PLUGIN_API_TAG_NAME,
	BUDDY_OPENAI_PLUGIN_NAME,
} from '../buddy-openai.constants';
import { BuddyOpenaiConfigModel } from '../models/config.model';

@Injectable()
export class OpenAiProvider implements ILlmProvider {
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
		model: string,
		options?: LlmOptions,
	): Promise<string> {
		const config = this.getPluginConfig();
		const apiKey = config?.apiKey ?? '';
		const resolvedModel = config?.model ?? model;
		const timeout = options?.timeout ?? 30_000;

		return sendOpenAiMessage(apiKey, resolvedModel, systemPrompt, messages, timeout);
	}

	private getPluginConfig(): BuddyOpenaiConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyOpenaiConfigModel>(BUDDY_OPENAI_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
