import { MessageRole } from '../../../modules/buddy/buddy.constants';
import {
	LlmConversationItem,
	LlmConversationReasoningItem,
} from '../../../modules/buddy/platforms/llm-provider.platform';
import { ConfigService } from '../../../modules/config/services/config.service';
import { BUDDY_OPENAI_CODEX_PLUGIN_NAME } from '../buddy-openai-codex.constants';

import { OpenAiCodexProvider, buildOpenAiCodexRequestPayload } from './openai-codex.provider';

const reasoningItem = {
	id: 'reasoning-1',
	type: 'reasoning',
	encrypted_content: 'encrypted-reasoning-state',
	summary: [{ type: 'summary_text', text: 'Checking the requested sensors.' }],
	content: [],
	status: 'completed',
} satisfies LlmConversationReasoningItem;

const secondReasoningItem = {
	id: 'reasoning-2',
	type: 'reasoning',
	encrypted_content: 'second-encrypted-reasoning-state',
	summary: [{ type: 'summary_text', text: 'Checking the second sensor.' }],
	status: 'completed',
} satisfies LlmConversationReasoningItem;

const transcript: LlmConversationItem[] = [
	{ role: MessageRole.USER, content: 'Read the kitchen.' },
	{
		type: 'assistant_tool_calls',
		content: 'I will check both sensors.',
		providerItems: [
			{
				provider: BUDDY_OPENAI_CODEX_PLUGIN_NAME,
				beforeProviderCallId: 'provider-call-1',
				item: reasoningItem,
			},
			{
				provider: BUDDY_OPENAI_CODEX_PLUGIN_NAME,
				beforeProviderCallId: 'provider-call-2',
				item: secondReasoningItem,
			},
		],
		calls: [
			{
				callId: 'call-1',
				providerCallId: 'provider-call-1',
				name: 'get_temperature',
				arguments: { room: 'kitchen' },
				rawArguments: '{"room":"kitchen"}',
			},
			{
				callId: 'call-2',
				providerCallId: 'provider-call-2',
				name: 'get_humidity',
				arguments: { room: 'kitchen' },
			},
		],
	},
	{
		type: 'tool_results',
		results: [
			{
				callId: 'call-1',
				providerCallId: 'provider-call-1',
				toolName: 'get_temperature',
				status: 'completed',
				message: 'Temperature read',
				data: { value: 21.5, unit: 'C' },
				truncated: false,
			},
			{
				callId: 'call-2',
				providerCallId: 'provider-call-2',
				toolName: 'get_humidity',
				status: 'timed_out',
				message: 'Humidity read timed out',
				errorCode: 'TOOL_EXECUTION_TIMEOUT',
				truncated: false,
			},
		],
	},
	{ role: MessageRole.ASSISTANT, content: 'The temperature is 21.5 C.' },
];

describe('OpenAiCodexProvider native transcript', () => {
	it('maps ordered function calls and outputs with exact provider call IDs and enforces the output cap', () => {
		expect(buildOpenAiCodexRequestPayload('codex-test', 'system', transcript, undefined, 321)).toEqual({
			model: 'codex-test',
			instructions: 'system',
			input: [
				{ role: 'user', content: 'Read the kitchen.', type: 'message' },
				{ role: 'assistant', content: 'I will check both sensors.', type: 'message' },
				reasoningItem,
				{
					type: 'function_call',
					call_id: 'provider-call-1',
					name: 'get_temperature',
					arguments: '{"room":"kitchen"}',
				},
				secondReasoningItem,
				{
					type: 'function_call',
					call_id: 'provider-call-2',
					name: 'get_humidity',
					arguments: '{"room":"kitchen"}',
				},
				{
					type: 'function_call_output',
					call_id: 'provider-call-1',
					output:
						'{"call_id":"call-1","tool_name":"get_temperature","status":"completed","message":"Temperature read","data":{"value":21.5,"unit":"C"},"truncated":false}',
				},
				{
					type: 'function_call_output',
					call_id: 'provider-call-2',
					output:
						'{"call_id":"call-2","tool_name":"get_humidity","status":"timed_out","message":"Humidity read timed out","error_code":"TOOL_EXECUTION_TIMEOUT","truncated":false}',
				},
				{ role: 'assistant', content: 'The temperature is 21.5 C.', type: 'message' },
			],
			stream: true,
			store: false,
			include: ['reasoning.encrypted_content'],
			max_output_tokens: 321,
			tools: [],
			tool_choice: 'auto',
		});
	});

	it('preserves the text-only payload and advertises native tool-result support', () => {
		const messages: LlmConversationItem[] = [{ role: MessageRole.USER, content: 'Hello' }];
		const provider = new OpenAiCodexProvider({} as ConfigService);

		expect(buildOpenAiCodexRequestPayload('codex-test', 'system', messages)).toEqual({
			model: 'codex-test',
			instructions: 'system',
			input: [{ role: 'user', content: 'Hello', type: 'message' }],
			stream: true,
			store: false,
			include: ['reasoning.encrypted_content'],
			max_output_tokens: 1024,
			tools: [],
			tool_choice: 'auto',
		});
		expect(provider.supportsNativeToolResults()).toBe(true);
	});

	it('captures complete encrypted reasoning output and associates it with the following native function call', async () => {
		const functionCallItem = {
			id: 'function-item-1',
			type: 'function_call',
			call_id: 'provider-call-1',
			name: 'get_temperature',
			arguments: '{"room":"kitchen"}',
			status: 'completed',
		};
		const events = [
			{
				type: 'response.output_item.done',
				item: { ...reasoningItem, encrypted_content: 'must-not-use-without-an-output-index' },
			},
			{
				type: 'response.output_item.added',
				output_index: -1,
				item: { ...reasoningItem, encrypted_content: 'must-not-use-with-a-negative-output-index' },
			},
			{ type: 'response.output_item.added', output_index: 0, item: { ...reasoningItem, encrypted_content: null } },
			{ type: 'response.output_item.done', output_index: 0, item: reasoningItem },
			{ type: 'response.output_item.added', output_index: 1, item: { ...functionCallItem, arguments: '' } },
			{
				type: 'response.function_call_arguments.delta',
				output_index: 1,
				call_id: 'provider-call-1',
				delta: '{"room":"kitchen"}',
			},
			{ type: 'response.output_item.done', output_index: 1, item: functionCallItem },
			{ type: 'response.completed', response: { output: [reasoningItem, functionCallItem] } },
		];
		const body = `${events.map((event) => `data: ${JSON.stringify(event)}`).join('\n')}\ndata: [DONE]\n`;
		const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(body, { status: 200 }));
		const configService = {
			getPluginConfig: jest.fn().mockReturnValue({ accessToken: 'test-token', model: null }),
		};
		const provider = new OpenAiCodexProvider(configService as unknown as ConfigService);

		try {
			const response = await provider.sendMessage(
				'system',
				[{ role: MessageRole.USER, content: 'Read the kitchen.' }],
				'codex-test',
				{ maxTokens: 321 },
			);

			expect(response.toolCalls).toEqual([
				{ id: 'provider-call-1', name: 'get_temperature', arguments: { room: 'kitchen' } },
			]);
			expect(response.providerItems).toEqual([
				{
					provider: BUDDY_OPENAI_CODEX_PLUGIN_NAME,
					beforeProviderCallId: 'provider-call-1',
					item: reasoningItem,
				},
			]);

			const requestBody = fetchSpy.mock.calls[0][1]?.body;

			if (typeof requestBody !== 'string') {
				throw new TypeError('Expected a serialized Codex request body');
			}

			const request = JSON.parse(requestBody) as Record<string, unknown>;

			expect(request).toEqual(
				expect.objectContaining({
					store: false,
					include: ['reasoning.encrypted_content'],
					max_output_tokens: 321,
				}),
			);
		} finally {
			fetchSpy.mockRestore();
		}
	});

	it('rejects a Codex transcript without native provider call IDs', () => {
		const missingProviderCallId: LlmConversationItem[] = [
			{
				type: 'assistant_tool_calls',
				content: '',
				calls: [{ callId: 'call-1', providerCallId: null, name: 'get_temperature', arguments: {} }],
			},
			{
				type: 'tool_results',
				results: [
					{
						callId: 'call-1',
						providerCallId: null,
						toolName: 'get_temperature',
						status: 'completed',
						message: 'ok',
						truncated: false,
					},
				],
			},
		];

		expect(() => buildOpenAiCodexRequestPayload('codex-test', 'system', missingProviderCallId)).toThrow(
			'OpenAI Codex tool transcript requires a provider call ID',
		);
	});

	it('rejects incomplete provider continuation items before replay', () => {
		const invalidProviderItems: LlmConversationItem[] = [
			{
				type: 'assistant_tool_calls',
				content: '',
				calls: [{ callId: 'call-1', providerCallId: 'provider-call-1', name: 'read', arguments: {} }],
				providerItems: [
					{
						provider: BUDDY_OPENAI_CODEX_PLUGIN_NAME,
						beforeProviderCallId: 'provider-call-1',
						item: { type: 'reasoning', id: 'reasoning-1' } as unknown as LlmConversationReasoningItem,
					},
				],
			},
			{
				type: 'tool_results',
				results: [
					{
						callId: 'call-1',
						providerCallId: 'provider-call-1',
						toolName: 'read',
						status: 'completed',
						message: 'ok',
						truncated: false,
					},
				],
			},
		];

		expect(() => buildOpenAiCodexRequestPayload('codex-test', 'system', invalidProviderItems)).toThrow(
			'OpenAI Codex reasoning continuation requires complete encrypted content',
		);
	});

	it('rejects duplicate native provider call IDs before serialization', () => {
		const duplicateProviderCallIds: LlmConversationItem[] = [
			{
				type: 'assistant_tool_calls',
				content: '',
				calls: [
					{ callId: 'call-1', providerCallId: 'provider-call-1', name: 'read_one', arguments: {} },
					{ callId: 'call-2', providerCallId: 'provider-call-1', name: 'read_two', arguments: {} },
				],
			},
			{
				type: 'tool_results',
				results: [
					{
						callId: 'call-1',
						providerCallId: 'provider-call-1',
						toolName: 'read_one',
						status: 'completed',
						message: 'ok',
						truncated: false,
					},
					{
						callId: 'call-2',
						providerCallId: 'provider-call-1',
						toolName: 'read_two',
						status: 'completed',
						message: 'ok',
						truncated: false,
					},
				],
			},
		];

		expect(() => buildOpenAiCodexRequestPayload('codex-test', 'system', duplicateProviderCallIds)).toThrow(
			'empty or duplicate provider ID',
		);
	});
});
