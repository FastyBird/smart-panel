import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { BUDDY_MODULE_NAME, LlmProvider, MessageRole } from '../buddy.constants';
import { BuddyProviderNotConfiguredException, BuddyProviderTimeoutException } from '../buddy.exceptions';
import { BuddyConfigModel } from '../models/config.model';

export interface ChatMessage {
	role: MessageRole;
	content: string;
}

export interface LlmOptions {
	timeout?: number;
	model?: string;
}

const DEFAULT_TIMEOUT = 30_000;

const DEFAULT_MODELS: Record<string, string> = {
	[LlmProvider.CLAUDE]: 'claude-sonnet-4-20250514',
	[LlmProvider.OPENAI]: 'gpt-4o',
	[LlmProvider.OLLAMA]: 'llama3',
};

// Module paths as variables to prevent TypeScript from statically resolving optional peer dependencies
const ANTHROPIC_SDK_MODULE = '@anthropic-ai/sdk';
const OPENAI_SDK_MODULE = 'openai';

@Injectable()
export class LlmProviderService {
	private readonly logger = new Logger(LlmProviderService.name);

	constructor(private readonly configService: ConfigService) {}

	async sendMessage(systemPrompt: string, messages: ChatMessage[], options?: LlmOptions): Promise<string> {
		const config = this.getConfig();

		if (config.provider === LlmProvider.NONE || !config.provider) {
			throw new BuddyProviderNotConfiguredException();
		}

		const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
		const model = options?.model ?? config.model ?? DEFAULT_MODELS[config.provider] ?? '';

		switch (config.provider) {
			case LlmProvider.CLAUDE:
				return this.sendClaude(systemPrompt, messages, config.apiKey ?? '', model, timeout);
			case LlmProvider.OPENAI:
				return this.sendOpenAi(systemPrompt, messages, config.apiKey ?? '', model, timeout);
			case LlmProvider.OLLAMA:
				return this.sendOllama(systemPrompt, messages, model, timeout);
			default:
				throw new BuddyProviderNotConfiguredException();
		}
	}

	private getConfig(): BuddyConfigModel {
		try {
			return this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME);
		} catch {
			return Object.assign(new BuddyConfigModel(), { provider: LlmProvider.NONE });
		}
	}

	private async sendClaude(
		systemPrompt: string,
		messages: ChatMessage[],
		apiKey: string,
		model: string,
		timeout: number,
	): Promise<string> {
		try {
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
		} catch (error) {
			return this.handleProviderError('Claude', error, timeout);
		}
	}

	private async sendOpenAi(
		systemPrompt: string,
		messages: ChatMessage[],
		apiKey: string,
		model: string,
		timeout: number,
	): Promise<string> {
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const { default: OpenAI } = await import(OPENAI_SDK_MODULE);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
			const client = new OpenAI({ apiKey, timeout });

			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
			const response = await client.chat.completions.create({
				model,
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
		} catch (error) {
			return this.handleProviderError('OpenAI', error, timeout);
		}
	}

	private async sendOllama(
		systemPrompt: string,
		messages: ChatMessage[],
		model: string,
		timeout: number,
	): Promise<string> {
		const config = this.getConfig();
		const baseUrl: string = config.ollamaUrl ?? 'http://localhost:11434';

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			const response = await fetch(`${baseUrl}/api/chat`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model,
					stream: false,
					messages: [
						{ role: 'system', content: systemPrompt },
						...messages.map((m) => ({
							role: m.role === MessageRole.USER ? 'user' : 'assistant',
							content: m.content,
						})),
					],
				}),
				signal: controller.signal,
			});

			if (!response.ok) {
				throw new Error(`Ollama responded with status ${response.status}`);
			}

			const data = (await response.json()) as { message?: { content?: string } };

			return data.message?.content ?? '';
		} catch (error) {
			return this.handleProviderError('Ollama', error, timeout);
		} finally {
			clearTimeout(timeoutId);
		}
	}

	private handleProviderError(provider: string, error: unknown, timeout: number): never {
		const err = error as Error;
		const name = err.name ?? '';
		const message = err.message ?? '';

		const isTimeout =
			name === 'AbortError' ||
			name.includes('Timeout') ||
			message.includes('timeout') ||
			message.includes('timed out') ||
			message.includes('ETIMEDOUT') ||
			message.includes('ECONNABORTED');

		if (isTimeout) {
			this.logger.error(`${provider} provider timeout after ${timeout}ms`);

			throw new BuddyProviderTimeoutException();
		}

		this.logger.error(`${provider} provider error: ${message}`);

		throw err;
	}
}
