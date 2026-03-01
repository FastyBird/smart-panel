import { MessageRole } from '../buddy.constants';

import type { ChatMessage } from './llm-provider.platform';

// Module path as variable to prevent TypeScript from statically resolving optional peer dependency
const ANTHROPIC_SDK_MODULE = '@anthropic-ai/sdk';

/**
 * Shared Anthropic SDK interaction logic used by all Claude-based providers.
 * Handles SDK import, client creation, API call, and response parsing.
 */
export async function sendAnthropicMessage(
	apiKey: string,
	model: string,
	systemPrompt: string,
	messages: ChatMessage[],
	timeout: number,
): Promise<string> {
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
