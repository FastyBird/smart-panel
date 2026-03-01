import { Injectable, Logger } from '@nestjs/common';

import { MessageRole } from '../../../modules/buddy/buddy.constants';
import { ChatMessage, ILlmProvider, LlmOptions } from '../../../modules/buddy/platforms/llm-provider.platform';
import { OAuthTokenManager } from '../../../modules/buddy/platforms/oauth-token-manager';
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

@Injectable()
export class OpenAiCodexProvider implements ILlmProvider {
	private readonly logger = new Logger(OpenAiCodexProvider.name);
	private readonly tokenManager = new OAuthTokenManager({
		tokenUrl: BUDDY_OPENAI_CODEX_TOKEN_URL,
		providerLabel: 'OpenAiCodex',
	});

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
		const accessToken = await this.tokenManager.resolveAccessToken(config);
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

	private getPluginConfig(): BuddyOpenaiCodexConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyOpenaiCodexConfigModel>(BUDDY_OPENAI_CODEX_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
