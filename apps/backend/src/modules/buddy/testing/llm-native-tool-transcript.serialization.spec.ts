import { buildOllamaRequestPayload } from '../../../plugins/buddy-ollama/platforms/ollama.provider';
import { buildOpenAiCodexRequestPayload } from '../../../plugins/buddy-openai-codex/platforms/openai-codex.provider';
import { MessageRole } from '../buddy.constants';
import { buildAnthropicRequestPayload } from '../platforms/anthropic-sdk.utils';
import { LlmConversationItem } from '../platforms/llm-provider.platform';
import { buildOpenAiRequestPayload } from '../platforms/openai-sdk.utils';

const transcript: LlmConversationItem[] = [
	{ role: MessageRole.USER, content: 'Check both areas' },
	{
		type: 'assistant_tool_calls',
		content: '',
		calls: [
			{
				callId: 'canonical-1',
				providerCallId: 'provider-1',
				name: 'query_home_state',
				arguments: { space_id: 'kitchen' },
			},
			{
				callId: 'canonical-2',
				providerCallId: 'provider-2',
				name: 'get_device_state',
				arguments: { device_ids: ['garage'] },
			},
		],
	},
	{
		type: 'tool_results',
		results: [
			{
				callId: 'canonical-1',
				providerCallId: 'provider-1',
				toolName: 'query_home_state',
				status: 'completed',
				message: 'Kitchen checked',
				data: { matched: 1 },
				truncated: false,
			},
			{
				callId: 'canonical-2',
				providerCallId: 'provider-2',
				toolName: 'get_device_state',
				status: 'failed',
				message: 'Garage unavailable',
				errorCode: 'device_unavailable',
				truncated: false,
			},
		],
	},
];

describe('cross-provider native tool transcript contract', () => {
	it('maps explicit output caps for the same text-only input', () => {
		const text: LlmConversationItem[] = [{ role: MessageRole.USER, content: 'Hello' }];

		expect(buildOpenAiRequestPayload('openai', 'system', text, 321)).toHaveProperty('max_completion_tokens', 321);
		expect(buildAnthropicRequestPayload('anthropic', 'system', text, 322)).toHaveProperty('max_tokens', 322);
		expect(buildOllamaRequestPayload('ollama', 'system', text, undefined, 323)).toHaveProperty(
			'options.num_predict',
			323,
		);
		expect(buildOpenAiCodexRequestPayload('codex', 'system', text, undefined, 324)).toHaveProperty(
			'max_output_tokens',
			324,
		);
	});

	it('preserves ordered native and canonical correlation for completed and error results', () => {
		const openAiMessages = records(buildOpenAiRequestPayload('openai', 'system', transcript).messages);
		const anthropicMessages = records(buildAnthropicRequestPayload('anthropic', 'system', transcript).messages);
		const ollamaMessages = records(buildOllamaRequestPayload('ollama', 'system', transcript).messages);
		const codexInput = records(buildOpenAiCodexRequestPayload('codex', 'system', transcript).input);

		const openAiCallMessage = record(openAiMessages[2]);
		const openAiCalls = records(openAiCallMessage.tool_calls);
		const openAiResults = openAiMessages.slice(3);
		expect(openAiCalls.map((call) => call.id)).toEqual(['provider-1', 'provider-2']);
		expect(openAiResults.map((result) => result.tool_call_id)).toEqual(['provider-1', 'provider-2']);
		expectSerializedResults(openAiResults.map((result) => result.content));

		const anthropicCallBlocks = records(anthropicMessages[1].content).filter((block) => block.type === 'tool_use');
		const anthropicResultBlocks = records(anthropicMessages[2].content);
		expect(anthropicCallBlocks.map((block) => block.id)).toEqual(['provider-1', 'provider-2']);
		expect(anthropicResultBlocks.map((block) => block.tool_use_id)).toEqual(['provider-1', 'provider-2']);
		expect(anthropicResultBlocks.map((block) => block.is_error ?? false)).toEqual([false, true]);
		expectSerializedResults(anthropicResultBlocks.map((block) => block.content));

		const ollamaCallMessage = record(ollamaMessages[2]);
		const ollamaCalls = records(ollamaCallMessage.tool_calls).map((call) => record(call.function));
		const ollamaResults = ollamaMessages.slice(3);
		expect(ollamaCalls.map((call) => call.name)).toEqual(['query_home_state', 'get_device_state']);
		expect(ollamaResults.map((result) => result.tool_name)).toEqual(['query_home_state', 'get_device_state']);
		expectSerializedResults(ollamaResults.map((result) => result.content));

		const codexCalls = codexInput.filter((item) => item.type === 'function_call');
		const codexResults = codexInput.filter((item) => item.type === 'function_call_output');
		expect(codexCalls.map((call) => call.call_id)).toEqual(['provider-1', 'provider-2']);
		expect(codexResults.map((result) => result.call_id)).toEqual(['provider-1', 'provider-2']);
		expectSerializedResults(codexResults.map((result) => result.output));
	});
});

function expectSerializedResults(values: unknown[]): void {
	expect(values.map(parseSerializedResult)).toEqual([
		expect.objectContaining({ call_id: 'canonical-1', status: 'completed', data: { matched: 1 } }),
		expect.objectContaining({ call_id: 'canonical-2', status: 'failed', error_code: 'device_unavailable' }),
	]);
}

function parseSerializedResult(value: unknown): Record<string, unknown> {
	if (typeof value !== 'string') {
		throw new TypeError('Expected a serialized tool result');
	}

	return record(JSON.parse(value) as unknown);
}

function records(value: unknown): Array<Record<string, unknown>> {
	if (!Array.isArray(value)) {
		throw new TypeError('Expected a native item array');
	}

	return value.map(record);
}

function record(value: unknown): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new TypeError('Expected a native item object');
	}

	return value as Record<string, unknown>;
}
