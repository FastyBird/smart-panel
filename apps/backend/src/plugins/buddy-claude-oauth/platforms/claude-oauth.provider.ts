import { Injectable, Logger } from '@nestjs/common';

import { MessageRole } from '../../../modules/buddy/buddy.constants';
import { ChatMessage, ILlmProvider, LlmOptions } from '../../../modules/buddy/platforms/llm-provider.platform';
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

/** Cached tokens are considered expired after this many milliseconds (50 minutes). */
const TOKEN_TTL_MS = 50 * 60 * 1000;
const TOKEN_REFRESH_TIMEOUT_MS = 10_000;

@Injectable()
export class ClaudeOauthProvider implements ILlmProvider {
	private readonly logger = new Logger(ClaudeOauthProvider.name);
	private cachedAccessToken: string | null = null;
	private cachedAccessTokenExpiresAt = 0;

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
		const accessToken = await this.resolveAccessToken(config);
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

	private async resolveAccessToken(config: BuddyClaudeOauthConfigModel | null): Promise<string> {
		if (this.cachedAccessToken && Date.now() < this.cachedAccessTokenExpiresAt) {
			return this.cachedAccessToken;
		}

		// Clear stale cache
		this.cachedAccessToken = null;

		if (config?.accessToken) {
			return config.accessToken;
		}

		if (config?.refreshToken && config?.clientId) {
			const token = await this.refreshAccessToken(config);

			this.cachedAccessToken = token;
			this.cachedAccessTokenExpiresAt = Date.now() + TOKEN_TTL_MS;

			return token;
		}

		return '';
	}

	private async refreshAccessToken(config: BuddyClaudeOauthConfigModel): Promise<string> {
		this.logger.debug('Refreshing Claude OAuth access token');

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), TOKEN_REFRESH_TIMEOUT_MS);

		try {
			const response = await fetch(BUDDY_CLAUDE_OAUTH_TOKEN_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					grant_type: 'refresh_token',
					refresh_token: config.refreshToken ?? '',
					client_id: config.clientId ?? '',
					...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
				}),
				signal: controller.signal,
			});

			if (!response.ok) {
				this.logger.error(`OAuth token refresh failed with status ${response.status}`);

				throw new Error(`OAuth token refresh failed: ${response.status}`);
			}

			const data = (await response.json()) as { access_token?: string };

			return data.access_token ?? '';
		} finally {
			clearTimeout(timeoutId);
		}
	}

	private getPluginConfig(): BuddyClaudeOauthConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyClaudeOauthConfigModel>(BUDDY_CLAUDE_OAUTH_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
