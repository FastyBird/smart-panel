import { MessageRole } from '../../../modules/buddy/buddy.constants';
import {
	LlmConversationAssistantMessageItem,
	LlmConversationFunctionCallItem,
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

const assistantMessageItem = {
	id: 'message-1',
	type: 'message',
	role: 'assistant',
	content: [{ type: 'output_text', text: 'I will check both sensors.', annotations: [] }],
	phase: 'commentary',
	status: 'completed',
} satisfies LlmConversationAssistantMessageItem;

const assistantMessageWithoutPhase = {
	id: 'message-1',
	type: 'message',
	role: 'assistant',
	content: [{ type: 'output_text', text: 'I will check both sensors.', annotations: [] }],
	status: 'completed',
} satisfies LlmConversationAssistantMessageItem;

const annotatedRefusalMessageItem = {
	id: 'message-annotated',
	type: 'message',
	role: 'assistant',
	content: [
		{
			type: 'output_text',
			text: 'See source.',
			annotations: [
				{ type: 'file_citation', file_id: 'file-1', filename: 'guide.pdf', index: 0 },
				{
					type: 'url_citation',
					start_index: 0,
					end_index: 10,
					title: 'Guide',
					url: 'https://example.com/guide',
				},
				{
					type: 'container_file_citation',
					container_id: 'container-1',
					start_index: 0,
					end_index: 10,
					file_id: 'container-file-1',
					filename: 'result.txt',
				},
				{ type: 'file_path', file_id: 'file-2', index: 1 },
			],
			logprobs: [
				{
					token: 'See',
					bytes: [83, 101, 101],
					logprob: -0.1,
					top_logprobs: [{ token: 'Read', bytes: [82, 101, 97, 100], logprob: -1.2 }],
				},
			],
		},
		{ type: 'refusal', refusal: 'I cannot share more.' },
	],
	status: 'completed',
} satisfies LlmConversationAssistantMessageItem;

const firstFunctionCallItem = {
	id: 'function-item-1',
	type: 'function_call',
	call_id: 'provider-call-1',
	name: 'get_temperature',
	arguments: '{"room":"kitchen"}',
	status: 'completed',
} satisfies LlmConversationFunctionCallItem;

const secondFunctionCallItem = {
	id: 'function-item-2',
	type: 'function_call',
	call_id: 'provider-call-2',
	name: 'get_humidity',
	arguments: '{"room":"kitchen"}',
	status: 'completed',
} satisfies LlmConversationFunctionCallItem;

const transcript: LlmConversationItem[] = [
	{ role: MessageRole.USER, content: 'Read the kitchen.' },
	{
		type: 'assistant_tool_calls',
		content: 'I will check both sensors.',
		providerItems: [
			{
				provider: BUDDY_OPENAI_CODEX_PLUGIN_NAME,
				outputIndex: 0,
				item: assistantMessageItem,
			},
			{
				provider: BUDDY_OPENAI_CODEX_PLUGIN_NAME,
				outputIndex: 1,
				item: reasoningItem,
			},
			{
				provider: BUDDY_OPENAI_CODEX_PLUGIN_NAME,
				outputIndex: 2,
				item: firstFunctionCallItem,
			},
			{
				provider: BUDDY_OPENAI_CODEX_PLUGIN_NAME,
				outputIndex: 3,
				item: secondReasoningItem,
			},
			{
				provider: BUDDY_OPENAI_CODEX_PLUGIN_NAME,
				outputIndex: 4,
				item: secondFunctionCallItem,
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
				assistantMessageItem,
				reasoningItem,
				firstFunctionCallItem,
				secondReasoningItem,
				secondFunctionCallItem,
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

	it('replays every supported output message content and annotation variant exactly', () => {
		const annotatedContinuation: LlmConversationItem[] = [
			{
				type: 'assistant_tool_calls',
				content: 'See source.I cannot share more.',
				calls: [
					{
						callId: 'call-1',
						providerCallId: 'provider-call-1',
						name: 'get_temperature',
						arguments: { room: 'kitchen' },
					},
				],
				providerItems: [
					{ provider: BUDDY_OPENAI_CODEX_PLUGIN_NAME, outputIndex: 0, item: annotatedRefusalMessageItem },
					{ provider: BUDDY_OPENAI_CODEX_PLUGIN_NAME, outputIndex: 1, item: firstFunctionCallItem },
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
						message: 'ok',
						truncated: false,
					},
				],
			},
		];

		expect(buildOpenAiCodexRequestPayload('codex-test', 'system', annotatedContinuation).input).toEqual([
			annotatedRefusalMessageItem,
			firstFunctionCallItem,
			expect.objectContaining({ type: 'function_call_output', call_id: 'provider-call-1' }),
		]);
	});

	it('returns completed annotated text and refusal content to text-only callers', async () => {
		const events = [
			{ type: 'response.output_text.delta', output_index: 0, delta: 'See source.' },
			{ type: 'response.refusal.delta', output_index: 0, delta: 'I cannot share more.' },
			{ type: 'response.completed', response: { output: [annotatedRefusalMessageItem] } },
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
				[{ role: MessageRole.USER, content: 'Show the source.' }],
				'codex-test',
			);

			expect(response.content).toBe('See source.I cannot share more.');
			expect(response.providerItems).toEqual([
				{
					provider: BUDDY_OPENAI_CODEX_PLUGIN_NAME,
					outputIndex: 0,
					item: annotatedRefusalMessageItem,
				},
			]);
		} finally {
			fetchSpy.mockRestore();
		}
	});

	it('returns bounded tool errors for malformed JSON while retaining valid calls and provider items', async () => {
		const malformedFunctionCallItem = {
			...firstFunctionCallItem,
			arguments: '{"room":',
		};
		const events = [
			{
				type: 'response.completed',
				response: { output: [malformedFunctionCallItem, secondFunctionCallItem] },
			},
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
			);

			expect(response.toolCalls).toEqual([
				{ id: 'provider-call-2', name: 'get_humidity', arguments: { room: 'kitchen' } },
			]);
			expect(response.toolErrors).toEqual([
				{
					toolCallId: 'provider-call-1',
					toolName: 'get_temperature',
					error: 'Invalid JSON arguments',
				},
			]);
			expect(response.providerItems).toEqual(
				[malformedFunctionCallItem, secondFunctionCallItem].map((item, outputIndex) => ({
					provider: BUDDY_OPENAI_CODEX_PLUGIN_NAME,
					outputIndex,
					item,
				})),
			);
		} finally {
			fetchSpy.mockRestore();
		}
	});

	it('rejects duplicate provider call IDs from different output items before returning tool calls', async () => {
		const duplicateFunctionCallItem = {
			...secondFunctionCallItem,
			call_id: firstFunctionCallItem.call_id,
		};
		const events = [
			{
				type: 'response.completed',
				response: { output: [firstFunctionCallItem, duplicateFunctionCallItem] },
			},
		];
		const body = `${events.map((event) => `data: ${JSON.stringify(event)}`).join('\n')}\ndata: [DONE]\n`;
		const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(body, { status: 200 }));
		const configService = {
			getPluginConfig: jest.fn().mockReturnValue({ accessToken: 'test-token', model: null }),
		};
		const provider = new OpenAiCodexProvider(configService as unknown as ConfigService);

		try {
			await expect(
				provider.sendMessage('system', [{ role: MessageRole.USER, content: 'Read the kitchen.' }], 'codex-test'),
			).rejects.toThrow('OpenAI Codex response contains duplicate call ID at output index 1');
		} finally {
			fetchSpy.mockRestore();
		}
	});

	it('rejects distinct provider call IDs assigned to the same output index', async () => {
		const events = [
			{ type: 'response.output_item.done', output_index: 0, item: firstFunctionCallItem },
			{ type: 'response.output_item.done', output_index: 0, item: secondFunctionCallItem },
		];
		const body = `${events.map((event) => `data: ${JSON.stringify(event)}`).join('\n')}\ndata: [DONE]\n`;
		const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(body, { status: 200 }));
		const configService = {
			getPluginConfig: jest.fn().mockReturnValue({ accessToken: 'test-token', model: null }),
		};
		const provider = new OpenAiCodexProvider(configService as unknown as ConfigService);

		try {
			await expect(
				provider.sendMessage('system', [{ role: MessageRole.USER, content: 'Read the kitchen.' }], 'codex-test'),
			).rejects.toThrow('OpenAI Codex response contains duplicate output index 0');
		} finally {
			fetchSpy.mockRestore();
		}
	});

	it('rejects a function call and non-function item assigned to the same output index', async () => {
		for (const items of [
			[firstFunctionCallItem, assistantMessageItem],
			[assistantMessageItem, firstFunctionCallItem],
		]) {
			const events = items.map((item) => ({ type: 'response.output_item.done', output_index: 0, item }));
			const body = `${events.map((event) => `data: ${JSON.stringify(event)}`).join('\n')}\ndata: [DONE]\n`;
			const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(body, { status: 200 }));
			const configService = {
				getPluginConfig: jest.fn().mockReturnValue({ accessToken: 'test-token', model: null }),
			};
			const provider = new OpenAiCodexProvider(configService as unknown as ConfigService);

			try {
				await expect(
					provider.sendMessage('system', [{ role: MessageRole.USER, content: 'Read the kitchen.' }], 'codex-test'),
				).rejects.toThrow('OpenAI Codex response contains duplicate output index 0');
			} finally {
				fetchSpy.mockRestore();
			}
		}
	});

	it('rejects an added function call that never receives a completion event', async () => {
		const events = [
			{ type: 'response.output_item.added', output_index: 0, item: { ...firstFunctionCallItem, arguments: '' } },
			{
				type: 'response.function_call_arguments.delta',
				output_index: 0,
				call_id: firstFunctionCallItem.call_id,
				delta: firstFunctionCallItem.arguments,
			},
		];
		const body = `${events.map((event) => `data: ${JSON.stringify(event)}`).join('\n')}\ndata: [DONE]\n`;
		const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(body, { status: 200 }));
		const configService = {
			getPluginConfig: jest.fn().mockReturnValue({ accessToken: 'test-token', model: null }),
		};
		const provider = new OpenAiCodexProvider(configService as unknown as ConfigService);

		try {
			await expect(
				provider.sendMessage('system', [{ role: MessageRole.USER, content: 'Read the kitchen.' }], 'codex-test'),
			).rejects.toThrow(`OpenAI Codex function call "${firstFunctionCallItem.call_id}" did not complete`);
		} finally {
			fetchSpy.mockRestore();
		}
	});

	it('rejects function call argument deltas after completion or for a different output index', async () => {
		for (const deltaOutputIndex of [0, 1]) {
			const events = [
				{ type: 'response.output_item.done', output_index: 0, item: firstFunctionCallItem },
				{
					type: 'response.function_call_arguments.delta',
					output_index: deltaOutputIndex,
					call_id: firstFunctionCallItem.call_id,
					delta: ' ',
				},
			];
			const body = `${events.map((event) => `data: ${JSON.stringify(event)}`).join('\n')}\ndata: [DONE]\n`;
			const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(body, { status: 200 }));
			const configService = {
				getPluginConfig: jest.fn().mockReturnValue({ accessToken: 'test-token', model: null }),
			};
			const provider = new OpenAiCodexProvider(configService as unknown as ConfigService);

			try {
				await expect(
					provider.sendMessage('system', [{ role: MessageRole.USER, content: 'Read the kitchen.' }], 'codex-test'),
				).rejects.toThrow(
					deltaOutputIndex === 0
						? 'OpenAI Codex function call arguments changed after completion'
						: 'OpenAI Codex function call argument delta has a mismatched output index',
				);
			} finally {
				fetchSpy.mockRestore();
			}
		}
	});

	it('rejects partial text when the response exhausts max output tokens', async () => {
		const events = [
			{ type: 'response.output_text.delta', output_index: 0, delta: 'This answer is partial' },
			{
				type: 'response.incomplete',
				response: { incomplete_details: { reason: 'max_output_tokens' } },
			},
		];
		const body = `${events.map((event) => `data: ${JSON.stringify(event)}`).join('\n')}\ndata: [DONE]\n`;
		const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(body, { status: 200 }));
		const configService = {
			getPluginConfig: jest.fn().mockReturnValue({ accessToken: 'test-token', model: null }),
		};
		const provider = new OpenAiCodexProvider(configService as unknown as ConfigService);

		try {
			await expect(
				provider.sendMessage('system', [{ role: MessageRole.USER, content: 'Write a long answer.' }], 'codex-test'),
			).rejects.toEqual(new Error('OpenAI Codex response incomplete: max_output_tokens'));
		} finally {
			fetchSpy.mockRestore();
		}
	});

	it('rejects truncated tool JSON and sanitizes malformed incomplete details', async () => {
		const events = [
			{ type: 'response.output_item.added', output_index: 0, item: { ...firstFunctionCallItem, arguments: '' } },
			{
				type: 'response.function_call_arguments.delta',
				output_index: 0,
				call_id: 'provider-call-1',
				delta: '{"room":',
			},
			{
				type: 'response.incomplete',
				response: { incomplete_details: { reason: 'private-unbounded-provider-detail' } },
			},
		];
		const body = `${events.map((event) => `data: ${JSON.stringify(event)}`).join('\n')}\ndata: [DONE]\n`;
		const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(body, { status: 200 }));
		const configService = {
			getPluginConfig: jest.fn().mockReturnValue({ accessToken: 'test-token', model: null }),
		};
		const provider = new OpenAiCodexProvider(configService as unknown as ConfigService);

		try {
			await expect(
				provider.sendMessage('system', [{ role: MessageRole.USER, content: 'Read the kitchen.' }], 'codex-test'),
			).rejects.toEqual(new Error('OpenAI Codex response incomplete: unknown'));
		} finally {
			fetchSpy.mockRestore();
		}
	});

	it('captures exact output order and normalizes a null completed-message phase before replay', async () => {
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
			{ type: 'response.output_item.added', output_index: 0, item: { ...assistantMessageItem, content: [] } },
			{ type: 'response.output_text.delta', output_index: 0, delta: 'I will check both sensors.' },
			{ type: 'response.output_item.added', output_index: 1, item: { ...reasoningItem, encrypted_content: null } },
			{ type: 'response.output_item.done', output_index: 1, item: reasoningItem },
			{ type: 'response.output_item.added', output_index: 2, item: { ...firstFunctionCallItem, arguments: '' } },
			{
				type: 'response.function_call_arguments.delta',
				output_index: 2,
				call_id: 'provider-call-1',
				delta: '{"room":"kitchen"}',
			},
			{ type: 'response.output_item.done', output_index: 2, item: firstFunctionCallItem },
			{
				type: 'response.completed',
				response: {
					output: [
						{ ...assistantMessageItem, phase: null },
						reasoningItem,
						firstFunctionCallItem,
						secondReasoningItem,
						secondFunctionCallItem,
					],
				},
			},
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

			expect(response.content).toBe('I will check both sensors.');
			expect(response.toolCalls).toEqual([
				{ id: 'provider-call-1', name: 'get_temperature', arguments: { room: 'kitchen' } },
				{ id: 'provider-call-2', name: 'get_humidity', arguments: { room: 'kitchen' } },
			]);
			expect(response.providerItems).toEqual(
				[
					assistantMessageWithoutPhase,
					reasoningItem,
					firstFunctionCallItem,
					secondReasoningItem,
					secondFunctionCallItem,
				].map((item, outputIndex) => ({ provider: BUDDY_OPENAI_CODEX_PLUGIN_NAME, outputIndex, item })),
			);

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

			const continuationPayload = buildOpenAiCodexRequestPayload('codex-test', 'system', [
				{ role: MessageRole.USER, content: 'Read the kitchen.' },
				{
					type: 'assistant_tool_calls',
					content: response.content,
					calls: response.toolCalls.map((call, index) => ({
						callId: `call-${index + 1}`,
						providerCallId: call.id,
						name: call.name,
						arguments: call.arguments,
					})),
					providerItems: response.providerItems,
				},
				{
					type: 'tool_results',
					results: response.toolCalls.map((call, index) => ({
						callId: `call-${index + 1}`,
						providerCallId: call.id,
						toolName: call.name,
						status: 'completed',
						message: 'ok',
						truncated: false,
					})),
				},
			]);

			expect(continuationPayload.input).toEqual([
				{ role: 'user', content: 'Read the kitchen.', type: 'message' },
				assistantMessageWithoutPhase,
				reasoningItem,
				firstFunctionCallItem,
				secondReasoningItem,
				secondFunctionCallItem,
				expect.objectContaining({ type: 'function_call_output', call_id: 'provider-call-1' }),
				expect.objectContaining({ type: 'function_call_output', call_id: 'provider-call-2' }),
			]);
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
						outputIndex: 0,
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

	it('rejects native message state that does not exactly match canonical assistant content', () => {
		const ambiguousProviderState = structuredClone(transcript);
		const assistantTurn = ambiguousProviderState[1];

		if (!('type' in assistantTurn) || assistantTurn.type !== 'assistant_tool_calls') {
			throw new TypeError('Expected an assistant tool call fixture');
		}

		assistantTurn.content = 'Different canonical content.';

		expect(() => buildOpenAiCodexRequestPayload('codex-test', 'system', ambiguousProviderState)).toThrow(
			'OpenAI Codex provider message state does not match canonical assistant content',
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
