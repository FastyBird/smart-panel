import { MessageRole } from '../../../modules/buddy/buddy.constants';
import { LlmConversationItem } from '../../../modules/buddy/platforms/llm-provider.platform';
import { ConfigService } from '../../../modules/config/services/config.service';

import { OpenAiCodexProvider, buildOpenAiCodexRequestPayload } from './openai-codex.provider';

const transcript: LlmConversationItem[] = [
	{ role: MessageRole.USER, content: 'Read the kitchen.' },
	{
		type: 'assistant_tool_calls',
		content: 'I will check both sensors.',
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
				{
					type: 'function_call',
					call_id: 'provider-call-1',
					name: 'get_temperature',
					arguments: '{"room":"kitchen"}',
				},
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
			max_output_tokens: 1024,
			tools: [],
			tool_choice: 'auto',
		});
		expect(provider.supportsNativeToolResults()).toBe(true);
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
});
