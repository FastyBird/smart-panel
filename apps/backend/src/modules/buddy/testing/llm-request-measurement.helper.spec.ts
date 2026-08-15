import { z } from 'zod';

import { buildOllamaRequestPayload } from '../../../plugins/buddy-ollama/platforms/ollama.provider';
import { buildOpenAiCodexRequestPayload } from '../../../plugins/buddy-openai-codex/platforms/openai-codex.provider';
import { ToolAccessKind, ToolAudience, createToolDefinition } from '../../tools/platforms/tool-provider.platform';
import { MessageRole } from '../buddy.constants';
import { buildAnthropicRequestPayload } from '../platforms/anthropic-sdk.utils';
import { ChatMessage } from '../platforms/llm-provider.platform';
import { buildOpenAiRequestPayload } from '../platforms/openai-sdk.utils';

import {
	estimateConservativeTokens,
	measureJsonUtf8Bytes,
	measureLlmRequestPayload,
} from './llm-request-measurement.helper';

const messages: ChatMessage[] = [
	{ role: MessageRole.USER, content: 'Turn on the kitchen light' },
	{ role: MessageRole.ASSISTANT, content: 'Which kitchen light?' },
	{ role: MessageRole.USER, content: 'The ceiling light' },
];

const nestedTool = createToolDefinition({
	name: 'set_device_property',
	description: 'Set a writable property',
	audiences: [ToolAudience.BUDDY],
	access: ToolAccessKind.WRITE,
	inputSchema: z.object({
		target: z.object({
			deviceId: z.string().uuid(),
			property: z.object({ category: z.string(), value: z.union([z.string(), z.number(), z.boolean()]) }),
		}),
	}),
	outputSchema: z.object({ success: z.boolean() }),
});

describe('native LLM request payload builders', () => {
	it('builds OpenAI and Anthropic payloads with their native output caps', () => {
		const openAi = buildOpenAiRequestPayload('gpt-test', 'system', messages, 321, [nestedTool]);
		const anthropic = buildAnthropicRequestPayload('claude-test', 'system', messages, 321, [nestedTool]);

		expect(openAi).toMatchObject({ model: 'gpt-test', max_completion_tokens: 321 });
		expect(anthropic).toMatchObject({ model: 'claude-test', max_tokens: 321, system: 'system' });
		expect(openAi.tools).toEqual([
			{
				type: 'function',
				function: {
					name: nestedTool.name,
					description: nestedTool.description,
					parameters: nestedTool.parameters,
				},
			},
		]);
		expect(anthropic.tools).toEqual([
			{
				name: nestedTool.name,
				description: nestedTool.description,
				input_schema: nestedTool.parameters,
			},
		]);
	});

	it('builds Ollama and Codex payloads with their native output caps', () => {
		const ollama = buildOllamaRequestPayload('llama-test', 'system', messages, [nestedTool], 321);
		const codex = buildOpenAiCodexRequestPayload('codex-test', 'system', messages, [nestedTool], 321);

		expect(ollama).toMatchObject({ options: { num_predict: 321 } });
		expect(codex).toMatchObject({ max_output_tokens: 321 });
		expect(ollama.tools).toEqual([
			{
				type: 'function',
				function: {
					name: nestedTool.name,
					description: nestedTool.description,
					parameters: nestedTool.parameters,
				},
			},
		]);
		expect(codex.tools).toEqual([
			{
				type: 'function',
				name: nestedTool.name,
				description: nestedTool.description,
				parameters: nestedTool.parameters,
			},
		]);
	});

	it('serializes only native tool fields and excludes runtime Zod metadata', () => {
		const payloads = [
			buildOpenAiRequestPayload('gpt-test', 'system', messages, 321, [nestedTool]),
			buildAnthropicRequestPayload('claude-test', 'system', messages, 321, [nestedTool]),
			buildOllamaRequestPayload('llama-test', 'system', messages, [nestedTool]),
			buildOpenAiCodexRequestPayload('codex-test', 'system', messages, [nestedTool]),
		];

		for (const payload of payloads) {
			const serialized = JSON.stringify(payload);

			expect(serialized).toContain('deviceId');
			expect(serialized).toContain('property');
			expect(serialized).not.toContain('inputSchema');
			expect(serialized).not.toContain('outputSchema');
			expect(serialized).not.toContain('audiences');
			expect(serialized).not.toContain('Zod');
		}
	});
});

describe('LLM request measurement', () => {
	it('measures exact compact JSON UTF-8 bytes conservatively', () => {
		const value = { message: 'Žárovka 💡' };

		expect(measureJsonUtf8Bytes(value)).toBe(Buffer.byteLength(JSON.stringify(value), 'utf8'));
		expect(estimateConservativeTokens(value)).toBe(Math.ceil(Buffer.byteLength(JSON.stringify(value), 'utf8') / 3));
	});

	it('accounts for native components, reserve, framing, and the window', () => {
		const payload = buildOpenAiRequestPayload(
			'gpt-test',
			'stable system prompt',
			[
				...messages,
				{ role: MessageRole.ASSISTANT, content: '[Executing tools: get_device]' },
				{
					role: MessageRole.USER,
					content: '[Tool execution results]\nDevice is on\n\nPlease provide a natural language response.',
				},
			],
			321,
			[nestedTool],
		);
		const measurement = measureLlmRequestPayload(payload, {
			contextWindowTokens: 512,
			requestedOutputTokens: 321,
			providerFramingTokens: 25,
			safetyMarginTokens: 10,
		});

		expect(measurement.jsonUtf8Bytes).toBe(Buffer.byteLength(JSON.stringify(payload), 'utf8'));
		expect(measurement.components.system.jsonUtf8Bytes).toBeGreaterThan(0);
		expect(measurement.components.history.jsonUtf8Bytes).toBeGreaterThan(0);
		expect(measurement.components.current.jsonUtf8Bytes).toBeGreaterThan(0);
		expect(measurement.components.tools.jsonUtf8Bytes).toBeGreaterThan(0);
		expect(measurement.components.toolResults.jsonUtf8Bytes).toBeGreaterThan(0);
		expect(measurement.output).toEqual({ requestedTokens: 321, nativeCapTokens: 321, status: 'enforced' });
		expect(measurement.availableInputTokens).toBe(156);
		expect(measurement.fitsWindow).toBe(measurement.estimatedInputTokens <= 156);
	});

	it('reports enforced and mismatched native output caps', () => {
		const ollama = measureLlmRequestPayload(
			buildOllamaRequestPayload('llama-test', 'system', messages, undefined, 512),
			{
				contextWindowTokens: 8_192,
				requestedOutputTokens: 512,
			},
		);
		const anthropic = measureLlmRequestPayload(buildAnthropicRequestPayload('claude-test', 'system', messages, 256), {
			contextWindowTokens: 8_192,
			requestedOutputTokens: 512,
		});

		expect(ollama.output).toEqual({ requestedTokens: 512, nativeCapTokens: 512, status: 'enforced' });
		expect(anthropic.output).toEqual({ requestedTokens: 512, nativeCapTokens: 256, status: 'mismatched' });
	});
});
