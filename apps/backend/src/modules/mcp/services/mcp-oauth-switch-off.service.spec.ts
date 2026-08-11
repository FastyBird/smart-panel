import { McpAuditService } from './mcp-audit.service';
import { McpOAuthGlobalInvalidationService } from './mcp-oauth-global-invalidation.service';
import { McpOAuthRouteGateService } from './mcp-oauth-route-gate.service';
import { McpOAuthRuntimeService } from './mcp-oauth-runtime.service';
import { McpOAuthSwitchOffService } from './mcp-oauth-switch-off.service';

describe('McpOAuthSwitchOffService', () => {
	let routeGate: { closeInternal: jest.Mock; openInternal: jest.Mock };
	let runtime: { deactivateInternal: jest.Mock };
	let globalInvalidation: { invalidate: jest.Mock; invalidateAll: jest.Mock };
	let auditService: { recordOAuthAuthorizationInvalidation: jest.Mock };
	let service: McpOAuthSwitchOffService;

	beforeEach(() => {
		routeGate = { closeInternal: jest.fn(), openInternal: jest.fn() };
		runtime = { deactivateInternal: jest.fn() };
		globalInvalidation = {
			invalidate: jest.fn(async (_generations: string[], commit: () => Promise<void>) => commit()),
			invalidateAll: jest.fn(async (_generations: string[], commit: () => Promise<void>) => commit()),
		};
		auditService = { recordOAuthAuthorizationInvalidation: jest.fn() };
		service = new McpOAuthSwitchOffService(
			routeGate as unknown as McpOAuthRouteGateService,
			runtime as unknown as McpOAuthRuntimeService,
			globalInvalidation as unknown as McpOAuthGlobalInvalidationService,
			auditService as unknown as McpAuditService,
		);
	});

	it('can close both authorization profiles for a combined module-disable mutation', async () => {
		const commit = jest.fn();

		await service.disableInternal(commit, {
			generations: ['oauthEnabledGeneration', 'publicIdentityGeneration'],
			reasons: ['module_disabled', 'public_identity_changed'],
			authorizationProfile: 'all',
		});

		expect(globalInvalidation.invalidateAll).toHaveBeenCalledWith(
			['oauthEnabledGeneration', 'publicIdentityGeneration'],
			expect.any(Function),
		);
		expect(globalInvalidation.invalidate).not.toHaveBeenCalled();
		expect(auditService.recordOAuthAuthorizationInvalidation).toHaveBeenCalledWith({
			reasons: ['module_disabled', 'public_identity_changed'],
			authorizationProfile: 'all',
			outcome: 'completed',
		});
	});

	it('closes the shared gate before advancing OAuth enablement and preserves the static profile', async () => {
		const order: string[] = [];
		routeGate.closeInternal.mockImplementation(() => order.push('gate_closed'));
		runtime.deactivateInternal.mockImplementation(() => order.push('runtime_deactivated'));
		globalInvalidation.invalidate.mockImplementation(async (_generations, commit: () => Promise<void>) => {
			order.push('invalidation_started');
			await commit();
			order.push('oauth_streams_closed');
		});
		const commit = jest.fn(() => {
			order.push('setting_persisted');

			return Promise.resolve();
		});

		await service.disableInternal(commit);

		expect(order).toEqual([
			'gate_closed',
			'runtime_deactivated',
			'invalidation_started',
			'setting_persisted',
			'oauth_streams_closed',
		]);
		expect(globalInvalidation.invalidate).toHaveBeenCalledWith(['oauthEnabledGeneration'], expect.any(Function));
		expect(routeGate.openInternal).not.toHaveBeenCalled();
		expect(auditService.recordOAuthAuthorizationInvalidation).toHaveBeenCalledWith({
			reasons: ['oauth_disabled'],
			authorizationProfile: 'oauth',
			outcome: 'completed',
		});
	});

	it('stays closed and does not audit when generation advancement fails', async () => {
		const commit = jest.fn();
		globalInvalidation.invalidate.mockRejectedValue(new Error('generation unavailable'));

		await expect(service.disableInternal(commit)).rejects.toThrow('generation unavailable');

		expect(routeGate.closeInternal).toHaveBeenCalledTimes(1);
		expect(runtime.deactivateInternal).toHaveBeenCalledTimes(1);
		expect(routeGate.openInternal).not.toHaveBeenCalled();
		expect(commit).not.toHaveBeenCalled();
		expect(auditService.recordOAuthAuthorizationInvalidation).not.toHaveBeenCalled();
	});

	it('audits a partial outcome and stays closed when persistence fails after invalidation', async () => {
		const commit = jest.fn().mockRejectedValue(new Error('configuration write failed'));

		await expect(service.disableInternal(commit)).rejects.toThrow('configuration write failed');

		expect(routeGate.closeInternal).toHaveBeenCalledTimes(1);
		expect(runtime.deactivateInternal).toHaveBeenCalledTimes(1);
		expect(routeGate.openInternal).not.toHaveBeenCalled();
		expect(auditService.recordOAuthAuthorizationInvalidation).toHaveBeenCalledWith({
			reasons: ['oauth_disabled'],
			authorizationProfile: 'oauth',
			outcome: 'partial',
		});
	});
});
