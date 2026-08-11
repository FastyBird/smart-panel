import { McpOAuthProviderFactory, McpOAuthProviderRuntime } from '../oauth/mcp-oauth-provider.factory';

import { MCP_OAUTH_REQUIRED_READINESS_CONTROLS, McpOAuthReadinessService } from './mcp-oauth-readiness.service';
import { McpOAuthRouteGateService } from './mcp-oauth-route-gate.service';
import { McpOAuthRuntimeService } from './mcp-oauth-runtime.service';

describe('McpOAuthRuntimeService', () => {
	it('does not expose an initialized provider until the shared route gate opens', async () => {
		const runtime = { provider: {}, callback: jest.fn(), urls: {}, metadata: {} } as unknown as McpOAuthProviderRuntime;
		const providerFactory = { create: jest.fn().mockResolvedValue(runtime) };
		const readiness = new McpOAuthReadinessService();
		readiness.register(...MCP_OAUTH_REQUIRED_READINESS_CONTROLS);
		readiness.onApplicationBootstrap();
		const routeGate = new McpOAuthRouteGateService(readiness);
		const service = new McpOAuthRuntimeService(providerFactory as unknown as McpOAuthProviderFactory, routeGate);

		await expect(service.activateInternal()).resolves.toBe(runtime);
		expect(() => service.getActive()).toThrow('The MCP OAuth route gate is closed');

		routeGate.openInternal();

		expect(service.getActive()).toBe(runtime);
	});

	it('hides the provider immediately after deactivation', async () => {
		const runtime = { provider: {}, callback: jest.fn(), urls: {}, metadata: {} } as unknown as McpOAuthProviderRuntime;
		const providerFactory = { create: jest.fn().mockResolvedValue(runtime) };
		const readiness = new McpOAuthReadinessService();
		readiness.register(...MCP_OAUTH_REQUIRED_READINESS_CONTROLS);
		readiness.onApplicationBootstrap();
		const routeGate = new McpOAuthRouteGateService(readiness);
		const service = new McpOAuthRuntimeService(providerFactory as unknown as McpOAuthProviderFactory, routeGate);
		await service.activateInternal();
		routeGate.openInternal();

		service.deactivateInternal();

		expect(() => service.getActive()).toThrow('The internal MCP OAuth route gate is closed');
	});

	it('does not retain an activation that finishes after switch-off', async () => {
		const staleRuntime = {
			provider: {},
			callback: jest.fn(),
			urls: {},
			metadata: {},
		} as unknown as McpOAuthProviderRuntime;
		const freshRuntime = {
			provider: {},
			callback: jest.fn(),
			urls: {},
			metadata: {},
		} as unknown as McpOAuthProviderRuntime;
		let resolveActivation = (_runtime: McpOAuthProviderRuntime): void => undefined;
		const delayedActivation = new Promise<McpOAuthProviderRuntime>((resolve) => {
			resolveActivation = resolve;
		});
		const providerFactory = {
			create: jest.fn().mockReturnValueOnce(delayedActivation).mockResolvedValueOnce(freshRuntime),
		};
		const readiness = new McpOAuthReadinessService();
		readiness.register(...MCP_OAUTH_REQUIRED_READINESS_CONTROLS);
		readiness.onApplicationBootstrap();
		const routeGate = new McpOAuthRouteGateService(readiness);
		const service = new McpOAuthRuntimeService(providerFactory as unknown as McpOAuthProviderFactory, routeGate);
		routeGate.openInternal();
		const staleActivation = service.activateInternal();

		service.deactivateInternal();
		resolveActivation(staleRuntime);

		await expect(staleActivation).rejects.toThrow('MCP OAuth provider activation was cancelled');
		expect(() => service.getActive()).toThrow('The internal MCP OAuth route gate is closed');
		await expect(service.activateInternal()).resolves.toBe(freshRuntime);
		expect(service.getActive()).toBe(freshRuntime);
	});
});
