import { MessageRole } from '../../../modules/buddy/buddy.constants';
import { LlmConversationItem } from '../../../modules/buddy/platforms/llm-provider.platform';
import { ConfigService } from '../../../modules/config/services/config.service';

import { OllamaProvider, buildOllamaRequestPayload } from './ollama.provider';

const transcript: LlmConversationItem[] = [
	{ role: MessageRole.USER, content: 'Read the kitchen.' },
	{
		type: 'assistant_tool_calls',
		content: '',
		calls: [
			{
				callId: 'call-1',
				providerCallId: null,
				name: 'get_temperature',
				arguments: { room: 'kitchen' },
			},
			{
				callId: 'call-2',
				providerCallId: null,
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
				providerCallId: null,
				toolName: 'get_temperature',
				status: 'completed',
				message: 'Temperature read',
				data: { value: 21.5, unit: 'C' },
				truncated: false,
			},
			{
				callId: 'call-2',
				providerCallId: null,
				toolName: 'get_humidity',
				status: 'partial',
				message: 'Humidity read from one sensor',
				data: { value: 48 },
				errorCode: 'PARTIAL_COVERAGE',
				truncated: true,
			},
		],
	},
	{ role: MessageRole.ASSISTANT, content: 'The kitchen is comfortable.' },
];

describe('OllamaProvider native transcript', () => {
	it('maps ordered tool calls and correlated structured results and enforces the output cap', () => {
		expect(buildOllamaRequestPayload('llama-test', 'system', transcript, undefined, 321)).toEqual({
			model: 'llama-test',
			stream: false,
			messages: [
				{ role: 'system', content: 'system' },
				{ role: 'user', content: 'Read the kitchen.' },
				{
					role: 'assistant',
					content: '',
					tool_calls: [
						{ function: { name: 'get_temperature', arguments: { room: 'kitchen' } } },
						{ function: { name: 'get_humidity', arguments: { room: 'kitchen' } } },
					],
				},
				{
					role: 'tool',
					content:
						'{"call_id":"call-1","tool_name":"get_temperature","status":"completed","message":"Temperature read","data":{"value":21.5,"unit":"C"},"truncated":false}',
					tool_name: 'get_temperature',
				},
				{
					role: 'tool',
					content:
						'{"call_id":"call-2","tool_name":"get_humidity","status":"partial","message":"Humidity read from one sensor","data":{"value":48},"error_code":"PARTIAL_COVERAGE","truncated":true}',
					tool_name: 'get_humidity',
				},
				{ role: 'assistant', content: 'The kitchen is comfortable.' },
			],
			options: { num_predict: 321 },
		});
	});

	it('preserves the text-only payload and advertises native tool-result support', () => {
		const messages: LlmConversationItem[] = [{ role: MessageRole.USER, content: 'Hello' }];
		const provider = new OllamaProvider({} as ConfigService);

		expect(buildOllamaRequestPayload('llama-test', 'system', messages)).toEqual({
			model: 'llama-test',
			stream: false,
			messages: [
				{ role: 'system', content: 'system' },
				{ role: 'user', content: 'Hello' },
			],
			options: { num_predict: 1024 },
		});
		expect(provider.supportsNativeToolResults()).toBe(true);
	});
});
