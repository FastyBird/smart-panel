import { MessageRole } from '../buddy.constants';

import { buildAnthropicRequestPayload } from './anthropic-sdk.utils';
import { serializeLlmConversationToolResult, validateLlmConversationItems } from './llm-conversation.utils';
import type { LlmConversationItem, LlmConversationToolResult } from './llm-provider.platform';
import { buildOpenAiRequestPayload } from './openai-sdk.utils';

describe('native tool transcript serialization', () => {
	const firstResult: LlmConversationToolResult = {
		callId: 'call-1',
		providerCallId: 'provider-call-1',
		toolName: 'read_device',
		status: 'completed',
		message: 'Device read',
		data: { value: 21.5, unit: 'celsius' },
		truncated: false,
	};
	const secondResult: LlmConversationToolResult = {
		callId: 'call-2',
		providerCallId: 'provider-call-2',
		toolName: 'read_history',
		status: 'timed_out',
		message: 'Storage deadline exceeded',
		errorCode: 'storage_timeout',
		truncated: true,
	};
	const nativeTranscript: LlmConversationItem[] = [
		{ role: MessageRole.USER, content: 'Read the room' },
		{
			type: 'assistant_tool_calls',
			content: 'I will check both readings.',
			calls: [
				{
					callId: 'call-1',
					providerCallId: 'provider-call-1',
					name: 'read_device',
					arguments: { device_id: 'device-1' },
					rawArguments: '{ "device_id": "device-1" }',
				},
				{
					callId: 'call-2',
					providerCallId: 'provider-call-2',
					name: 'read_history',
					arguments: { property_id: 'property-1' },
				},
			],
		},
		{ type: 'tool_results', results: [firstResult, secondResult] },
	];

	it('preserves the exact OpenAI text-only payload shape', () => {
		expect(
			buildOpenAiRequestPayload('gpt-test', 'System prompt', [
				{ role: MessageRole.USER, content: 'Hello' },
				{ role: MessageRole.ASSISTANT, content: 'Hi' },
			]),
		).toEqual({
			model: 'gpt-test',
			max_completion_tokens: 1024,
			messages: [
				{ role: 'system', content: 'System prompt' },
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Hi' },
			],
		});
	});

	it('serializes ordered native OpenAI calls and individual correlated results', () => {
		expect(buildOpenAiRequestPayload('gpt-test', 'System prompt', nativeTranscript)).toEqual({
			model: 'gpt-test',
			max_completion_tokens: 1024,
			messages: [
				{ role: 'system', content: 'System prompt' },
				{ role: 'user', content: 'Read the room' },
				{
					role: 'assistant',
					content: 'I will check both readings.',
					tool_calls: [
						{
							id: 'provider-call-1',
							type: 'function',
							function: { name: 'read_device', arguments: '{ "device_id": "device-1" }' },
						},
						{
							id: 'provider-call-2',
							type: 'function',
							function: { name: 'read_history', arguments: '{"property_id":"property-1"}' },
						},
					],
				},
				{
					role: 'tool',
					tool_call_id: 'provider-call-1',
					content: serializeLlmConversationToolResult(firstResult),
				},
				{
					role: 'tool',
					tool_call_id: 'provider-call-2',
					content: serializeLlmConversationToolResult(secondResult),
				},
			],
		});
	});

	it('preserves the exact Anthropic text-only payload shape', () => {
		expect(
			buildAnthropicRequestPayload('claude-test', 'System prompt', [
				{ role: MessageRole.USER, content: 'Hello' },
				{ role: MessageRole.ASSISTANT, content: 'Hi' },
			]),
		).toEqual({
			model: 'claude-test',
			max_tokens: 1024,
			system: 'System prompt',
			messages: [
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Hi' },
			],
		});
	});

	it('serializes Anthropic calls and one ordered grouped result message', () => {
		expect(buildAnthropicRequestPayload('claude-test', 'System prompt', nativeTranscript)).toEqual({
			model: 'claude-test',
			max_tokens: 1024,
			system: 'System prompt',
			messages: [
				{ role: 'user', content: 'Read the room' },
				{
					role: 'assistant',
					content: [
						{ type: 'text', text: 'I will check both readings.' },
						{
							type: 'tool_use',
							id: 'provider-call-1',
							name: 'read_device',
							input: { device_id: 'device-1' },
						},
						{
							type: 'tool_use',
							id: 'provider-call-2',
							name: 'read_history',
							input: { property_id: 'property-1' },
						},
					],
				},
				{
					role: 'user',
					content: [
						{
							type: 'tool_result',
							tool_use_id: 'provider-call-1',
							content: serializeLlmConversationToolResult(firstResult),
						},
						{
							type: 'tool_result',
							tool_use_id: 'provider-call-2',
							content: serializeLlmConversationToolResult(secondResult),
							is_error: true,
						},
					],
				},
			],
		});
	});

	const invalidTranscripts: Array<[string, LlmConversationItem[], string]> = [
		[
			'orphan results',
			[{ type: 'tool_results', results: [firstResult] }] satisfies LlmConversationItem[],
			'no immediately preceding assistant call group',
		],
		['missing results', nativeTranscript.slice(0, 2), 'must be immediately followed by its results'],
		[
			'reordered results',
			[nativeTranscript[0], nativeTranscript[1], { type: 'tool_results', results: [secondResult, firstResult] }],
			'does not match its ordered call',
		],
	];

	it.each(invalidTranscripts)(
		'rejects %s before building a provider request',
		(_description, transcript, expectedMessage) => {
			expect(() => buildOpenAiRequestPayload('gpt-test', 'System prompt', transcript)).toThrow(expectedMessage);
			expect(() => buildAnthropicRequestPayload('claude-test', 'System prompt', transcript)).toThrow(expectedMessage);
		},
	);

	it('rejects native provider protocols when a provider call ID is unavailable', () => {
		const transcript: LlmConversationItem[] = [
			{
				type: 'assistant_tool_calls',
				content: '',
				calls: [{ callId: 'canonical-only', providerCallId: null, name: 'read', arguments: {} }],
			},
			{
				type: 'tool_results',
				results: [
					{
						callId: 'canonical-only',
						providerCallId: null,
						toolName: 'read',
						status: 'completed',
						message: 'Done',
						truncated: false,
					},
				],
			},
		];

		expect(() => buildOpenAiRequestPayload('gpt-test', 'System prompt', transcript)).toThrow(
			'OpenAI Chat tool transcript requires a provider call ID',
		);
		expect(() => buildAnthropicRequestPayload('claude-test', 'System prompt', transcript)).toThrow(
			'Anthropic tool transcript requires a provider call ID',
		);
	});

	it('allows a provider call ID to repeat across dependent groups while canonical IDs remain unique', () => {
		const dependentTranscript: LlmConversationItem[] = [
			{
				type: 'assistant_tool_calls',
				content: '',
				calls: [{ callId: 'turn-1-call-1', providerCallId: 'ollama-0', name: 'read', arguments: {} }],
			},
			{
				type: 'tool_results',
				results: [
					{
						callId: 'turn-1-call-1',
						providerCallId: 'ollama-0',
						toolName: 'read',
						status: 'completed',
						message: 'First result',
						truncated: false,
					},
				],
			},
			{
				type: 'assistant_tool_calls',
				content: '',
				calls: [{ callId: 'turn-1-call-2', providerCallId: 'ollama-0', name: 'read', arguments: {} }],
			},
			{
				type: 'tool_results',
				results: [
					{
						callId: 'turn-1-call-2',
						providerCallId: 'ollama-0',
						toolName: 'read',
						status: 'completed',
						message: 'Second result',
						truncated: false,
					},
				],
			},
		];

		expect(() => validateLlmConversationItems(dependentTranscript)).not.toThrow();
	});

	it('rejects duplicate provider call IDs within one parallel group', () => {
		const duplicateProviderIds: LlmConversationItem[] = [
			{
				type: 'assistant_tool_calls',
				content: '',
				calls: [
					{ callId: 'call-1', providerCallId: 'provider-1', name: 'read', arguments: {} },
					{ callId: 'call-2', providerCallId: 'provider-1', name: 'read', arguments: {} },
				],
			},
			{
				type: 'tool_results',
				results: [
					{ ...firstResult, callId: 'call-1', providerCallId: 'provider-1', toolName: 'read' },
					{ ...firstResult, callId: 'call-2', providerCallId: 'provider-1', toolName: 'read' },
				],
			},
		];

		expect(() => validateLlmConversationItems(duplicateProviderIds)).toThrow('duplicate provider ID');
	});
});
