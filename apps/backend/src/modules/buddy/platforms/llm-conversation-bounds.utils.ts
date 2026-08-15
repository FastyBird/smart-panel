import {
	BUDDY_MAX_ACTIVE_TOOL_TRANSCRIPT_JSON_BYTES,
	BUDDY_MAX_PROVIDER_ITEMS_JSON_BYTES,
	BUDDY_MAX_PROVIDER_ITEMS_PER_ITERATION,
	BUDDY_MAX_TOOL_BATCH_JSON_BYTES,
	BUDDY_MAX_TOOL_ITEMS_PER_ITERATION,
	BUDDY_MAX_TOOL_ITEMS_PER_TURN,
	BUDDY_MAX_TOOL_ITEM_JSON_BYTES,
	BUDDY_MAX_TOOL_RESULT_GROUP_JSON_BYTES,
	MessageRole,
} from '../buddy.constants';

import type {
	LlmAssistantToolCallsItem,
	LlmConversationToolResult,
	LlmResponse,
	LlmToolResultsItem,
} from './llm-provider.platform';

export type BuddyToolResponseLimitReason =
	| 'iteration_items'
	| 'turn_items'
	| 'tool_item_bytes'
	| 'tool_batch_bytes'
	| 'provider_item_count'
	| 'provider_item_bytes'
	| 'non_serializable';

export type BuddyToolResponseAdmission =
	| { accepted: true; itemCount: number }
	| { accepted: false; reason: BuddyToolResponseLimitReason };

export interface BoundedToolResultGroup {
	item: LlmToolResultsItem;
	nextActiveTranscriptBytes: number;
}

export const BUDDY_TRUNCATED_TOOL_RESULT_MESSAGE = 'Tool result detail omitted to fit the active-turn limit';

export function measureJsonUtf8Bytes(value: unknown): number | null {
	try {
		const serialized = JSON.stringify(value);

		return serialized === undefined ? null : Buffer.byteLength(serialized, 'utf8');
	} catch {
		return null;
	}
}

export function admitBuddyToolResponse(response: LlmResponse, currentTurnItems: number): BuddyToolResponseAdmission {
	const toolCalls = response.toolCalls ?? [];
	const toolErrors = response.toolErrors ?? [];
	const providerItems = response.providerItems ?? [];
	const itemCount = toolCalls.length + toolErrors.length;

	if (itemCount > BUDDY_MAX_TOOL_ITEMS_PER_ITERATION) {
		return { accepted: false, reason: 'iteration_items' };
	}
	if (currentTurnItems + itemCount > BUDDY_MAX_TOOL_ITEMS_PER_TURN) {
		return { accepted: false, reason: 'turn_items' };
	}
	if (providerItems.length > BUDDY_MAX_PROVIDER_ITEMS_PER_ITERATION) {
		return { accepted: false, reason: 'provider_item_count' };
	}

	for (const item of [...toolCalls, ...toolErrors]) {
		const bytes = measureJsonUtf8Bytes(item);

		if (bytes === null) {
			return { accepted: false, reason: 'non_serializable' };
		}
		if (bytes > BUDDY_MAX_TOOL_ITEM_JSON_BYTES) {
			return { accepted: false, reason: 'tool_item_bytes' };
		}
	}

	const batchBytes = measureJsonUtf8Bytes({ content: response.content, toolCalls, toolErrors });

	if (batchBytes === null) {
		return { accepted: false, reason: 'non_serializable' };
	}
	if (batchBytes > BUDDY_MAX_TOOL_BATCH_JSON_BYTES) {
		return { accepted: false, reason: 'tool_batch_bytes' };
	}

	const providerBytes = measureJsonUtf8Bytes(providerItems);

	if (providerBytes === null) {
		return { accepted: false, reason: 'non_serializable' };
	}
	if (providerBytes > BUDDY_MAX_PROVIDER_ITEMS_JSON_BYTES) {
		return { accepted: false, reason: 'provider_item_bytes' };
	}

	return { accepted: true, itemCount };
}

export function canReserveBuddyToolResultGroup(
	callItem: LlmAssistantToolCallsItem,
	activeTranscriptBytes: number,
): boolean {
	const minimalResults: LlmConversationToolResult[] = callItem.calls.map((call) => ({
		callId: call.callId,
		providerCallId: call.providerCallId,
		toolName: call.name,
		status: 'indeterminate',
		message: BUDDY_TRUNCATED_TOOL_RESULT_MESSAGE,
		truncated: true,
	}));
	const resultItem: LlmToolResultsItem = { type: 'tool_results', results: minimalResults };
	const resultBytes = measureJsonUtf8Bytes(resultItem);
	const groupBytes = measureJsonUtf8Bytes([callItem, resultItem]);

	return (
		resultBytes !== null &&
		groupBytes !== null &&
		resultBytes <= BUDDY_MAX_TOOL_RESULT_GROUP_JSON_BYTES &&
		groupBytes <= BUDDY_MAX_TOOL_BATCH_JSON_BYTES &&
		nextActiveTranscriptBytes(activeTranscriptBytes, groupBytes) <= BUDDY_MAX_ACTIVE_TOOL_TRANSCRIPT_JSON_BYTES
	);
}

export function fitBuddyToolResultGroup(
	callItem: LlmAssistantToolCallsItem,
	results: LlmConversationToolResult[],
	activeTranscriptBytes: number,
): BoundedToolResultGroup | null {
	const boundedResults = results.map((result) => ({ ...result }));
	const fit = (): BoundedToolResultGroup | null => {
		const item: LlmToolResultsItem = { type: 'tool_results', results: boundedResults };
		const resultBytes = measureJsonUtf8Bytes(item);
		const groupBytes = measureJsonUtf8Bytes([callItem, item]);

		if (resultBytes === null || groupBytes === null) {
			return null;
		}

		const nextBytes = nextActiveTranscriptBytes(activeTranscriptBytes, groupBytes);

		return resultBytes <= BUDDY_MAX_TOOL_RESULT_GROUP_JSON_BYTES &&
			groupBytes <= BUDDY_MAX_TOOL_BATCH_JSON_BYTES &&
			nextBytes <= BUDDY_MAX_ACTIVE_TOOL_TRANSCRIPT_JSON_BYTES
			? { item, nextActiveTranscriptBytes: nextBytes }
			: null;
	};

	let fitted = fit();

	if (fitted !== null) {
		return fitted;
	}

	for (let resultIndex = boundedResults.length - 1; resultIndex >= 0; resultIndex -= 1) {
		const result = boundedResults[resultIndex];

		if (result.data !== undefined) {
			delete result.data;
			result.truncated = true;
			fitted = fit();

			if (fitted !== null) {
				return fitted;
			}
		}
	}

	for (let resultIndex = boundedResults.length - 1; resultIndex >= 0; resultIndex -= 1) {
		const result = boundedResults[resultIndex];

		result.message = BUDDY_TRUNCATED_TOOL_RESULT_MESSAGE;
		delete result.errorCode;
		result.truncated = true;
		fitted = fit();

		if (fitted !== null) {
			return fitted;
		}
	}

	return null;
}

export function fitsBuddyLegacyToolTranscript(value: unknown, activeTranscriptBytes: number): number | null {
	const bytes = measureJsonUtf8Bytes(value);
	const nextBytes = bytes === null ? null : nextActiveTranscriptBytes(activeTranscriptBytes, bytes);

	if (
		bytes === null ||
		bytes > BUDDY_MAX_TOOL_RESULT_GROUP_JSON_BYTES ||
		nextBytes === null ||
		nextBytes > BUDDY_MAX_ACTIVE_TOOL_TRANSCRIPT_JSON_BYTES
	) {
		return null;
	}

	return nextBytes;
}

export function canReserveBuddyLegacyToolTranscript(response: LlmResponse, activeTranscriptBytes: number): boolean {
	const summaries = [
		...(response.toolErrors ?? []).map(
			(error) => `Tool "${error.toolName}" (id=${error.toolCallId}): FAILED — ${BUDDY_TRUNCATED_TOOL_RESULT_MESSAGE}`,
		),
		...(response.toolCalls ?? []).map(
			(call) => `Tool "${call.name}" (id=${call.id}): SUCCESS — ${BUDDY_TRUNCATED_TOOL_RESULT_MESSAGE}`,
		),
	];
	const assistantContent = response.content
		? response.content
		: `[Executing tools: ${[
				...(response.toolCalls ?? []).map((call) => call.name),
				...(response.toolErrors ?? []).map((error) => `${error.toolName} (parse error)`),
			].join(', ')}]`;
	const messages = [
		{ role: MessageRole.ASSISTANT, content: assistantContent },
		{
			role: MessageRole.USER,
			content: `[Tool execution results]\n${summaries.join('\n')}\n\nPlease provide a natural language response based on these results.`,
		},
	];

	return fitsBuddyLegacyToolTranscript(messages, activeTranscriptBytes) !== null;
}

function nextActiveTranscriptBytes(currentBytes: number, groupBytes: number): number {
	return currentBytes === 0 ? groupBytes : currentBytes + groupBytes - 1;
}
