import { MessageRole } from '../buddy.constants';

import type { ChatMessage } from './llm-provider.platform';

// Module path as variable to prevent TypeScript from statically resolving optional peer dependency
const OPENAI_SDK_MODULE = 'openai';

/**
 * Metadata extracted from an OpenAI API response.
 */
export interface OpenAiSdkResult {
	content: string;
	model: string | null;
	inputTokens: number | null;
	outputTokens: number | null;
	finishReason: string | null;
}

/**
 * Shared OpenAI SDK interaction logic used by all OpenAI-based providers.
 * Handles SDK import, client creation, API call, and response parsing.
 */
export async function sendOpenAiMessage(
	apiKey: string,
	model: string,
	systemPrompt: string,
	messages: ChatMessage[],
	timeout: number,
	maxTokens: number = 1024,
): Promise<OpenAiSdkResult> {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const { default: OpenAI } = await import(OPENAI_SDK_MODULE);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
	const client = new OpenAI({ apiKey, timeout });

	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
	const response = await client.chat.completions.create({
		model,
		max_completion_tokens: maxTokens,
		messages: [
			{ role: 'system' as const, content: systemPrompt },
			...messages.map((m) => ({
				role: m.role === MessageRole.USER ? ('user' as const) : ('assistant' as const),
				content: m.content,
			})),
		],
	});

	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	const usage = response.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;

	return {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		content: (response.choices[0]?.message?.content as string) ?? '',
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		model: (response.model as string) ?? null,
		inputTokens: usage?.prompt_tokens ?? null,
		outputTokens: usage?.completion_tokens ?? null,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		finishReason: (response.choices[0]?.finish_reason as string) ?? null,
	};
}
