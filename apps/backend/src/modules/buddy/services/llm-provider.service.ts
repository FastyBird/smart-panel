import { GatewayTimeoutException, Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { BUDDY_MODULE_NAME, LlmProvider } from '../buddy.constants';
import { BuddyProviderNotConfiguredException } from '../buddy.exceptions';
import { BuddyConfigModel } from '../models/config.model';

export interface ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

export interface LlmOptions {
	timeout?: number;
	maxTokens?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_TOKENS = 1024;

@Injectable()
export class LlmProviderService {
	private readonly logger = new Logger(LlmProviderService.name);

	constructor(private readonly configService: ConfigService) {}

	async sendMessage(systemPrompt: string, messages: ChatMessage[], options?: LlmOptions): Promise<string> {
		const config = this.getConfig();
		const provider = config.llmProvider ?? LlmProvider.NONE;

		if (provider === LlmProvider.NONE) {
			throw new BuddyProviderNotConfiguredException();
		}

		const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;
		const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;

		switch (provider) {
			case LlmProvider.CLAUDE:
				return this.callClaude(systemPrompt, messages, config.apiKey, config.llmModel, timeout, maxTokens);
			case LlmProvider.OPENAI:
				return this.callOpenai(systemPrompt, messages, config.apiKey, config.llmModel, timeout, maxTokens);
			case LlmProvider.OLLAMA:
				return this.callOllama(
					systemPrompt,
					messages,
					config.llmModel,
					config.ollamaUrl ?? 'http://localhost:11434',
					timeout,
				);
			default:
				throw new BuddyProviderNotConfiguredException();
		}
	}

	getConfiguredProvider(): LlmProvider {
		try {
			const config = this.getConfig();

			return config.llmProvider ?? LlmProvider.NONE;
		} catch {
			return LlmProvider.NONE;
		}
	}

	private getConfig(): BuddyConfigModel {
		return this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME);
	}

	/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
	private async callClaude(
		systemPrompt: string,
		messages: ChatMessage[],
		apiKey: string | null,
		model: string | null,
		timeout: number,
		maxTokens: number,
	): Promise<string> {
		if (!apiKey) {
			throw new BuddyProviderNotConfiguredException();
		}

		try {
			const { default: Anthropic } = await import('@anthropic-ai/sdk');
			const client = new Anthropic({ apiKey, timeout });

			const response = await client.messages.create({
				model: model ?? 'claude-sonnet-4-20250514',
				max_tokens: maxTokens,
				system: systemPrompt,
				messages: messages.map((m: ChatMessage) => ({
					role: m.role === 'system' ? ('user' as const) : m.role,
					content: m.content,
				})),
			});

			const textBlock = response.content.find((block: { type: string }) => block.type === 'text');

			return textBlock && 'text' in textBlock ? (textBlock.text as string) : '';
		} catch (error) {
			if (error instanceof BuddyProviderNotConfiguredException) throw error;
			this.logger.warn(`Claude API error: ${String(error)}`);

			if (String(error).includes('timeout') || String(error).includes('ETIMEDOUT')) {
				throw new GatewayTimeoutException('AI provider timeout');
			}

			throw error;
		}
	}

	private async callOpenai(
		systemPrompt: string,
		messages: ChatMessage[],
		apiKey: string | null,
		model: string | null,
		timeout: number,
		maxTokens: number,
	): Promise<string> {
		if (!apiKey) {
			throw new BuddyProviderNotConfiguredException();
		}

		try {
			const { default: OpenAI } = await import('openai');
			const client = new OpenAI({ apiKey, timeout });

			const response = await client.chat.completions.create({
				model: model ?? 'gpt-4o',
				max_tokens: maxTokens,
				messages: [{ role: 'system' as const, content: systemPrompt }, ...messages],
			});

			return (response.choices[0]?.message?.content as string) ?? '';
		} catch (error) {
			if (error instanceof BuddyProviderNotConfiguredException) throw error;
			this.logger.warn(`OpenAI API error: ${String(error)}`);

			if (String(error).includes('timeout') || String(error).includes('ETIMEDOUT')) {
				throw new GatewayTimeoutException('AI provider timeout');
			}

			throw error;
		}
	}
	/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

	private async callOllama(
		systemPrompt: string,
		messages: ChatMessage[],
		model: string | null,
		baseUrl: string,
		timeout: number,
	): Promise<string> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout);

		try {
			const ollamaMessages = [
				{ role: 'system', content: systemPrompt },
				...messages.map((m) => ({ role: m.role, content: m.content })),
			];

			const response = await fetch(`${baseUrl}/api/chat`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: model ?? 'llama3',
					messages: ollamaMessages,
					stream: false,
				}),
				signal: controller.signal,
			});

			if (!response.ok) {
				throw new Error(`Ollama API returned ${String(response.status)}`);
			}

			const data = (await response.json()) as { message?: { content?: string } };

			return data.message?.content ?? '';
		} catch (error) {
			this.logger.warn(`Ollama API error: ${String(error)}`);

			if (String(error).includes('abort') || String(error).includes('timeout')) {
				throw new GatewayTimeoutException('AI provider timeout');
			}

			throw error;
		} finally {
			clearTimeout(timer);
		}
	}
}
