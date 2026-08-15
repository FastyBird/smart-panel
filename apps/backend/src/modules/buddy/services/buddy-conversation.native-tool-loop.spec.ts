import {
	LlmToolCall,
	ToolAudience,
	ToolDefinition,
	ToolExecutionContext,
	ToolExecutionResult,
	ToolExecutionStatus,
} from '../../tools/platforms/tool-provider.platform';
import {
	BUDDY_MAX_PROVIDER_ITEMS_PER_ITERATION,
	BUDDY_MAX_TOOL_ITEMS_PER_ITERATION,
	BUDDY_MAX_TOOL_ITEM_JSON_BYTES,
	MessageRole,
} from '../buddy.constants';
import { BuddyProviderErrorException } from '../buddy.exceptions';
import type { LlmConversationItem, LlmOptions, LlmResponse, LlmResponseMeta } from '../platforms/llm-provider.platform';

import { BuddyConversationService } from './buddy-conversation.service';
import { BuddyToolSelectionService } from './buddy-tool-selection.service';

interface NativeToolLoopHarness {
	sendWithToolExecution(
		systemPrompt: string,
		messages: LlmConversationItem[],
		conversationId: string,
		tools?: ToolDefinition[],
		maxIterations?: number,
	): Promise<LlmResponse>;
}

type SendMessage = (
	systemPrompt: string,
	messages: LlmConversationItem[],
	options?: LlmOptions,
	expectedProviderType?: string,
) => Promise<LlmResponse>;
type SupportsNativeToolResults = (providerType?: string) => boolean;
type ExecuteTool = (toolCall: LlmToolCall, context?: Partial<ToolExecutionContext>) => Promise<ToolExecutionResult>;

const createMeta = (ordinal: number): LlmResponseMeta => ({
	provider: 'native-provider',
	model: 'native-model',
	inputTokens: ordinal,
	outputTokens: ordinal * 2,
	finishReason: `finish-${ordinal}`,
	durationMs: ordinal * 10,
	cacheReadTokens: ordinal * 3,
	cacheWriteTokens: ordinal * 4,
});

describe('BuddyConversationService native tool loop', () => {
	let llmProvider: {
		sendMessage: jest.MockedFunction<SendMessage>;
		supportsNativeToolResults: jest.MockedFunction<SupportsNativeToolResults>;
	};
	let toolProviderRegistry: {
		executeTool: jest.MockedFunction<ExecuteTool>;
	};
	let service: BuddyConversationService;

	beforeEach(() => {
		llmProvider = {
			sendMessage: jest.fn<ReturnType<SendMessage>, Parameters<SendMessage>>(),
			supportsNativeToolResults: jest
				.fn<ReturnType<SupportsNativeToolResults>, Parameters<SupportsNativeToolResults>>()
				.mockReturnValue(true),
		};
		toolProviderRegistry = {
			executeTool: jest.fn<ReturnType<ExecuteTool>, Parameters<ExecuteTool>>(),
		};
		service = new BuddyConversationService(
			{} as never,
			{} as never,
			{} as never,
			llmProvider as never,
			{} as never,
			{} as never,
			toolProviderRegistry as never,
			{} as never,
			{} as never,
			{} as never,
			new BuddyToolSelectionService(),
		);
	});

	it('carries ordered structured results and active provider state through dependent native iterations', async () => {
		const providerItems = [
			{
				provider: 'native-provider',
				outputIndex: 0,
				item: {
					type: 'reasoning' as const,
					id: 'reasoning-1',
					summary: [],
					encrypted_content: 'encrypted-state',
					status: 'completed' as const,
				},
			},
		];

		llmProvider.sendMessage
			.mockResolvedValueOnce({
				content: 'I am checking the first reading.',
				toolCalls: [{ id: 'ollama-0', name: 'read_temperature', arguments: { room: 'kitchen' } }],
				providerItems,
				meta: createMeta(1),
			})
			.mockResolvedValueOnce({
				content: '',
				toolCalls: [{ id: 'ollama-0', name: 'read_humidity', arguments: { room: 'kitchen' } }],
				meta: createMeta(2),
			})
			.mockResolvedValueOnce({ content: 'The kitchen is comfortable.', meta: createMeta(3) });
		toolProviderRegistry.executeTool
			.mockResolvedValueOnce({
				success: true,
				status: ToolExecutionStatus.COMPLETED,
				message: 'Temperature read',
				data: { value: 21.5, unit: 'C' },
			})
			.mockResolvedValueOnce({
				success: false,
				status: ToolExecutionStatus.TIMED_OUT,
				message: 'Humidity read timed out',
				data: { attempted: 2 },
				errorCode: 'TOOL_TIMEOUT',
			});

		const response = await runToolLoop(service);

		expect(response).toEqual({
			content: 'The kitchen is comfortable.',
			meta: {
				...createMeta(1),
				inputTokens: 6,
				outputTokens: 12,
				finishReason: 'finish-3',
				durationMs: 60,
				cacheReadTokens: 18,
				cacheWriteTokens: 24,
			},
		});
		expect(llmProvider.supportsNativeToolResults).toHaveBeenCalledWith('native-provider');
		expect(llmProvider.sendMessage).toHaveBeenCalledTimes(3);

		const secondMessages = llmProvider.sendMessage.mock.calls[1][1];
		const firstCallGroup = secondMessages[1];
		const firstResultGroup = secondMessages[2];
		const firstCallId = getOnlyCallId(firstCallGroup);

		expect(firstCallGroup).toEqual({
			type: 'assistant_tool_calls',
			content: 'I am checking the first reading.',
			calls: [
				{
					callId: firstCallId,
					providerCallId: 'ollama-0',
					name: 'read_temperature',
					arguments: { room: 'kitchen' },
				},
			],
			providerItems,
		});
		expect(firstResultGroup).toEqual({
			type: 'tool_results',
			results: [
				{
					callId: firstCallId,
					providerCallId: 'ollama-0',
					toolName: 'read_temperature',
					status: 'completed',
					message: 'Temperature read',
					data: { value: 21.5, unit: 'C' },
					truncated: false,
				},
			],
		});

		const thirdMessages = llmProvider.sendMessage.mock.calls[2][1];
		const secondCallGroup = thirdMessages[3];
		const secondResultGroup = thirdMessages[4];
		const secondCallId = getOnlyCallId(secondCallGroup);

		expect(secondCallId).not.toBe(firstCallId);
		expect(secondCallGroup).toEqual({
			type: 'assistant_tool_calls',
			content: '',
			calls: [
				{
					callId: secondCallId,
					providerCallId: 'ollama-0',
					name: 'read_humidity',
					arguments: { room: 'kitchen' },
				},
			],
		});
		expect(secondResultGroup).toEqual({
			type: 'tool_results',
			results: [
				{
					callId: secondCallId,
					providerCallId: 'ollama-0',
					toolName: 'read_humidity',
					status: 'timed_out',
					message: 'Humidity read timed out',
					data: { attempted: 2 },
					errorCode: 'TOOL_TIMEOUT',
					truncated: false,
				},
			],
		});
		expect(firstResultGroup).not.toHaveProperty('providerItems');
		expect(secondCallGroup).not.toHaveProperty('providerItems');

		expect(toolProviderRegistry.executeTool).toHaveBeenNthCalledWith(
			1,
			{ id: 'ollama-0', name: 'read_temperature', arguments: { room: 'kitchen' } },
			expect.objectContaining({
				audience: ToolAudience.BUDDY,
				source: ToolAudience.BUDDY,
				conversationId: 'conversation-native-loop',
				requestId: firstCallId,
			}),
		);
		expect(toolProviderRegistry.executeTool).toHaveBeenNthCalledWith(
			2,
			{ id: 'ollama-0', name: 'read_humidity', arguments: { room: 'kitchen' } },
			expect.objectContaining({
				audience: ToolAudience.BUDDY,
				source: ToolAudience.BUDDY,
				conversationId: 'conversation-native-loop',
				requestId: secondCallId,
			}),
		);
	});

	it('preserves the legacy mixed-content success early return', async () => {
		llmProvider.supportsNativeToolResults.mockReturnValue(false);
		llmProvider.sendMessage.mockResolvedValue({
			content: 'The light command was accepted.',
			toolCalls: [{ id: 'provider-1', name: 'set_light', arguments: { on: true } }],
			meta: createMeta(1),
		});
		toolProviderRegistry.executeTool.mockResolvedValue({
			success: true,
			status: ToolExecutionStatus.COMPLETED,
			message: 'Light switched on',
		});

		const response = await runToolLoop(service);

		expect(response.content).toBe('The light command was accepted.');
		expect(llmProvider.sendMessage).toHaveBeenCalledTimes(1);
		expect(toolProviderRegistry.executeTool).toHaveBeenCalledTimes(1);
	});

	it('stops safely when the provider cannot continue after a completed native tool step', async () => {
		llmProvider.sendMessage
			.mockResolvedValueOnce({
				content: '',
				toolCalls: [{ id: 'provider-1', name: 'set_light', arguments: { on: true } }],
				meta: createMeta(1),
			})
			.mockRejectedValueOnce(new BuddyProviderErrorException('The LLM provider changed during the active turn'));
		toolProviderRegistry.executeTool.mockResolvedValue({
			success: true,
			status: ToolExecutionStatus.COMPLETED,
			message: 'Light switched on',
		});
		const tools = [{} as ToolDefinition];

		const response = await runToolLoop(service, 5, tools);

		expect(response.content).toContain('could not safely continue the assistant turn');
		expect(response.content).toContain('check the current state before retrying');
		expect(llmProvider.sendMessage).toHaveBeenNthCalledWith(
			2,
			'system',
			expect.any(Array),
			{ tools },
			'native-provider',
		);
		expect(toolProviderRegistry.executeTool).toHaveBeenCalledTimes(1);
	});

	it('preserves the legacy prose fallback when execution fails', async () => {
		llmProvider.supportsNativeToolResults.mockReturnValue(false);
		llmProvider.sendMessage
			.mockResolvedValueOnce({
				content: 'I will switch the light.',
				toolCalls: [{ id: 'provider-1', name: 'set_light', arguments: { on: true } }],
				meta: createMeta(1),
			})
			.mockResolvedValueOnce({ content: 'I could not switch the light.', meta: createMeta(2) });
		toolProviderRegistry.executeTool.mockResolvedValue({
			success: false,
			status: ToolExecutionStatus.FAILED,
			message: 'Device is offline',
			errorCode: 'DEVICE_OFFLINE',
		});

		await runToolLoop(service);

		expect(llmProvider.sendMessage.mock.calls[1][1]).toEqual([
			{ role: MessageRole.USER, content: 'Control the kitchen.' },
			{ role: MessageRole.ASSISTANT, content: 'I will switch the light.' },
			{
				role: MessageRole.USER,
				content:
					'[Tool execution results]\nTool "set_light" (id=provider-1): FAILED — Device is offline\n\n' +
					'Please provide a natural language response based on these results.',
			},
		]);
	});

	it('uses the whole-iteration prose fallback for native provider parse errors', async () => {
		llmProvider.sendMessage
			.mockResolvedValueOnce({
				content: '',
				toolErrors: [{ toolCallId: 'bad-1', toolName: 'set_light', error: 'Invalid JSON arguments' }],
				meta: createMeta(1),
			})
			.mockResolvedValueOnce({ content: 'Please specify the light state again.', meta: createMeta(2) });

		await runToolLoop(service);

		expect(toolProviderRegistry.executeTool).not.toHaveBeenCalled();
		expect(llmProvider.sendMessage.mock.calls[1][1]).toEqual([
			{ role: MessageRole.USER, content: 'Control the kitchen.' },
			{ role: MessageRole.ASSISTANT, content: '[Executing tools: set_light (parse error)]' },
			{
				role: MessageRole.USER,
				content:
					'[Tool execution results]\nTool "set_light" (id=bad-1): FAILED — Invalid JSON arguments\n\n' +
					'Please provide a natural language response based on these results.',
			},
		]);
	});

	it('preserves the whole-iteration prose fallback for a mixed valid and malformed native batch', async () => {
		llmProvider.sendMessage
			.mockResolvedValueOnce({
				content: '',
				toolCalls: [{ id: 'provider-1', name: 'set_light', arguments: { on: true } }],
				toolErrors: [{ toolCallId: 'bad-1', toolName: 'set_light', error: 'Invalid JSON arguments' }],
				meta: createMeta(1),
			})
			.mockResolvedValueOnce({ content: 'I could not apply the malformed request.', meta: createMeta(2) });
		toolProviderRegistry.executeTool.mockResolvedValue({
			success: true,
			status: ToolExecutionStatus.COMPLETED,
			message: 'Light switched on',
		});

		await runToolLoop(service);

		expect(toolProviderRegistry.executeTool).toHaveBeenCalledTimes(1);
		expect(llmProvider.sendMessage.mock.calls[1][1]).toEqual([
			{ role: MessageRole.USER, content: 'Control the kitchen.' },
			{ role: MessageRole.ASSISTANT, content: '[Executing tools: set_light, set_light (parse error)]' },
			{
				role: MessageRole.USER,
				content:
					'[Tool execution results]\nTool "set_light" (id=bad-1): FAILED — Invalid JSON arguments\n' +
					'Tool "set_light" (id=provider-1): SUCCESS — Light switched on\n\n' +
					'Please provide a natural language response based on these results.',
			},
		]);
	});

	it('aborts remaining calls and disables tools after an indeterminate registry execution', async () => {
		llmProvider.sendMessage
			.mockResolvedValueOnce({
				content: '',
				toolCalls: [
					{ id: 'provider-1', name: 'uncertain_action', arguments: {} },
					{ id: 'provider-2', name: 'read_state', arguments: {} },
				],
				meta: createMeta(1),
			})
			.mockResolvedValueOnce({ content: 'I could only confirm the state read.', meta: createMeta(2) });
		toolProviderRegistry.executeTool.mockRejectedValueOnce(new Error('private provider detail'));
		const tools = [{} as ToolDefinition];

		const response = await runToolLoop(service, 5, tools);

		const resultGroup = llmProvider.sendMessage.mock.calls[1][1][2];

		expect(resultGroup).toEqual({
			type: 'tool_results',
			results: [
				expect.objectContaining({
					providerCallId: 'provider-1',
					toolName: 'uncertain_action',
					status: 'indeterminate',
					message: 'Tool "uncertain_action" execution outcome is uncertain',
					errorCode: 'TOOL_EXECUTION_INDETERMINATE',
				}),
				expect.objectContaining({
					providerCallId: 'provider-2',
					toolName: 'read_state',
					status: 'denied',
					message: 'Tool "read_state" was not executed after an uncertain earlier outcome',
					errorCode: 'TOOL_BATCH_ABORTED_AFTER_INDETERMINATE',
				}),
			],
		});
		expect(JSON.stringify(resultGroup)).not.toContain('private provider detail');
		expect(toolProviderRegistry.executeTool).toHaveBeenCalledTimes(1);
		expect(llmProvider.sendMessage).toHaveBeenNthCalledWith(
			2,
			'system',
			expect.any(Array),
			{ tools: undefined },
			'native-provider',
		);
		expect(response.content).toBe(
			'I could not confirm whether the requested operation completed, so I stopped further actions.',
		);
	});

	it('returns deterministic uncertainty when the no-tools follow-up rejects', async () => {
		llmProvider.sendMessage
			.mockResolvedValueOnce({
				content: '',
				toolCalls: [{ id: 'provider-1', name: 'uncertain_action', arguments: {} }],
				meta: createMeta(1),
			})
			.mockRejectedValueOnce(new Error('follow-up provider unavailable'));
		toolProviderRegistry.executeTool.mockRejectedValueOnce(new Error('private provider detail'));

		const response = await runToolLoop(service, 5, [{} as ToolDefinition]);

		expect(response.content).toBe(
			'I could not confirm whether the requested operation completed, so I stopped further actions.',
		);
		expect(response.content).not.toContain('provider');
		expect(llmProvider.sendMessage).toHaveBeenCalledTimes(2);
	});

	it('rejects duplicate native provider IDs before executing any tool', async () => {
		llmProvider.sendMessage.mockResolvedValue({
			content: '',
			toolCalls: [
				{ id: 'duplicate', name: 'read_one', arguments: {} },
				{ id: 'duplicate', name: 'read_two', arguments: {} },
			],
			meta: createMeta(1),
		});

		const error = await runToolLoop(service).catch((reason: unknown) => reason);

		expect(error).toBeInstanceOf(BuddyProviderErrorException);
		expect(error).toHaveProperty('message', expect.stringContaining('empty or duplicate provider call ID'));
		expect(toolProviderRegistry.executeTool).not.toHaveBeenCalled();
	});

	it('rejects an oversized tool batch before executing any call', async () => {
		llmProvider.sendMessage.mockResolvedValue({
			content: '',
			toolCalls: createToolCalls('provider', BUDDY_MAX_TOOL_ITEMS_PER_ITERATION + 1),
			meta: createMeta(1),
		});

		const response = await runToolLoop(service);

		expect(response.content).toBe(
			'I could not safely process that many tool operations in one turn. Please simplify the request.',
		);
		expect(toolProviderRegistry.executeTool).not.toHaveBeenCalled();
		expect(llmProvider.sendMessage).toHaveBeenCalledTimes(1);
	});

	it('preflights every call before dispatch when the final call is oversized', async () => {
		llmProvider.sendMessage.mockResolvedValue({
			content: '',
			toolCalls: [
				{ id: 'provider-1', name: 'set_light', arguments: { on: true } },
				{
					id: 'provider-2',
					name: 'set_light',
					arguments: { value: 'x'.repeat(BUDDY_MAX_TOOL_ITEM_JSON_BYTES) },
				},
			],
			meta: createMeta(1),
		});

		const response = await runToolLoop(service);

		expect(response.content).toContain('Please simplify the request');
		expect(toolProviderRegistry.executeTool).not.toHaveBeenCalled();
	});

	it('rejects oversized provider continuation atomically before executing any call', async () => {
		llmProvider.sendMessage.mockResolvedValue({
			content: '',
			toolCalls: createToolCalls('provider', 1),
			providerItems: Array.from({ length: BUDDY_MAX_PROVIDER_ITEMS_PER_ITERATION + 1 }, (_, outputIndex) => ({
				provider: 'native-provider',
				outputIndex,
				item: {
					type: 'reasoning' as const,
					id: `reasoning-${outputIndex}`,
					summary: [],
					encrypted_content: 'state',
				},
			})),
			meta: createMeta(1),
		});

		const response = await runToolLoop(service);

		expect(response.content).toContain('Please simplify the request');
		expect(toolProviderRegistry.executeTool).not.toHaveBeenCalled();
		expect(response.providerItems).toBeUndefined();
	});

	it('stops before a later batch exceeds the cumulative turn item cap', async () => {
		llmProvider.sendMessage
			.mockResolvedValueOnce({
				content: '',
				toolCalls: createToolCalls('first', BUDDY_MAX_TOOL_ITEMS_PER_ITERATION),
				meta: createMeta(1),
			})
			.mockResolvedValueOnce({
				content: '',
				toolCalls: createToolCalls('second', BUDDY_MAX_TOOL_ITEMS_PER_ITERATION),
				meta: createMeta(2),
			})
			.mockResolvedValueOnce({
				content: '',
				toolCalls: createToolCalls('third', BUDDY_MAX_TOOL_ITEMS_PER_ITERATION),
				meta: createMeta(3),
			})
			.mockResolvedValueOnce({
				content: '',
				toolCalls: createToolCalls('fourth', BUDDY_MAX_TOOL_ITEMS_PER_ITERATION),
				meta: createMeta(4),
			})
			.mockResolvedValueOnce({
				content: '',
				toolCalls: createToolCalls('fifth', 1),
				meta: createMeta(5),
			});
		toolProviderRegistry.executeTool.mockResolvedValue({
			success: true,
			status: ToolExecutionStatus.COMPLETED,
			message: 'done',
		});

		const response = await runToolLoop(service);

		expect(toolProviderRegistry.executeTool).toHaveBeenCalledTimes(BUDDY_MAX_TOOL_ITEMS_PER_ITERATION * 4);
		expect(llmProvider.sendMessage).toHaveBeenCalledTimes(5);
		expect(response.content).toContain('Earlier steps may have completed');
	});

	it('drops later structured data to keep one truthful correlated result per call', async () => {
		llmProvider.sendMessage
			.mockResolvedValueOnce({
				content: '',
				toolCalls: createToolCalls('provider', 2),
				meta: createMeta(1),
			})
			.mockResolvedValueOnce({ content: 'done', meta: createMeta(2) });
		toolProviderRegistry.executeTool
			.mockResolvedValueOnce({
				success: true,
				status: ToolExecutionStatus.COMPLETED,
				message: 'first',
				data: { value: 'a'.repeat(32 * 1024) },
			})
			.mockResolvedValueOnce({
				success: true,
				status: ToolExecutionStatus.COMPLETED,
				message: 'second',
				data: { value: 'b'.repeat(32 * 1024) },
			});

		await runToolLoop(service);

		const resultItem = llmProvider.sendMessage.mock.calls[1][1][2];

		if ('type' in resultItem && resultItem.type === 'tool_results') {
			expect(resultItem.results).toHaveLength(2);
			expect(resultItem.results[0].providerCallId).toBe('provider-0');
			expect(resultItem.results[0].data).toEqual({ value: 'a'.repeat(32 * 1024) });
			expect(resultItem.results[1]).toEqual(expect.objectContaining({ providerCallId: 'provider-1', truncated: true }));
			expect(resultItem.results[1]).not.toHaveProperty('data');
		} else {
			throw new TypeError('Expected tool result group');
		}
	});

	it('returns a bounded fallback after max iterations and strips active provider state', async () => {
		llmProvider.sendMessage
			.mockResolvedValueOnce({
				content: '',
				toolCalls: [{ id: 'provider-1', name: 'read_state', arguments: {} }],
				providerItems: [
					{
						provider: 'native-provider',
						outputIndex: 0,
						item: {
							type: 'reasoning',
							id: 'reasoning-1',
							summary: [],
							encrypted_content: 'encrypted-state',
						},
					},
				],
				meta: createMeta(1),
			})
			.mockResolvedValueOnce({
				content: 'I will read the state again.',
				toolCalls: [{ id: 'provider-2', name: 'read_state_again', arguments: {} }],
				providerItems: [
					{
						provider: 'native-provider',
						outputIndex: 0,
						item: {
							type: 'reasoning',
							id: 'reasoning-2',
							summary: [],
							encrypted_content: 'encrypted-state-2',
						},
					},
				],
				meta: createMeta(2),
			});
		toolProviderRegistry.executeTool.mockResolvedValue({
			success: true,
			status: ToolExecutionStatus.COMPLETED,
			message: 'State read',
		});

		const response = await runToolLoop(service, 1);

		expect(response.content).toContain('reached the maximum number of steps');
		expect(response.meta).toEqual({
			...createMeta(1),
			inputTokens: 3,
			outputTokens: 6,
			finishReason: 'finish-2',
			durationMs: 30,
			cacheReadTokens: 9,
			cacheWriteTokens: 12,
		});
		expect(response.toolCalls).toBeUndefined();
		expect(response.toolErrors).toBeUndefined();
		expect(response.providerItems).toBeUndefined();
		expect(llmProvider.sendMessage).toHaveBeenCalledTimes(2);
		expect(toolProviderRegistry.executeTool).toHaveBeenCalledTimes(1);
	});
});

async function runToolLoop(
	service: BuddyConversationService,
	maxIterations: number = 5,
	tools?: ToolDefinition[],
): Promise<LlmResponse> {
	return (service as unknown as NativeToolLoopHarness).sendWithToolExecution(
		'system',
		[{ role: MessageRole.USER, content: 'Control the kitchen.' }],
		'conversation-native-loop',
		tools,
		maxIterations,
	);
}

function getOnlyCallId(item: LlmConversationItem): string {
	if (!('type' in item) || item.type !== 'assistant_tool_calls' || item.calls.length !== 1) {
		throw new TypeError('Expected one assistant tool call');
	}

	return item.calls[0].callId;
}

function createToolCalls(prefix: string, count: number): LlmToolCall[] {
	return Array.from({ length: count }, (_, index) => ({
		id: `${prefix}-${index}`,
		name: `read_${index}`,
		arguments: { index },
	}));
}
