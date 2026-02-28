import { Injectable, Logger } from '@nestjs/common';

import { MessageRole } from '../../../modules/buddy/buddy.constants';
import { ChatMessage, ILlmProvider, LlmOptions } from '../../../modules/buddy/platforms/llm-provider.platform';
import { ConfigService } from '../../../modules/config/services/config.service';
import {
	BUDDY_OLLAMA_DEFAULT_MODEL,
	BUDDY_OLLAMA_DEFAULT_URL,
	BUDDY_OLLAMA_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_OLLAMA_PLUGIN_API_TAG_NAME,
	BUDDY_OLLAMA_PLUGIN_NAME,
} from '../buddy-ollama.constants';
import { BuddyOllamaConfigModel } from '../models/config.model';

@Injectable()
export class OllamaProvider implements ILlmProvider {
	private readonly logger = new Logger(OllamaProvider.name);

	constructor(private readonly configService: ConfigService) {}

	getType(): string {
		return BUDDY_OLLAMA_PLUGIN_NAME;
	}

	getName(): string {
		return BUDDY_OLLAMA_PLUGIN_API_TAG_NAME;
	}

	getDescription(): string {
		return BUDDY_OLLAMA_PLUGIN_API_TAG_DESCRIPTION;
	}

	getDefaultModel(): string {
		return BUDDY_OLLAMA_DEFAULT_MODEL;
	}

	async sendMessage(
		systemPrompt: string,
		messages: ChatMessage[],
		_apiKey: string,
		model: string,
		options?: LlmOptions,
	): Promise<string> {
		const config = this.getPluginConfig();
		const baseUrl = config?.baseUrl ?? BUDDY_OLLAMA_DEFAULT_URL;
		const resolvedModel = config?.model ?? model;
		const timeout = options?.timeout ?? 30_000;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			const response = await fetch(`${baseUrl}/api/chat`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: resolvedModel,
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
		} finally {
			clearTimeout(timeoutId);
		}
	}

	private getPluginConfig(): BuddyOllamaConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyOllamaConfigModel>(BUDDY_OLLAMA_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
