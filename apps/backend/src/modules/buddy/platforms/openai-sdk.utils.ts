import type { LlmToolCall, ToolDefinition } from '../../tools/platforms/tool-provider.platform';
import { MessageRole } from '../buddy.constants';

import type { ChatMessage } from './llm-provider.platform';

// Module path as variable to prevent TypeScript from statically resolving optional peer dependency
const OPENAI_SDK_MODULE = 'openai';

/**
 * Metadata extracted from an OpenAI API response.
 */
export interface OpenAiSdkResult {
	content: string;
	toolCalls?: LlmToolCall[];
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
	tools?: ToolDefinition[],
): Promise<OpenAiSdkResult> {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const { default: OpenAI } = await import(OPENAI_SDK_MODULE);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
	const client = new OpenAI({ apiKey, timeout });

	// Build the request payload
	const requestPayload: Record<string, unknown> = {
		model,
		max_completion_tokens: maxTokens,
		messages: [
			{ role: 'system' as const, content: systemPrompt },
			...messages.map((m) => ({
				role: m.role === MessageRole.USER ? ('user' as const) : ('assistant' as const),
				content: m.content,
			})),
		],
	};

	if (tools && tools.length > 0) {
		requestPayload.tools = tools.map((t) => ({
			type: 'function',
			function: {
				name: t.name,
				description: t.description,
				parameters: t.parameters,
			},
		}));
	}

	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
	const response = await client.chat.completions.create(requestPayload);

	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	const message = response.choices[0]?.message as
		| {
				content?: string | null;
				tool_calls?: Array<{
					id: string;
					function: { name: string; arguments: string };
				}>;
		  }
		| undefined;

	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	const usage = response.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;

	// Extract tool calls if present
	let toolCalls: LlmToolCall[] | undefined;

	if (message?.tool_calls && message.tool_calls.length > 0) {
		toolCalls = [];

		for (const tc of message.tool_calls) {
			try {
				toolCalls.push({
					id: tc.id,
					name: tc.function.name,
					arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
				});
			} catch (parseError) {
				// eslint-disable-next-line no-console
				console.warn(`Skipping tool call "${tc.function.name}" with malformed JSON arguments: ${String(parseError)}`);
			}
		}

		if (toolCalls.length === 0) {
			toolCalls = undefined;
		}
	}

	return {
		content: message?.content ?? '',
		toolCalls,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		model: (response.model as string) ?? null,
		inputTokens: usage?.prompt_tokens ?? null,
		outputTokens: usage?.completion_tokens ?? null,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		finishReason: (response.choices[0]?.finish_reason as string) ?? null,
	};
}
