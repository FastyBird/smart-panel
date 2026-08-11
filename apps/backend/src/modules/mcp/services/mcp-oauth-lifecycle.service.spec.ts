import { ConfigService } from '../../config/services/config.service';
import { MCP_MODULE_NAME } from '../mcp.constants';
import { McpConfigModel } from '../models/config.model';

import { McpOAuthLifecycleService } from './mcp-oauth-lifecycle.service';
import { McpOAuthReadinessService } from './mcp-oauth-readiness.service';
import { McpOAuthRouteGateService } from './mcp-oauth-route-gate.service';
import { McpOAuthRuntimeService } from './mcp-oauth-runtime.service';

describe('McpOAuthLifecycleService', () => {
	let config: McpConfigModel;
	let readiness: { assertReady: jest.Mock };
	let routeGate: { closeInternal: jest.Mock; openInternal: jest.Mock };
	let runtime: { allowActivationInternal: jest.Mock; activateInternal: jest.Mock; deactivateInternal: jest.Mock };
	let service: McpOAuthLifecycleService;

	beforeEach(() => {
		config = Object.assign(new McpConfigModel(), { enabled: true, oauthEnabled: true });
		readiness = { assertReady: jest.fn() };
		routeGate = { closeInternal: jest.fn(), openInternal: jest.fn() };
		runtime = {
			allowActivationInternal: jest.fn(),
			activateInternal: jest.fn().mockResolvedValue({}),
			deactivateInternal: jest.fn(),
		};
		service = new McpOAuthLifecycleService(
			{
				getModuleConfig: jest.fn((type: string) => (type === MCP_MODULE_NAME ? config : undefined)),
			} as unknown as ConfigService,
			readiness as unknown as McpOAuthReadinessService,
			routeGate as unknown as McpOAuthRouteGateService,
			runtime as unknown as McpOAuthRuntimeService,
		);
	});

	it('opens the complete route gate only after readiness and provider activation succeed', async () => {
		const order: string[] = [];
		routeGate.closeInternal.mockImplementation(() => order.push('closed'));
		readiness.assertReady.mockImplementation(() => order.push('ready'));
		runtime.allowActivationInternal.mockImplementation(() => order.push('allowed'));
		runtime.activateInternal.mockImplementation(() => {
			order.push('activated');

			return Promise.resolve({});
		});
		routeGate.openInternal.mockImplementation(() => order.push('opened'));

		await service.activateInternal();

		expect(order).toEqual(['closed', 'ready', 'allowed', 'activated', 'ready', 'opened']);
	});

	it('deactivates and remains closed when provider activation fails', async () => {
		const failure = new Error('provider material unavailable');
		runtime.activateInternal.mockRejectedValue(failure);

		await expect(service.activateInternal()).rejects.toBe(failure);

		expect(routeGate.closeInternal).toHaveBeenCalledTimes(2);
		expect(runtime.deactivateInternal).toHaveBeenCalledTimes(1);
		expect(routeGate.openInternal).not.toHaveBeenCalled();
	});

	it('closes the old runtime before mutation and reactivates only after it commits', async () => {
		const order: string[] = [];
		routeGate.closeInternal.mockImplementation(() => order.push('closed'));
		runtime.deactivateInternal.mockImplementation(() => order.push('deactivated'));
		readiness.assertReady.mockImplementation(() => order.push('ready'));
		runtime.allowActivationInternal.mockImplementation(() => order.push('allowed'));
		runtime.activateInternal.mockImplementation(() => {
			order.push('activated');

			return Promise.resolve({});
		});
		routeGate.openInternal.mockImplementation(() => order.push('opened'));

		await service.reconfigureInternal(() => {
			order.push('committed');
		});

		expect(order).toEqual([
			'closed',
			'deactivated',
			'committed',
			'closed',
			'ready',
			'allowed',
			'activated',
			'ready',
			'opened',
		]);
	});

	it('does not reactivate after a failed invalidating mutation', async () => {
		const failure = new Error('invalidation failed');

		await expect(service.reconfigureInternal(() => Promise.reject(failure))).rejects.toBe(failure);

		expect(runtime.deactivateInternal).toHaveBeenCalledTimes(1);
		expect(runtime.allowActivationInternal).not.toHaveBeenCalled();
		expect(routeGate.openInternal).not.toHaveBeenCalled();
	});

	it('activates configured OAuth during startup', async () => {
		await service.onApplicationBootstrap();

		expect(runtime.activateInternal).toHaveBeenCalledTimes(1);
		expect(routeGate.openInternal).toHaveBeenCalledTimes(1);
	});

	it('keeps OAuth closed during startup when either configuration switch is off', async () => {
		config.oauthEnabled = false;

		await service.onApplicationBootstrap();

		expect(routeGate.closeInternal).toHaveBeenCalledTimes(1);
		expect(runtime.deactivateInternal).toHaveBeenCalledTimes(1);
		expect(runtime.activateInternal).not.toHaveBeenCalled();
	});

	it('immediately closes and deactivates OAuth when global configuration is reset', () => {
		service.onConfigReset();

		expect(routeGate.closeInternal).toHaveBeenCalledTimes(1);
		expect(runtime.deactivateInternal).toHaveBeenCalledTimes(1);
	});

	it('fails closed without aborting application bootstrap when activation fails', async () => {
		runtime.activateInternal.mockRejectedValue(new Error('provider activation failed'));

		await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();

		expect(routeGate.openInternal).not.toHaveBeenCalled();
		expect(runtime.deactivateInternal).toHaveBeenCalledTimes(1);
	});
});
