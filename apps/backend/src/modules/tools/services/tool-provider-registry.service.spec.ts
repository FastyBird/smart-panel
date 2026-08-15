import { z } from 'zod';

import { createExtensionLogger } from '../../../common/logger';
import {
	LlmToolCall,
	ToolAccessKind,
	ToolAudience,
	ToolDefinition,
	ToolExecutionContext,
	ToolExecutionResult,
	ToolExecutionStatus,
	createToolDefinition,
} from '../platforms/tool-provider.platform';

import { BaseToolProviderService } from './base-tool-provider.service';
import {
	TOOL_RESULT_MAX_ERROR_CODE_UTF8_BYTES,
	TOOL_RESULT_MAX_JSON_BYTES,
	TOOL_RESULT_MAX_MESSAGE_UTF8_BYTES,
	ToolProviderRegistryService,
} from './tool-provider-registry.service';

const inputSchema = z.object({ value: z.string() });
const outputSchema = z.object({ value: z.string() });

const definition = (name: string, audiences: ToolAudience[], access: ToolAccessKind): ToolDefinition =>
	createToolDefinition({
		name,
		description: `${name} description`,
		audiences,
		access,
		inputSchema,
		outputSchema,
	});

class TestToolProvider extends BaseToolProviderService {
	protected readonly logger = createExtensionLogger('tools-module', 'TestToolProvider');
	protected readonly toolExecutionTimeoutMs: number;

	readonly contexts: ToolExecutionContext[] = [];

	constructor(
		private readonly type: string,
		private readonly definitions: ToolDefinition[],
		private readonly handler: (
			toolCall: LlmToolCall,
			context: ToolExecutionContext,
		) => Promise<ToolExecutionResult | null>,
		timeoutMs = 5_000,
	) {
		super();
		this.toolExecutionTimeoutMs = timeoutMs;
	}

	getType(): string {
		return this.type;
	}

	getToolDefinitions(): ToolDefinition[] {
		return this.definitions;
	}

	protected async handleToolCall(
		toolCall: LlmToolCall,
		context: ToolExecutionContext,
	): Promise<ToolExecutionResult | null> {
		this.contexts.push(context);

		return this.handler(toolCall, context);
	}
}

const completed = (value: string): ToolExecutionResult => ({
	success: true,
	status: ToolExecutionStatus.COMPLETED,
	message: value,
	data: { value },
});

describe('ToolProviderRegistryService', () => {
	let registry: ToolProviderRegistryService;

	beforeEach(() => {
		registry = new ToolProviderRegistryService();
	});

	it('filters definitions by audience and access kind, defaulting to Buddy', () => {
		registry.register(
			new TestToolProvider(
				'provider-a',
				[
					definition('buddy-read', [ToolAudience.BUDDY], ToolAccessKind.READ),
					definition('shared-write', [ToolAudience.BUDDY, ToolAudience.MCP], ToolAccessKind.WRITE),
					definition('mcp-trigger', [ToolAudience.MCP], ToolAccessKind.TRIGGER),
				],
				() => Promise.resolve(completed('ok')),
			),
		);

		expect(registry.getAllToolDefinitions().map(({ name }) => name)).toEqual(['buddy-read', 'shared-write']);
		expect(
			registry
				.getAllToolDefinitions({ audience: ToolAudience.MCP, accessKinds: [ToolAccessKind.TRIGGER] })
				.map(({ name }) => name),
		).toEqual(['mcp-trigger']);
	});

	it('rejects duplicate tool names atomically', () => {
		registry.register(
			new TestToolProvider('provider-a', [definition('shared-name', [ToolAudience.BUDDY], ToolAccessKind.READ)], () =>
				Promise.resolve(completed('a')),
			),
		);

		expect(() =>
			registry.register(
				new TestToolProvider('provider-b', [definition('shared-name', [ToolAudience.MCP], ToolAccessKind.WRITE)], () =>
					Promise.resolve(completed('b')),
				),
			),
		).toThrow("Tool name 'shared-name'");
		expect(registry.list()).toEqual(['provider-a']);
	});

	it('enforces audience and access before invoking a provider', async () => {
		const handler = jest.fn(() => Promise.resolve(completed('called')));

		registry.register(
			new TestToolProvider('provider-a', [definition('write-tool', [ToolAudience.MCP], ToolAccessKind.WRITE)], handler),
		);

		const audienceDenied = await registry.executeTool({ id: '1', name: 'write-tool', arguments: {} });
		const accessDenied = await registry.executeTool(
			{ id: '2', name: 'write-tool', arguments: {} },
			{ audience: ToolAudience.MCP, source: 'mcp', allowedAccessKinds: [ToolAccessKind.READ] },
		);

		expect(audienceDenied.status).toBe(ToolExecutionStatus.DENIED);
		expect(audienceDenied.errorCode).toBe('TOOL_AUDIENCE_DENIED');
		expect(accessDenied.status).toBe(ToolExecutionStatus.DENIED);
		expect(accessDenied.errorCode).toBe('TOOL_ACCESS_DENIED');
		expect(handler).not.toHaveBeenCalled();
	});

	it('bounds registry-generated messages for Buddy while preserving the MCP text', async () => {
		const toolName = 'missing-'.padEnd(TOOL_RESULT_MAX_MESSAGE_UTF8_BYTES + 200, 'x');
		const buddy = await registry.executeTool({ id: 'buddy', name: toolName, arguments: {} });
		const mcp = await registry.executeTool(
			{ id: 'mcp', name: toolName, arguments: {} },
			{ audience: ToolAudience.MCP, source: ToolAudience.MCP },
		);

		expect(Buffer.byteLength(buddy.message, 'utf8')).toBe(TOOL_RESULT_MAX_MESSAGE_UTF8_BYTES);
		expect(buddy.truncated).toBe(true);
		expect(mcp.message).toBe(`Unknown tool: ${toolName}`);
		expect(mcp.truncated).toBeUndefined();
	});

	it('propagates execution context to the indexed provider', async () => {
		const provider = new TestToolProvider(
			'provider-a',
			[definition('read-tool', [ToolAudience.MCP], ToolAccessKind.READ)],
			() => Promise.resolve(completed('ok')),
		);

		registry.register(provider);

		const result = await registry.executeTool(
			{ id: 'request-1', name: 'read-tool', arguments: { value: 'x' } },
			{ audience: ToolAudience.MCP, source: 'mcp', actorId: 'client-1' },
		);

		expect(result.status).toBe(ToolExecutionStatus.COMPLETED);
		expect(provider.contexts).toEqual([
			expect.objectContaining({
				audience: ToolAudience.MCP,
				source: 'mcp',
				actorId: 'client-1',
				requestId: 'request-1',
			}),
		]);
	});

	it('strips and transforms Buddy structured data through the output schema', async () => {
		const result = {
			...completed('validated'),
			data: { value: ' validated ', secret: 'must not reach the model' },
		};
		const parsedDefinition = createToolDefinition({
			name: 'read-tool',
			description: 'read-tool description',
			audiences: [ToolAudience.BUDDY],
			access: ToolAccessKind.READ,
			inputSchema,
			outputSchema: z.object({ value: z.string().transform((value) => value.trim()) }),
		});

		registry.register(new TestToolProvider('provider-a', [parsedDefinition], () => Promise.resolve(result)));

		await expect(
			registry.executeTool({ id: 'request-1', name: 'read-tool', arguments: { value: 'x' } }),
		).resolves.toEqual({ ...result, data: { value: 'validated' } });
	});

	it('accepts exactly 32 KiB of Buddy structured JSON and omits one byte over', async () => {
		const envelopeBytes = Buffer.byteLength(JSON.stringify({ value: '' }), 'utf8');
		const exactValue = 'x'.repeat(TOOL_RESULT_MAX_JSON_BYTES - envelopeBytes);
		const results = [completed(exactValue), completed(`${exactValue}x`)];
		const provider = new TestToolProvider(
			'provider-a',
			[definition('read-tool', [ToolAudience.BUDDY], ToolAccessKind.READ)],
			() => Promise.resolve(results.shift() ?? null),
		);

		registry.register(provider);

		const accepted = await registry.executeTool({ id: '1', name: 'read-tool', arguments: {} });
		const omitted = await registry.executeTool({ id: '2', name: 'read-tool', arguments: {} });

		expect(Buffer.byteLength(JSON.stringify(accepted.data), 'utf8')).toBe(TOOL_RESULT_MAX_JSON_BYTES);
		expect(accepted.data).toEqual({ value: exactValue });
		expect(omitted).toEqual(expect.objectContaining({ data: undefined, truncated: true }));
	});

	it('bounds no-data Buddy messages and error codes at exact UTF-8 boundaries', async () => {
		const exactMessage = `${'m'.repeat(TOOL_RESULT_MAX_MESSAGE_UTF8_BYTES - 4)}😀`;
		const exactErrorCode = 'E'.repeat(TOOL_RESULT_MAX_ERROR_CODE_UTF8_BYTES);
		const results: ToolExecutionResult[] = [
			{
				success: false,
				status: ToolExecutionStatus.FAILED,
				message: exactMessage,
				errorCode: exactErrorCode,
			},
			{
				success: false,
				status: ToolExecutionStatus.FAILED,
				message: `${exactMessage}x`,
				errorCode: `${exactErrorCode}X`,
			},
		];
		const provider = new TestToolProvider(
			'provider-a',
			[definition('read-tool', [ToolAudience.BUDDY], ToolAccessKind.READ)],
			() => Promise.resolve(results.shift() ?? null),
		);

		registry.register(provider);

		await expect(registry.executeTool({ id: '1', name: 'read-tool', arguments: {} })).resolves.toEqual({
			success: false,
			status: ToolExecutionStatus.FAILED,
			message: exactMessage,
			errorCode: exactErrorCode,
		});
		await expect(registry.executeTool({ id: '2', name: 'read-tool', arguments: {} })).resolves.toEqual({
			success: false,
			status: ToolExecutionStatus.FAILED,
			message: exactMessage,
			errorCode: exactErrorCode,
			truncated: true,
		});
	});

	it('omits Buddy data when an output-schema transform throws while preserving execution status', async () => {
		const throwingDefinition = createToolDefinition({
			name: 'read-tool',
			description: 'read-tool description',
			audiences: [ToolAudience.BUDDY],
			access: ToolAccessKind.READ,
			inputSchema,
			outputSchema: z.object({
				value: z.string().transform(() => {
					throw new Error('private transform detail');
				}),
			}),
		});
		const result: ToolExecutionResult = {
			success: true,
			status: ToolExecutionStatus.PARTIAL,
			message: 'Partial read',
			data: { value: 'unsafe' },
		};

		registry.register(new TestToolProvider('provider-a', [throwingDefinition], () => Promise.resolve(result)));

		await expect(registry.executeTool({ id: '1', name: 'read-tool', arguments: {} })).resolves.toEqual({
			success: true,
			status: ToolExecutionStatus.PARTIAL,
			message: 'Partial read',
			errorCode: 'INVALID_TOOL_RESULT_DATA',
			truncated: true,
		});
	});

	it('preserves MCP string fields while retaining the shared schema and data bound', async () => {
		const rawResult: ToolExecutionResult = {
			success: true,
			status: ToolExecutionStatus.COMPLETED,
			message: 'm'.repeat(TOOL_RESULT_MAX_MESSAGE_UTF8_BYTES + 1),
			data: { value: ' raw ', secret: 'strip me' },
			errorCode: 'E'.repeat(TOOL_RESULT_MAX_ERROR_CODE_UTF8_BYTES + 1),
		};
		const mcpDefinition = createToolDefinition({
			name: 'read-tool',
			description: 'read-tool description',
			audiences: [ToolAudience.BUDDY, ToolAudience.MCP],
			access: ToolAccessKind.READ,
			inputSchema,
			outputSchema: z.object({ value: z.string().transform((value) => value.trim()) }),
		});

		registry.register(new TestToolProvider('provider-a', [mcpDefinition], () => Promise.resolve(rawResult)));

		const result = await registry.executeTool(
			{ id: '1', name: 'read-tool', arguments: {} },
			{ audience: ToolAudience.MCP, source: ToolAudience.MCP },
		);

		expect(result).toEqual({ ...rawResult, data: { value: 'raw' } });
		expect(result.message).toBe(rawResult.message);
		expect(result.errorCode).toBe(rawResult.errorCode);
		expect(result.truncated).toBeUndefined();
	});

	it('omits invalid, oversized, and non-serializable structured data without changing execution status', async () => {
		const cyclicData: Record<string, unknown> = { value: 'cyclic' };

		cyclicData.self = cyclicData;

		const results: ToolExecutionResult[] = [
			{ ...completed('invalid'), data: { unexpected: true } },
			{ ...completed('oversized'), data: { value: 'x'.repeat(TOOL_RESULT_MAX_JSON_BYTES) } },
			{ ...completed('cyclic'), data: cyclicData },
		];
		const provider = new TestToolProvider(
			'provider-a',
			[
				definition('read-tool', [ToolAudience.BUDDY], ToolAccessKind.READ),
				createToolDefinition({
					name: 'passthrough-tool',
					description: 'passthrough-tool description',
					audiences: [ToolAudience.BUDDY],
					access: ToolAccessKind.READ,
					inputSchema,
					outputSchema: outputSchema.passthrough(),
				}),
			],
			() => Promise.resolve(results.shift() ?? null),
		);

		registry.register(provider);

		const bounded = await Promise.all(
			['read-tool', 'read-tool', 'passthrough-tool'].map((name, index) =>
				registry.executeTool({ id: String(index + 1), name, arguments: { value: 'x' } }),
			),
		);

		expect(bounded).toEqual([
			expect.objectContaining({
				success: true,
				status: ToolExecutionStatus.COMPLETED,
				data: undefined,
				errorCode: 'INVALID_TOOL_RESULT_DATA',
				truncated: true,
			}),
			expect.objectContaining({
				success: true,
				status: ToolExecutionStatus.COMPLETED,
				data: undefined,
				truncated: true,
			}),
			expect.objectContaining({
				success: true,
				status: ToolExecutionStatus.COMPLETED,
				data: undefined,
				errorCode: 'INVALID_TOOL_RESULT_DATA',
				truncated: true,
			}),
		]);
	});

	it('returns structured unknown-tool, sanitized-error, and timeout results', async () => {
		const throwingProvider = new TestToolProvider(
			'throwing-provider',
			[definition('throwing-tool', [ToolAudience.BUDDY], ToolAccessKind.READ)],
			() => Promise.reject(new Error('secret internal detail')),
		);
		const timeoutProvider = new TestToolProvider(
			'timeout-provider',
			[definition('timeout-tool', [ToolAudience.BUDDY], ToolAccessKind.READ)],
			() => new Promise(() => undefined),
			1,
		);

		registry.register(throwingProvider);
		registry.register(timeoutProvider);

		const unknown = await registry.executeTool({ id: '1', name: 'missing', arguments: {} });
		const failed = await registry.executeTool({ id: '2', name: 'throwing-tool', arguments: { value: 'x' } });
		const timedOut = await registry.executeTool({ id: '3', name: 'timeout-tool', arguments: { value: 'x' } });

		expect(unknown).toEqual(expect.objectContaining({ status: ToolExecutionStatus.FAILED, errorCode: 'UNKNOWN_TOOL' }));
		expect(failed).toEqual(
			expect.objectContaining({
				status: ToolExecutionStatus.FAILED,
				errorCode: 'TOOL_EXECUTION_FAILED',
				message: 'Failed to execute tool "throwing-tool"',
			}),
		);
		expect(failed.message).not.toContain('secret');
		expect(timedOut).toEqual(
			expect.objectContaining({
				status: ToolExecutionStatus.TIMED_OUT,
				errorCode: 'TOOL_EXECUTION_TIMEOUT',
			}),
		);
	});

	it('does not time out write or trigger execution without cancellation', async () => {
		jest.useFakeTimers();

		try {
			const resolvers = new Map<string, (result: ToolExecutionResult) => void>();
			const provider = new TestToolProvider(
				'side-effect-provider',
				[
					definition('write-tool', [ToolAudience.MCP], ToolAccessKind.WRITE),
					definition('trigger-tool', [ToolAudience.MCP], ToolAccessKind.TRIGGER),
				],
				(toolCall) =>
					new Promise((resolve) => {
						resolvers.set(toolCall.name, resolve);
					}),
				1,
			);

			registry.register(provider);

			const context = {
				audience: ToolAudience.MCP,
				source: 'mcp',
				allowedAccessKinds: [ToolAccessKind.WRITE, ToolAccessKind.TRIGGER],
			};
			const writeResult = registry.executeTool({ id: '1', name: 'write-tool', arguments: {} }, context);
			const triggerResult = registry.executeTool({ id: '2', name: 'trigger-tool', arguments: {} }, context);

			await jest.advanceTimersByTimeAsync(1);
			resolvers.get('write-tool')?.(completed('write completed'));
			resolvers.get('trigger-tool')?.(completed('trigger completed'));

			await expect(writeResult).resolves.toEqual(completed('write completed'));
			await expect(triggerResult).resolves.toEqual(completed('trigger completed'));
		} finally {
			jest.useRealTimers();
		}
	});
});
