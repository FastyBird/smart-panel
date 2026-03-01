import { Injectable } from '@nestjs/common';

import { sendAnthropicMessage } from '../../../modules/buddy/platforms/anthropic-sdk.utils';
import { ChatMessage, ILlmProvider, LlmOptions } from '../../../modules/buddy/platforms/llm-provider.platform';
import { OAuthTokenManager } from '../../../modules/buddy/platforms/oauth-token-manager';
import { ConfigService } from '../../../modules/config/services/config.service';
import {
	BUDDY_CLAUDE_OAUTH_DEFAULT_MODEL,
	BUDDY_CLAUDE_OAUTH_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_CLAUDE_OAUTH_PLUGIN_API_TAG_NAME,
	BUDDY_CLAUDE_OAUTH_PLUGIN_NAME,
	BUDDY_CLAUDE_OAUTH_TOKEN_URL,
} from '../buddy-claude-oauth.constants';
import { BuddyClaudeOauthConfigModel } from '../models/config.model';

@Injectable()
export class ClaudeOauthProvider implements ILlmProvider {
	private readonly tokenManager = new OAuthTokenManager({
		tokenUrl: BUDDY_CLAUDE_OAUTH_TOKEN_URL,
		providerLabel: 'ClaudeOAuth',
	});

	constructor(private readonly configService: ConfigService) {}

	getType(): string {
		return BUDDY_CLAUDE_OAUTH_PLUGIN_NAME;
	}

	getName(): string {
		return BUDDY_CLAUDE_OAUTH_PLUGIN_API_TAG_NAME;
	}

	getDescription(): string {
		return BUDDY_CLAUDE_OAUTH_PLUGIN_API_TAG_DESCRIPTION;
	}

	getDefaultModel(): string {
		return BUDDY_CLAUDE_OAUTH_DEFAULT_MODEL;
	}

	async sendMessage(
		systemPrompt: string,
		messages: ChatMessage[],
		model: string,
		options?: LlmOptions,
	): Promise<string> {
		const config = this.getPluginConfig();
		const accessToken = await this.tokenManager.resolveAccessToken(config);
		const resolvedModel = config?.model ?? model;
		const timeout = options?.timeout ?? 30_000;

		return sendAnthropicMessage(accessToken, resolvedModel, systemPrompt, messages, timeout);
	}

	private getPluginConfig(): BuddyClaudeOauthConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyClaudeOauthConfigModel>(BUDDY_CLAUDE_OAUTH_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
