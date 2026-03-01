import { Injectable, Logger } from '@nestjs/common';

import { MessageRole } from '../../../modules/buddy/buddy.constants';
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

// Module path as variable to prevent TypeScript from statically resolving optional peer dependency
const ANTHROPIC_SDK_MODULE = '@anthropic-ai/sdk';

@Injectable()
export class ClaudeOauthProvider implements ILlmProvider {
	private readonly logger = new Logger(ClaudeOauthProvider.name);
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

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const { default: Anthropic } = await import(ANTHROPIC_SDK_MODULE);
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
		const client = new Anthropic({ apiKey: accessToken, timeout });

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
		const response = await client.messages.create({
			model: resolvedModel,
			max_tokens: 1024,
			system: systemPrompt,
			messages: messages.map((m) => ({
				role: m.role === MessageRole.USER ? ('user' as const) : ('assistant' as const),
				content: m.content,
			})),
		});

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
		const textBlock = response.content.find((block: { type: string }) => block.type === 'text');

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		return textBlock && 'text' in textBlock ? (textBlock.text as string) : '';
	}

	private getPluginConfig(): BuddyClaudeOauthConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyClaudeOauthConfigModel>(BUDDY_CLAUDE_OAUTH_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
