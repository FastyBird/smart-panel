import { AuthInfo, McpServer, ServerContext } from '@modelcontextprotocol/server';
import { ForbiddenException } from '@nestjs/common';

import { MCP_TOOL_CALL_TIMEOUT_MS, McpCapability } from '../mcp.constants';
import { McpContextService } from '../services/mcp-context.service';
import { McpPolicyService } from '../services/mcp-policy.service';

import { McpReadToolService } from './mcp-read-tool.service';

type ToolCallback = (
	args: Record<string, unknown>,
	ctx: ServerContext,
) => Promise<{ isError?: boolean; structuredContent: Record<string, unknown> }>;
type ResourceCallback = (uri: URL, ctx: ServerContext) => Promise<unknown>;

describe('McpReadToolService', () => {
	let service: McpReadToolService;
	let contextService: {
		getInstallation: jest.Mock;
		getSecurityStatus: jest.Mock;
	};
	let policyService: { authorizeClient: jest.Mock };
	let registerTool: jest.Mock;
	let registerResource: jest.Mock;
	let callbacks: Map<string, ToolCallback>;
	let resourceCallbacks: Map<string, ResourceCallback>;

	beforeEach(() => {
		contextService = {
			getInstallation: jest.fn().mockResolvedValue({
				id: 'installation-id',
				name: 'FastyBird Smart Panel',
				version: '1.0.0',
				timezone: 'UTC',
				endpoint: 'https://panel.test/api/v1/modules/mcp',
				effective_capabilities: [McpCapability.READ],
			}),
			getSecurityStatus: jest.fn().mockResolvedValue({ active_alerts_count: 0 }),
		};
		policyService = {
			authorizeClient: jest.fn().mockResolvedValue({ effectiveCapabilities: [McpCapability.READ] }),
		};
		callbacks = new Map();
		resourceCallbacks = new Map();
		registerTool = jest.fn((name: string, _config: unknown, callback: ToolCallback) => {
			callbacks.set(name, callback);
		});
		registerResource = jest.fn((name: string, _uri: unknown, _config: unknown, callback: ResourceCallback) => {
			resourceCallbacks.set(name, callback);
		});
		service = new McpReadToolService(
			contextService as unknown as McpContextService,
			policyService as unknown as McpPolicyService,
		);
	});

	it('registers no catalog when read is outside the effective capability set', () => {
		service.register(server(), authInfo([]));

		expect(registerTool).not.toHaveBeenCalled();
		expect(registerResource).not.toHaveBeenCalled();
	});

	it('registers the six read tools and three initial resources', () => {
		service.register(server(), authInfo([McpCapability.READ]));

		expect([...callbacks.keys()]).toEqual([
			'get_home_context',
			'get_device_state',
			'get_property_timeseries',
			'get_energy_summary',
			'get_weather',
			'get_security_status',
		]);
		expect(registerResource).toHaveBeenCalledTimes(3);
	});

	it('reauthorizes a tool call and returns structured installation metadata', async () => {
		service.register(server(), authInfo([McpCapability.READ]));
		const callback = callbacks.get('get_security_status');

		expect(callback).toBeDefined();
		const result = await callback?.({}, requestContext());

		expect(policyService.authorizeClient).toHaveBeenCalledWith('token-id', 'client-id', McpCapability.READ);
		expect(contextService.getSecurityStatus).toHaveBeenCalledTimes(1);
		expect(result?.isError).toBeUndefined();
		expect(result?.structuredContent.installation).toEqual(expect.objectContaining({ id: 'installation-id' }));
		expect(result?.structuredContent.tool).toBe('get_security_status');
		expect(result?.structuredContent.request_id).toBe('17');
		expect(result?.structuredContent.data).toEqual({ active_alerts_count: 0 });
	});

	it('returns a sanitized denial when live policy no longer grants read', async () => {
		policyService.authorizeClient.mockRejectedValue(new ForbiddenException('private policy detail'));
		service.register(server(), authInfo([McpCapability.READ]));
		const result = await callbacks.get('get_security_status')?.({}, requestContext());

		expect(result?.isError).toBe(true);
		expect(result?.structuredContent).toEqual(
			expect.objectContaining({
				data: null,
				error: {
					code: 'permission_denied',
					message: 'The MCP client is not authorized for this read operation.',
				},
			}),
		);
		expect(contextService.getSecurityStatus).not.toHaveBeenCalled();
	});

	it('returns a sanitized error when a domain call exceeds the MCP deadline', async () => {
		jest.useFakeTimers();
		contextService.getSecurityStatus.mockReturnValue(new Promise(() => undefined));
		service.register(server(), authInfo([McpCapability.READ]));

		try {
			const resultPromise = callbacks.get('get_security_status')?.({}, requestContext());

			await jest.advanceTimersByTimeAsync(MCP_TOOL_CALL_TIMEOUT_MS);
			const result = await resultPromise;

			expect(result?.isError).toBe(true);
			expect(result?.structuredContent.error).toEqual({
				code: 'read_failed',
				message: 'Smart Panel could not complete the requested read operation.',
			});
		} finally {
			jest.useRealTimers();
		}
	});

	it('enforces the same deadline for resource reads', async () => {
		jest.useFakeTimers();
		contextService.getInstallation.mockReturnValue(new Promise(() => undefined));
		service.register(server(), authInfo([McpCapability.READ]));

		try {
			const resultPromise = resourceCallbacks.get('installation')?.(
				new URL('smart-panel://installation'),
				requestContext(),
			);
			if (resultPromise === undefined) {
				throw new Error('Installation resource callback was not registered');
			}
			const rejection = expect(resultPromise).rejects.toThrow(`timeout after ${MCP_TOOL_CALL_TIMEOUT_MS}ms`);

			await jest.advanceTimersByTimeAsync(MCP_TOOL_CALL_TIMEOUT_MS);
			await rejection;
		} finally {
			jest.useRealTimers();
		}
	});

	function server(): McpServer {
		return { registerTool, registerResource } as unknown as McpServer;
	}

	function authInfo(scopes: McpCapability[]): AuthInfo {
		return {
			token: 'raw-token',
			clientId: 'client-id',
			scopes,
			extra: {
				endpoint: 'https://panel.test/api/v1/modules/mcp',
				installationId: 'installation-id',
				tokenId: 'token-id',
			},
		};
	}

	function requestContext(): ServerContext {
		return {
			http: { authInfo: authInfo([McpCapability.READ]) },
			mcpReq: { id: 17 },
		} as unknown as ServerContext;
	}
});
