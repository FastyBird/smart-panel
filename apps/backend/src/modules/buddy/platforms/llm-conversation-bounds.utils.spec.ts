import {
	BUDDY_MAX_ACTIVE_TOOL_TRANSCRIPT_JSON_BYTES,
	BUDDY_MAX_PROVIDER_ITEMS_JSON_BYTES,
	BUDDY_MAX_PROVIDER_ITEMS_PER_ITERATION,
	BUDDY_MAX_TOOL_BATCH_JSON_BYTES,
	BUDDY_MAX_TOOL_ITEMS_PER_ITERATION,
	BUDDY_MAX_TOOL_ITEMS_PER_TURN,
	BUDDY_MAX_TOOL_ITEM_JSON_BYTES,
} from '../buddy.constants';

import {
	admitBuddyToolResponse,
	canReserveBuddyToolResultGroup,
	fitBuddyToolResultGroup,
	measureJsonUtf8Bytes,
} from './llm-conversation-bounds.utils';
import type {
	LlmAssistantToolCallsItem,
	LlmConversationProviderItem,
	LlmConversationToolResult,
	LlmResponse,
	LlmResponseMeta,
} from './llm-provider.platform';

const meta: LlmResponseMeta = {
	provider: 'provider',
	model: 'model',
	inputTokens: null,
	outputTokens: null,
	finishReason: null,
	durationMs: null,
	cacheReadTokens: null,
	cacheWriteTokens: null,
};

const responseWithCalls = (count: number): LlmResponse => ({
	content: '',
	toolCalls: Array.from({ length: count }, (_, index) => ({ id: `p-${index}`, name: 'read', arguments: {} })),
	meta,
});

describe('LLM conversation bounds', () => {
	it('accepts the literal iteration and turn item boundaries and rejects the next item', () => {
		expect(admitBuddyToolResponse(responseWithCalls(BUDDY_MAX_TOOL_ITEMS_PER_ITERATION), 0)).toEqual({
			accepted: true,
			itemCount: BUDDY_MAX_TOOL_ITEMS_PER_ITERATION,
		});
		expect(admitBuddyToolResponse(responseWithCalls(BUDDY_MAX_TOOL_ITEMS_PER_ITERATION + 1), 0)).toEqual({
			accepted: false,
			reason: 'iteration_items',
		});
		expect(
			admitBuddyToolResponse(responseWithCalls(BUDDY_MAX_TOOL_ITEMS_PER_ITERATION), BUDDY_MAX_TOOL_ITEMS_PER_TURN - 8),
		).toEqual({ accepted: true, itemCount: BUDDY_MAX_TOOL_ITEMS_PER_ITERATION });
		expect(
			admitBuddyToolResponse(responseWithCalls(BUDDY_MAX_TOOL_ITEMS_PER_ITERATION), BUDDY_MAX_TOOL_ITEMS_PER_TURN - 7),
		).toEqual({ accepted: false, reason: 'turn_items' });
	});

	it('rejects a non-serializable or oversized call before execution', () => {
		const cyclic: Record<string, unknown> = {};

		cyclic.self = cyclic;

		expect(
			admitBuddyToolResponse({ content: '', toolCalls: [{ id: 'p-1', name: 'read', arguments: cyclic }], meta }, 0),
		).toEqual({ accepted: false, reason: 'non_serializable' });
		expect(
			admitBuddyToolResponse(
				{
					content: '',
					toolCalls: [{ id: 'p-1', name: 'read', arguments: { value: 'x'.repeat(BUDDY_MAX_TOOL_ITEM_JSON_BYTES) } }],
					meta,
				},
				0,
			),
		).toEqual({ accepted: false, reason: 'tool_item_bytes' });
	});

	it('accepts an exact-size call and rejects one additional UTF-8 byte', () => {
		const baseCall = { id: 'p-1', name: 'read', arguments: { value: '' } };
		const baseBytes = measureJsonUtf8Bytes(baseCall) ?? 0;
		const exactCall = {
			...baseCall,
			arguments: { value: 'x'.repeat(BUDDY_MAX_TOOL_ITEM_JSON_BYTES - baseBytes) },
		};

		expect(measureJsonUtf8Bytes(exactCall)).toBe(BUDDY_MAX_TOOL_ITEM_JSON_BYTES);
		expect(admitBuddyToolResponse({ content: '', toolCalls: [exactCall], meta }, 0)).toEqual({
			accepted: true,
			itemCount: 1,
		});
		expect(
			admitBuddyToolResponse(
				{ content: '', toolCalls: [{ ...exactCall, arguments: { value: `${exactCall.arguments.value}x` } }], meta },
				0,
			),
		).toEqual({ accepted: false, reason: 'tool_item_bytes' });
	});

	it('treats provider continuation as atomic and bounded', () => {
		const providerItems: LlmConversationProviderItem[] = Array.from(
			{ length: BUDDY_MAX_PROVIDER_ITEMS_PER_ITERATION + 1 },
			(_, outputIndex) => ({
				provider: 'provider',
				outputIndex,
				item: {
					type: 'reasoning',
					id: `reasoning-${outputIndex}`,
					summary: [],
					encrypted_content: 'state',
				},
			}),
		);

		expect(admitBuddyToolResponse({ ...responseWithCalls(1), providerItems }, 0)).toEqual({
			accepted: false,
			reason: 'provider_item_count',
		});
		expect(
			admitBuddyToolResponse(
				{
					...responseWithCalls(1),
					providerItems: [
						{
							provider: 'provider',
							outputIndex: 0,
							item: {
								type: 'reasoning',
								id: 'reasoning',
								summary: [],
								encrypted_content: 'x'.repeat(BUDDY_MAX_PROVIDER_ITEMS_JSON_BYTES),
							},
						},
					],
				},
				0,
			),
		).toEqual({ accepted: false, reason: 'provider_item_bytes' });

		const baseProviderItem: LlmConversationProviderItem = {
			provider: 'provider',
			outputIndex: 0,
			item: { type: 'reasoning', id: 'reasoning', summary: [], encrypted_content: '' },
		};
		const baseProviderBytes = measureJsonUtf8Bytes([baseProviderItem]) ?? 0;
		const exactProviderItem: LlmConversationProviderItem = {
			provider: 'provider',
			outputIndex: 0,
			item: {
				type: 'reasoning',
				id: 'reasoning',
				summary: [],
				encrypted_content: 'x'.repeat(BUDDY_MAX_PROVIDER_ITEMS_JSON_BYTES - baseProviderBytes),
			},
		};

		expect(measureJsonUtf8Bytes([exactProviderItem])).toBe(BUDDY_MAX_PROVIDER_ITEMS_JSON_BYTES);
		expect(admitBuddyToolResponse({ ...responseWithCalls(1), providerItems: [exactProviderItem] }, 0)).toEqual({
			accepted: true,
			itemCount: 1,
		});
		expect(
			admitBuddyToolResponse(
				{
					...responseWithCalls(1),
					providerItems: [
						{
							provider: 'provider',
							outputIndex: 0,
							item: {
								type: 'reasoning',
								id: 'reasoning',
								summary: [],
								encrypted_content: `${'x'.repeat(BUDDY_MAX_PROVIDER_ITEMS_JSON_BYTES - baseProviderBytes)}x`,
							},
						},
					],
				},
				0,
			),
		).toEqual({ accepted: false, reason: 'provider_item_bytes' });
	});

	it('reserves the complete canonical batch before dispatch', () => {
		const callItem: LlmAssistantToolCallsItem = {
			type: 'assistant_tool_calls',
			content: '',
			calls: Array.from({ length: 5 }, (_, index) => ({
				callId: `c-${index}`,
				providerCallId: `${'p'.repeat(12_000)}${index}`,
				name: 'read',
				arguments: {},
			})),
		};

		expect(measureJsonUtf8Bytes(callItem)).toBeLessThan(64 * 1024);
		expect(canReserveBuddyToolResultGroup(callItem, 0)).toBe(false);
	});

	it('accepts the exact canonical batch and cumulative boundaries and rejects one more byte', () => {
		const baseCallItem: LlmAssistantToolCallsItem = {
			type: 'assistant_tool_calls',
			content: '',
			calls: [canonicalCall('c-1')],
		};
		const reservedResult = {
			type: 'tool_results' as const,
			results: [
				{
					...canonicalResult('c-1'),
					status: 'indeterminate' as const,
					message: 'Tool result detail omitted to fit the active-turn limit',
					truncated: true,
				},
			],
		};
		const baseGroupBytes = measureJsonUtf8Bytes([baseCallItem, reservedResult]) ?? 0;
		const exactCallItem = {
			...baseCallItem,
			content: 'x'.repeat(BUDDY_MAX_TOOL_BATCH_JSON_BYTES - baseGroupBytes),
		};
		const exactGroupBytes = measureJsonUtf8Bytes([exactCallItem, reservedResult]) ?? 0;
		const exactCumulativeStart = BUDDY_MAX_ACTIVE_TOOL_TRANSCRIPT_JSON_BYTES - exactGroupBytes + 1;

		expect(exactGroupBytes).toBe(BUDDY_MAX_TOOL_BATCH_JSON_BYTES);
		expect(canReserveBuddyToolResultGroup(exactCallItem, 0)).toBe(true);
		expect(canReserveBuddyToolResultGroup({ ...exactCallItem, content: `${exactCallItem.content}x` }, 0)).toBe(false);
		expect(canReserveBuddyToolResultGroup(exactCallItem, exactCumulativeStart)).toBe(true);
		expect(canReserveBuddyToolResultGroup(exactCallItem, exactCumulativeStart + 1)).toBe(false);
	});

	it('drops structured data from the end while preserving every correlated result', () => {
		const callItem: LlmAssistantToolCallsItem = {
			type: 'assistant_tool_calls',
			content: '',
			calls: [canonicalCall('c-1'), canonicalCall('c-2')],
		};
		const results: LlmConversationToolResult[] = [
			canonicalResult('c-1', { value: 'a'.repeat(32 * 1024) }),
			{
				...canonicalResult('c-2', { value: 'b'.repeat(32 * 1024) }),
				status: 'timed_out',
				errorCode: 'TIMEOUT',
			},
		];
		const bounded = fitBuddyToolResultGroup(callItem, results, 0);

		expect(bounded).not.toBeNull();
		expect(bounded?.item.results).toHaveLength(2);
		expect(bounded?.item.results[0]).toHaveProperty('data');
		expect(bounded?.item.results[1]).toEqual(
			expect.objectContaining({
				callId: 'c-2',
				providerCallId: 'c-2',
				toolName: 'read',
				status: 'timed_out',
				errorCode: 'TIMEOUT',
				truncated: true,
			}),
		);
		expect(bounded?.item.results[1]).not.toHaveProperty('data');
		expect(results[1]).toHaveProperty('data');
	});

	it('refuses execution when even the minimum correlated result group cannot fit the turn', () => {
		const callItem: LlmAssistantToolCallsItem = {
			type: 'assistant_tool_calls',
			content: '',
			calls: [canonicalCall('c-1')],
		};

		expect(canReserveBuddyToolResultGroup(callItem, BUDDY_MAX_ACTIVE_TOOL_TRANSCRIPT_JSON_BYTES)).toBe(false);
		expect(
			fitBuddyToolResultGroup(callItem, [canonicalResult('c-1')], BUDDY_MAX_ACTIVE_TOOL_TRANSCRIPT_JSON_BYTES),
		).toBe(null);
		expect(measureJsonUtf8Bytes({ text: 'Ž' })).toBe(Buffer.byteLength(JSON.stringify({ text: 'Ž' }), 'utf8'));
	});

	it('accounts multiple canonical groups as one flattened JSON array', () => {
		const firstCall: LlmAssistantToolCallsItem = {
			type: 'assistant_tool_calls',
			content: '',
			calls: [canonicalCall('c-1')],
		};
		const secondCall: LlmAssistantToolCallsItem = {
			type: 'assistant_tool_calls',
			content: '',
			calls: [canonicalCall('c-2')],
		};
		const first = fitBuddyToolResultGroup(firstCall, [canonicalResult('c-1')], 0);
		const second = fitBuddyToolResultGroup(secondCall, [canonicalResult('c-2')], first?.nextActiveTranscriptBytes ?? 0);
		const flattenedBytes = measureJsonUtf8Bytes([firstCall, first?.item, secondCall, second?.item]);

		expect(first).not.toBeNull();
		expect(second).not.toBeNull();
		expect(second?.nextActiveTranscriptBytes).toBe(flattenedBytes);
	});
});

function canonicalCall(callId: string) {
	return { callId, providerCallId: callId, name: 'read', arguments: {} };
}

function canonicalResult(callId: string, data?: Record<string, unknown>): LlmConversationToolResult {
	return {
		callId,
		providerCallId: callId,
		toolName: 'read',
		status: 'completed',
		message: 'done',
		...(data === undefined ? {} : { data }),
		truncated: false,
	};
}
