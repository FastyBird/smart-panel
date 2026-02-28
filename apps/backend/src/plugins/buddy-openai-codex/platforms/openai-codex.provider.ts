import { Injectable, Logger } from '@nestjs/common';

import { MessageRole } from '../../../modules/buddy/buddy.constants';
import { ChatMessage, ILlmProvider, LlmOptions } from '../../../modules/buddy/platforms/llm-provider.platform';
import { ConfigService } from '../../../modules/config/services/config.service';
import {
	BUDDY_OPENAI_CODEX_DEFAULT_MODEL,
	BUDDY_OPENAI_CODEX_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_OPENAI_CODEX_PLUGIN_API_TAG_NAME,
	BUDDY_OPENAI_CODEX_PLUGIN_NAME,
	BUDDY_OPENAI_CODEX_TOKEN_URL,
} from '../buddy-openai-codex.constants';
import { BuddyOpenaiCodexConfigModel } from '../models/config.model';

// Module path as variable to prevent TypeScript from statically resolving optional peer dependency
const OPENAI_SDK_MODULE = 'openai';

/** Cached tokens are considered expired after this many milliseconds (50 minutes). */
const TOKEN_TTL_MS = 50 * 60 * 1000;
const TOKEN_REFRESH_TIMEOUT_MS = 10_000;

@Injectable()
export class OpenAiCodexProvider implements ILlmProvider {
	private readonly logger = new Logger(OpenAiCodexProvider.name);
	private cachedAccessToken: string | null = null;
	private cachedAccessTokenExpiresAt = 0;

	constructor(private readonly configService: ConfigService) {}

	getType(): string {
		return BUDDY_OPENAI_CODEX_PLUGIN_NAME;
	}

	getName(): string {
		return BUDDY_OPENAI_CODEX_PLUGIN_API_TAG_NAME;
	}

	getDescription(): string {
		return BUDDY_OPENAI_CODEX_PLUGIN_API_TAG_DESCRIPTION;
	}

	getDefaultModel(): string {
		return BUDDY_OPENAI_CODEX_DEFAULT_MODEL;
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
		const { default: OpenAI } = await import(OPENAI_SDK_MODULE);
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
		const client = new OpenAI({ apiKey: accessToken, timeout });

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

	private async resolveAccessToken(config: BuddyOpenaiCodexConfigModel | null): Promise<string> {
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

	private async refreshAccessToken(config: BuddyOpenaiCodexConfigModel): Promise<string> {
		this.logger.debug('Refreshing OpenAI Codex OAuth access token');

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), TOKEN_REFRESH_TIMEOUT_MS);

		try {
			const response = await fetch(BUDDY_OPENAI_CODEX_TOKEN_URL, {
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

	private getPluginConfig(): BuddyOpenaiCodexConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyOpenaiCodexConfigModel>(BUDDY_OPENAI_CODEX_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
