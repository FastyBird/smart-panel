import type {
	ChatMessage,
	LlmAssistantToolCallsItem,
	LlmConversationItem,
	LlmConversationToolResult,
	LlmToolResultsItem,
} from './llm-provider.platform';

export const isLlmAssistantToolCallsItem = (item: LlmConversationItem): item is LlmAssistantToolCallsItem =>
	'type' in item && item.type === 'assistant_tool_calls';

export const isLlmToolResultsItem = (item: LlmConversationItem): item is LlmToolResultsItem =>
	'type' in item && item.type === 'tool_results';

export const isChatMessage = (item: LlmConversationItem): item is ChatMessage => !('type' in item);

export function serializeLlmConversationToolResult(result: LlmConversationToolResult): string {
	return JSON.stringify({
		call_id: result.callId,
		tool_name: result.toolName,
		status: result.status,
		message: result.message,
		...(result.data === undefined ? {} : { data: result.data }),
		...(result.errorCode === undefined ? {} : { error_code: result.errorCode }),
		truncated: result.truncated,
	});
}

export function requireProviderCallId(provider: string, providerCallId: string | null): string {
	if (providerCallId === null || providerCallId.length === 0) {
		throw new TypeError(`${provider} tool transcript requires a provider call ID`);
	}

	return providerCallId;
}

/**
 * Validate complete, adjacent call/result groups before any provider request is built.
 * This prevents orphaned or reordered results from reaching strict native protocols.
 */
export function validateLlmConversationItems(items: LlmConversationItem[]): void {
	const seenCallIds = new Set<string>();

	for (let index = 0; index < items.length; index += 1) {
		const item = items[index];

		if (isChatMessage(item)) {
			continue;
		}

		if (isLlmToolResultsItem(item)) {
			throw new TypeError(`Tool result group at index ${index} has no immediately preceding assistant call group`);
		}

		if (item.calls.length === 0) {
			throw new TypeError(`Assistant tool call group at index ${index} must contain at least one call`);
		}

		const resultItem = items[index + 1];

		if (resultItem === undefined || !isLlmToolResultsItem(resultItem)) {
			throw new TypeError(`Assistant tool call group at index ${index} must be immediately followed by its results`);
		}
		if (resultItem.results.length !== item.calls.length) {
			throw new TypeError(`Assistant tool call group at index ${index} must have exactly one result per call`);
		}

		for (const [callIndex, call] of item.calls.entries()) {
			if (call.callId.length === 0 || seenCallIds.has(call.callId)) {
				throw new TypeError(`Tool call at index ${index}:${callIndex} has an empty or duplicate canonical ID`);
			}
			seenCallIds.add(call.callId);

			const result = resultItem.results[callIndex];

			if (
				result.callId !== call.callId ||
				result.providerCallId !== call.providerCallId ||
				result.toolName !== call.name
			) {
				throw new TypeError(`Tool result at index ${index + 1}:${callIndex} does not match its ordered call`);
			}
		}

		index += 1;
	}
}

export const isLlmToolResultError = (result: LlmConversationToolResult): boolean =>
	result.status === 'failed' ||
	result.status === 'timed_out' ||
	result.status === 'denied' ||
	result.status === 'indeterminate' ||
	result.status === 'malformed';
