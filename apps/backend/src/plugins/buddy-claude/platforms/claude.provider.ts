import { Injectable, Logger } from '@nestjs/common';

import { MessageRole } from '../../../modules/buddy/buddy.constants';
import { ChatMessage, ILlmProvider, LlmOptions } from '../../../modules/buddy/platforms/llm-provider.platform';
import { ConfigService } from '../../../modules/config/services/config.service';
import {
	BUDDY_CLAUDE_DEFAULT_MODEL,
	BUDDY_CLAUDE_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_CLAUDE_PLUGIN_API_TAG_NAME,
	BUDDY_CLAUDE_PLUGIN_NAME,
	BUDDY_CLAUDE_PLUGIN_TYPE,
} from '../buddy-claude.constants';
import { BuddyClaudeConfigModel } from '../models/config.model';

// Module path as variable to prevent TypeScript from statically resolving optional peer dependency
const ANTHROPIC_SDK_MODULE = '@anthropic-ai/sdk';

@Injectable()
export class ClaudeProvider implements ILlmProvider {
	private readonly logger = new Logger(ClaudeProvider.name);

	constructor(private readonly configService: ConfigService) {}

	getType(): string {
		return BUDDY_CLAUDE_PLUGIN_TYPE;
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
		_apiKey: string,
		model: string,
		options?: LlmOptions,
	): Promise<string> {
		const config = this.getPluginConfig();
		const apiKey = config?.apiKey ?? _apiKey;
		const timeout = options?.timeout ?? 30_000;

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const { default: Anthropic } = await import(ANTHROPIC_SDK_MODULE);
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
		const client = new Anthropic({ apiKey, timeout });

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
		const response = await client.messages.create({
			model,
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

	private getPluginConfig(): BuddyClaudeConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyClaudeConfigModel>(BUDDY_CLAUDE_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
