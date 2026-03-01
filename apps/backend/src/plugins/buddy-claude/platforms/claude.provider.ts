import { Injectable } from '@nestjs/common';

import { sendAnthropicMessage } from '../../../modules/buddy/platforms/anthropic-sdk.utils';
import { ChatMessage, ILlmProvider, LlmOptions } from '../../../modules/buddy/platforms/llm-provider.platform';
import { ConfigService } from '../../../modules/config/services/config.service';
import {
	BUDDY_CLAUDE_DEFAULT_MODEL,
	BUDDY_CLAUDE_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_CLAUDE_PLUGIN_API_TAG_NAME,
	BUDDY_CLAUDE_PLUGIN_NAME,
} from '../buddy-claude.constants';
import { BuddyClaudeConfigModel } from '../models/config.model';

@Injectable()
export class ClaudeProvider implements ILlmProvider {
	constructor(private readonly configService: ConfigService) {}

	getType(): string {
		return BUDDY_CLAUDE_PLUGIN_NAME;
	}

	getName(): string {
		return BUDDY_CLAUDE_PLUGIN_API_TAG_NAME;
	}

	getDescription(): string {
		return BUDDY_CLAUDE_PLUGIN_API_TAG_DESCRIPTION;
	}

	getDefaultModel(): string {
		return BUDDY_CLAUDE_DEFAULT_MODEL;
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

		return sendAnthropicMessage({ apiKey }, resolvedModel, systemPrompt, messages, timeout);
	}

	private getPluginConfig(): BuddyClaudeConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyClaudeConfigModel>(BUDDY_CLAUDE_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
