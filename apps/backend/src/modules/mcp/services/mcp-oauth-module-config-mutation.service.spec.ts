import { Repository } from 'typeorm';

import { ServiceUnavailableException } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { UpdateMcpConfigDto } from '../dto/update-config.dto';
import { McpOAuthServerStateEntity } from '../entities/mcp-oauth.entity';
import { MCP_MODULE_NAME, MCP_OAUTH_SERVER_STATE_KEY, McpCapability, McpOAuthScope } from '../mcp.constants';
import { McpConfigModel } from '../models/config.model';

import { McpAuditService } from './mcp-audit.service';
import { McpOAuthGlobalInvalidationService } from './mcp-oauth-global-invalidation.service';
import { McpOAuthLifecycleService } from './mcp-oauth-lifecycle.service';
import { McpOAuthModuleConfigMutationService } from './mcp-oauth-module-config-mutation.service';
import { McpOAuthRouteGateService } from './mcp-oauth-route-gate.service';
import { McpOAuthRuntimeService } from './mcp-oauth-runtime.service';
import { McpOAuthSwitchOffService } from './mcp-oauth-switch-off.service';
import { McpOAuthSubscriptionBinding, McpSubscriptionRegistryService } from './mcp-subscription-registry.service';

const deferred = <T = void>(): { promise: Promise<T>; resolve: (value: T) => void } => {
	let resolve = (_value: T): void => undefined;
	const promise = new Promise<T>((resolver) => {
		resolve = resolver;
	});

	return { promise, resolve };
};

const oauthBinding = (effectiveScopes: McpOAuthScope[]): McpOAuthSubscriptionBinding => ({
	accessTokenId: 'access-one',
	approverAuthorityGeneration: 0,
	approverId: 'approver-one',
	grantId: 'grant-one',
	authorizationDeadline: new Date(Date.now() + 60_000),
	effectiveScopes,
	modulePolicyGeneration: 1,
	oauthEnabledGeneration: 4,
	publicIdentityGeneration: 5,
	serverSecretVersion: 6,
	clientGeneration: 2,
	grantGeneration: 3,
});

describe('McpOAuthModuleConfigMutationService', () => {
	let config: McpConfigModel;
	let configService: { getModuleConfig: jest.Mock; reload: jest.Mock };
	let serverState: { increment: jest.Mock };
	let globalInvalidation: { invalidate: jest.Mock; invalidateAll: jest.Mock };
	let auditService: {
		recordOAuthAuthorizationInvalidation: jest.Mock;
		recordSubscriptionClosed: jest.Mock;
		recordSubscriptionOpened: jest.Mock;
	};
	let lifecycle: { reconfigureInternal: jest.Mock };
	let routeGate: { isOpen: boolean };
	let switchOff: McpOAuthSwitchOffService;
	let switchOffDisableSpy: jest.SpyInstance;
	let subscriptions: McpSubscriptionRegistryService;
	let service: McpOAuthModuleConfigMutationService;

	beforeEach(() => {
		config = new McpConfigModel();
		config.enabled = true;
		config.capabilities = [McpCapability.READ, McpCapability.WRITE, McpCapability.TRIGGER];
		configService = {
			getModuleConfig: jest.fn().mockImplementation(() => config),
			reload: jest.fn(),
		};
		serverState = {
			increment: jest.fn().mockResolvedValue({ affected: 1 }),
		};
		globalInvalidation = {
			invalidate: jest.fn(async (_generations: string[], commit: () => Promise<void> | void) => commit()),
			invalidateAll: jest.fn(async (_generations: string[], commit: () => Promise<void> | void) => commit()),
		};
		auditService = {
			recordOAuthAuthorizationInvalidation: jest.fn(),
			recordSubscriptionClosed: jest.fn(),
			recordSubscriptionOpened: jest.fn(),
		};
		lifecycle = {
			reconfigureInternal: jest.fn(async (mutation: () => Promise<void>) => mutation()),
		};
		routeGate = { isOpen: true };
		subscriptions = new McpSubscriptionRegistryService(auditService as unknown as McpAuditService);
		switchOff = new McpOAuthSwitchOffService(
			{ closeInternal: jest.fn() } as unknown as McpOAuthRouteGateService,
			{ deactivateInternal: jest.fn() } as unknown as McpOAuthRuntimeService,
			globalInvalidation as unknown as McpOAuthGlobalInvalidationService,
			auditService as unknown as McpAuditService,
		);
		switchOffDisableSpy = jest.spyOn(switchOff, 'disableInternal');
		service = new McpOAuthModuleConfigMutationService(
			configService as unknown as ConfigService,
			serverState as unknown as Repository<McpOAuthServerStateEntity>,
			subscriptions,
			globalInvalidation as unknown as McpOAuthGlobalInvalidationService,
			auditService as unknown as McpAuditService,
			routeGate as unknown as McpOAuthRouteGateService,
			lifecycle as unknown as McpOAuthLifecycleService,
			switchOff,
		);
	});

	afterEach(async () => {
		await subscriptions.closeAll();
	});

	it('advances policy generation, commits, and selectively closes contracted OAuth streams', async () => {
		const staticStream = subscriptions.open('static-client');
		const readStream = await subscriptions.openOAuth('read-stream', () =>
			Promise.resolve({ clientId: 'read-client', binding: oauthBinding([McpOAuthScope.READ]) }),
		);
		const writeStream = await subscriptions.openOAuth('write-stream', () =>
			Promise.resolve({
				clientId: 'write-client',
				binding: oauthBinding([McpOAuthScope.READ, McpOAuthScope.WRITE]),
			}),
		);
		const commit = jest.fn().mockImplementation(() => {
			config.capabilities = [McpCapability.READ];
		});

		await service.update({ type: MCP_MODULE_NAME, capabilities: [McpCapability.READ] } as UpdateMcpConfigDto, commit);

		expect(serverState.increment).toHaveBeenCalledWith(
			{ key: MCP_OAUTH_SERVER_STATE_KEY },
			'modulePolicyGeneration',
			1,
		);
		expect(commit).toHaveBeenCalledTimes(1);
		expect(readStream.signal.aborted).toBe(false);
		expect(writeStream.signal.aborted).toBe(true);
		expect(staticStream.signal.aborted).toBe(false);
		expect(auditService.recordOAuthAuthorizationInvalidation).toHaveBeenCalledWith({
			reasons: ['module_policy_changed'],
			authorizationProfile: 'oauth',
			outcome: 'completed',
		});
	});

	it('holds queued OAuth registration until the new policy has committed', async () => {
		const oldWriteStream = await subscriptions.openOAuth('old-write', () =>
			Promise.resolve({
				clientId: 'old-client',
				binding: oauthBinding([McpOAuthScope.READ, McpOAuthScope.WRITE]),
			}),
		);
		const incrementStarted = deferred();
		const releaseIncrement = deferred();
		serverState.increment.mockImplementation(async () => {
			incrementStarted.resolve();
			await releaseIncrement.promise;

			return { affected: 1 };
		});
		const commit = jest.fn().mockImplementation(() => {
			config.capabilities = [McpCapability.READ];
		});
		const mutation = service.update(
			{ type: MCP_MODULE_NAME, capabilities: [McpCapability.READ] } as UpdateMcpConfigDto,
			commit,
		);

		await incrementStarted.promise;

		const observedCapabilities: McpCapability[][] = [];
		const registration = subscriptions.openOAuth('queued-open', () => {
			observedCapabilities.push([...config.capabilities]);

			return Promise.resolve({
				clientId: 'new-client',
				binding: oauthBinding([McpOAuthScope.READ]),
			});
		});
		await Promise.resolve();
		expect(observedCapabilities).toEqual([]);

		releaseIncrement.resolve();
		await mutation;
		const newReadStream = await registration;

		expect(commit).toHaveBeenCalledTimes(1);
		expect(auditService.recordOAuthAuthorizationInvalidation).toHaveBeenCalledWith({
			reasons: ['module_policy_changed'],
			authorizationProfile: 'oauth',
			outcome: 'completed',
		});
		expect(observedCapabilities).toEqual([[McpCapability.READ]]);
		expect(oldWriteStream.signal.aborted).toBe(true);
		expect(newReadStream.signal.aborted).toBe(false);
	});

	it('advances policy generation for capability expansion without closing valid streams', async () => {
		config.capabilities = [McpCapability.READ];
		const readStream = await subscriptions.openOAuth('read-stream', () =>
			Promise.resolve({ clientId: 'read-client', binding: oauthBinding([McpOAuthScope.READ]) }),
		);
		const commit = jest.fn().mockImplementation(() => {
			config.capabilities = [McpCapability.READ, McpCapability.WRITE];
		});

		await service.update(
			{ type: MCP_MODULE_NAME, capabilities: [McpCapability.READ, McpCapability.WRITE] } as UpdateMcpConfigDto,
			commit,
		);

		expect(serverState.increment).toHaveBeenCalledTimes(1);
		expect(commit).toHaveBeenCalledTimes(1);
		expect(auditService.recordOAuthAuthorizationInvalidation).toHaveBeenCalledWith({
			reasons: ['module_policy_changed'],
			authorizationProfile: 'oauth',
			outcome: 'completed',
		});
		expect(readStream.signal.aborted).toBe(false);
	});

	it('commits unchanged capabilities without advancing policy generation', async () => {
		const commit = jest.fn();

		await service.update(
			{
				type: MCP_MODULE_NAME,
				capabilities: [McpCapability.TRIGGER, McpCapability.READ, McpCapability.WRITE],
			} as UpdateMcpConfigDto,
			commit,
		);

		expect(serverState.increment).not.toHaveBeenCalled();
		expect(commit).toHaveBeenCalledTimes(1);
		expect(auditService.recordOAuthAuthorizationInvalidation).not.toHaveBeenCalled();
	});

	it('routes public OAuth identity changes through global invalidation', async () => {
		config.oauthPublicBaseUrl = 'https://panel.example.com';
		const commit = jest.fn().mockImplementation(() => {
			config.oauthPublicBaseUrl = 'https://new-panel.example.com';
		});

		await service.update(
			{ type: MCP_MODULE_NAME, oauth_public_base_url: 'https://new-panel.example.com' } as UpdateMcpConfigDto,
			commit,
		);

		expect(globalInvalidation.invalidate).toHaveBeenCalledWith(['publicIdentityGeneration'], expect.any(Function));
		expect(serverState.increment).not.toHaveBeenCalled();
		expect(commit).toHaveBeenCalledTimes(1);
		expect(auditService.recordOAuthAuthorizationInvalidation).toHaveBeenCalledWith({
			reasons: ['public_identity_changed'],
			authorizationProfile: 'oauth',
			outcome: 'completed',
		});
	});

	it('reconciles generations and activates only after enabling OAuth commits', async () => {
		config.oauthEnabled = false;
		config.oauthPublicBaseUrl = 'https://panel.example.com';
		const commit = jest.fn().mockImplementation(() => {
			config.oauthEnabled = true;
		});

		await service.update({ type: MCP_MODULE_NAME, oauth_enabled: true } as UpdateMcpConfigDto, commit);

		expect(lifecycle.reconfigureInternal).toHaveBeenCalledTimes(1);
		expect(globalInvalidation.invalidate).toHaveBeenCalledWith(['oauthEnabledGeneration'], expect.any(Function));
		expect(commit).toHaveBeenCalledTimes(1);
		expect(auditService.recordOAuthAuthorizationInvalidation).toHaveBeenCalledWith({
			reasons: ['oauth_enabled_reconciliation'],
			authorizationProfile: 'oauth',
			outcome: 'completed',
		});
	});

	it('routes OAuth switch-off through awaited OAuth-only invalidation', async () => {
		config.oauthEnabled = true;
		config.oauthPublicBaseUrl = 'https://panel.example.com';
		const commit = jest.fn().mockImplementation(() => {
			config.oauthEnabled = false;
		});

		await service.update({ type: MCP_MODULE_NAME, oauth_enabled: false } as UpdateMcpConfigDto, commit);

		expect(switchOffDisableSpy).toHaveBeenCalledWith(expect.any(Function), {
			generations: ['oauthEnabledGeneration'],
			reasons: ['oauth_disabled'],
			authorizationProfile: 'oauth',
		});
		expect(globalInvalidation.invalidate).toHaveBeenCalledWith(['oauthEnabledGeneration'], expect.any(Function));
		expect(globalInvalidation.invalidateAll).not.toHaveBeenCalled();
		expect(lifecycle.reconfigureInternal).not.toHaveBeenCalled();
	});

	it('retries activation when persisted OAuth configuration remains closed', async () => {
		config.oauthEnabled = true;
		config.oauthPublicBaseUrl = 'https://panel.example.com';
		routeGate.isOpen = false;
		const commit = jest.fn();

		await service.update({ type: MCP_MODULE_NAME } as UpdateMcpConfigDto, commit);

		expect(lifecycle.reconfigureInternal).toHaveBeenCalledWith(commit);
		expect(commit).toHaveBeenCalledTimes(1);
	});

	it('closes, invalidates, and reactivates around a live public identity change', async () => {
		config.oauthEnabled = true;
		config.oauthPublicBaseUrl = 'https://panel.example.com';
		const commit = jest.fn().mockImplementation(() => {
			config.oauthPublicBaseUrl = 'https://new-panel.example.com';
		});

		await service.update(
			{ type: MCP_MODULE_NAME, oauth_public_base_url: 'https://new-panel.example.com' } as UpdateMcpConfigDto,
			commit,
		);

		expect(lifecycle.reconfigureInternal).toHaveBeenCalledTimes(1);
		expect(globalInvalidation.invalidate).toHaveBeenCalledWith(['publicIdentityGeneration'], expect.any(Function));
		expect(commit).toHaveBeenCalledTimes(1);
	});

	it('rejects OAuth enablement without an enabled module and explicit public identity', async () => {
		config.enabled = false;
		config.oauthEnabled = false;
		const commit = jest.fn();

		await expect(
			service.update({ type: MCP_MODULE_NAME, oauth_enabled: true } as UpdateMcpConfigDto, commit),
		).rejects.toThrow('MCP OAuth cannot be enabled while the MCP module is disabled');

		config.enabled = true;

		await expect(
			service.update({ type: MCP_MODULE_NAME, oauth_enabled: true } as UpdateMcpConfigDto, commit),
		).rejects.toThrow('MCP OAuth requires an explicit public base URL before it can be enabled');
		expect(commit).not.toHaveBeenCalled();
	});

	it('serializes concurrent configuration mutations before reading current state', async () => {
		const firstStarted = deferred();
		const releaseFirst = deferred();
		const firstCommit = jest.fn(async () => {
			firstStarted.resolve();
			await releaseFirst.promise;
		});
		const secondCommit = jest.fn();
		const first = service.update({ type: MCP_MODULE_NAME } as UpdateMcpConfigDto, firstCommit);

		await firstStarted.promise;
		const second = service.update({ type: MCP_MODULE_NAME } as UpdateMcpConfigDto, secondCommit);
		await Promise.resolve();

		expect(secondCommit).not.toHaveBeenCalled();
		releaseFirst.resolve();
		await Promise.all([first, second]);
		expect(secondCommit).toHaveBeenCalledTimes(1);
	});

	it('routes module disable through global invalidation and all-stream closure', async () => {
		const commit = jest.fn().mockImplementation(() => {
			config.enabled = false;
		});

		await service.update({ type: MCP_MODULE_NAME, enabled: false } as UpdateMcpConfigDto, commit);

		expect(globalInvalidation.invalidateAll).toHaveBeenCalledWith(['oauthEnabledGeneration'], expect.any(Function));
		expect(globalInvalidation.invalidate).not.toHaveBeenCalled();
		expect(commit).toHaveBeenCalledTimes(1);
		expect(auditService.recordOAuthAuthorizationInvalidation).toHaveBeenCalledWith({
			reasons: ['module_disabled'],
			authorizationProfile: 'all',
			outcome: 'completed',
		});
	});

	it('advances every changed global generation together when disabling the module', async () => {
		config.oauthPublicBaseUrl = 'https://panel.example.com';
		const commit = jest.fn();

		await service.update(
			{
				type: MCP_MODULE_NAME,
				enabled: false,
				oauth_public_base_url: 'https://new-panel.example.com',
				capabilities: [McpCapability.READ],
			} as UpdateMcpConfigDto,
			commit,
		);

		expect(globalInvalidation.invalidateAll).toHaveBeenCalledWith(
			['oauthEnabledGeneration', 'publicIdentityGeneration', 'modulePolicyGeneration'],
			expect.any(Function),
		);
		expect(globalInvalidation.invalidate).not.toHaveBeenCalled();
		expect(serverState.increment).not.toHaveBeenCalled();
		expect(auditService.recordOAuthAuthorizationInvalidation).toHaveBeenCalledWith({
			reasons: ['module_disabled', 'public_identity_changed', 'module_policy_changed'],
			authorizationProfile: 'all',
			outcome: 'completed',
		});
	});

	it('reloads configuration and propagates a failed module-disable commit after invalidation', async () => {
		const commitError = new Error('configuration persistence failed');

		await expect(
			service.update({ type: MCP_MODULE_NAME, enabled: false } as UpdateMcpConfigDto, () =>
				Promise.reject(commitError),
			),
		).rejects.toBe(commitError);

		expect(configService.reload).toHaveBeenCalledTimes(1);
		expect(auditService.recordOAuthAuthorizationInvalidation).toHaveBeenCalledWith({
			reasons: ['module_disabled'],
			authorizationProfile: 'all',
			outcome: 'partial',
		});
	});

	it('invalidates legacy OAuth state before re-enabling a disabled module', async () => {
		config.enabled = false;
		const commit = jest.fn().mockImplementation(() => {
			config.enabled = true;
		});

		await service.update({ type: MCP_MODULE_NAME, enabled: true } as UpdateMcpConfigDto, commit);

		expect(globalInvalidation.invalidate).toHaveBeenCalledWith(['oauthEnabledGeneration'], expect.any(Function));
		expect(globalInvalidation.invalidateAll).not.toHaveBeenCalled();
		expect(commit).toHaveBeenCalledTimes(1);
		expect(auditService.recordOAuthAuthorizationInvalidation).toHaveBeenCalledWith({
			reasons: ['module_enabled_reconciliation'],
			authorizationProfile: 'oauth',
			outcome: 'completed',
		});
	});

	it('combines re-enable reconciliation with other changed OAuth generations', async () => {
		config.enabled = false;
		config.oauthPublicBaseUrl = 'https://panel.example.com';
		const commit = jest.fn();

		await service.update(
			{
				type: MCP_MODULE_NAME,
				enabled: true,
				oauth_public_base_url: 'https://new-panel.example.com',
				capabilities: [McpCapability.READ],
			} as UpdateMcpConfigDto,
			commit,
		);

		expect(globalInvalidation.invalidate).toHaveBeenCalledWith(
			['oauthEnabledGeneration', 'publicIdentityGeneration', 'modulePolicyGeneration'],
			expect.any(Function),
		);
		expect(globalInvalidation.invalidateAll).not.toHaveBeenCalled();
		expect(auditService.recordOAuthAuthorizationInvalidation).toHaveBeenCalledWith({
			reasons: ['module_enabled_reconciliation', 'public_identity_changed', 'module_policy_changed'],
			authorizationProfile: 'oauth',
			outcome: 'completed',
		});
	});

	it('reloads configuration and propagates a failed re-enable commit after invalidation', async () => {
		config.enabled = false;
		const commitError = new Error('configuration persistence failed');

		await expect(
			service.update({ type: MCP_MODULE_NAME, enabled: true } as UpdateMcpConfigDto, () => Promise.reject(commitError)),
		).rejects.toBe(commitError);

		expect(configService.reload).toHaveBeenCalledTimes(1);
		expect(auditService.recordOAuthAuthorizationInvalidation).toHaveBeenCalledWith({
			reasons: ['module_enabled_reconciliation'],
			authorizationProfile: 'oauth',
			outcome: 'partial',
		});
	});

	it('advances public identity and module policy together when both inputs change', async () => {
		config.oauthPublicBaseUrl = 'https://panel.example.com';
		const commit = jest.fn();

		await service.update(
			{
				type: MCP_MODULE_NAME,
				oauth_public_base_url: 'https://new-panel.example.com',
				capabilities: [McpCapability.READ],
			} as UpdateMcpConfigDto,
			commit,
		);

		expect(globalInvalidation.invalidate).toHaveBeenCalledWith(
			['publicIdentityGeneration', 'modulePolicyGeneration'],
			expect.any(Function),
		);
		expect(commit).toHaveBeenCalledTimes(1);
		expect(auditService.recordOAuthAuthorizationInvalidation).toHaveBeenCalledWith({
			reasons: ['public_identity_changed', 'module_policy_changed'],
			authorizationProfile: 'oauth',
			outcome: 'completed',
		});
	});

	it('reloads configuration and propagates a failed public identity commit after invalidation', async () => {
		config.oauthPublicBaseUrl = 'https://panel.example.com';
		const commitError = new Error('configuration persistence failed');

		await expect(
			service.update(
				{ type: MCP_MODULE_NAME, oauth_public_base_url: 'https://new-panel.example.com' } as UpdateMcpConfigDto,
				() => Promise.reject(commitError),
			),
		).rejects.toBe(commitError);

		expect(configService.reload).toHaveBeenCalledTimes(1);
		expect(auditService.recordOAuthAuthorizationInvalidation).toHaveBeenCalledWith({
			reasons: ['public_identity_changed'],
			authorizationProfile: 'oauth',
			outcome: 'partial',
		});
	});

	it('does not commit or close streams when policy generation cannot advance', async () => {
		const writeStream = await subscriptions.openOAuth('write-stream', () =>
			Promise.resolve({
				clientId: 'write-client',
				binding: oauthBinding([McpOAuthScope.READ, McpOAuthScope.WRITE]),
			}),
		);
		serverState.increment.mockResolvedValue({ affected: 0 });
		const commit = jest.fn();

		await expect(
			service.update({ type: MCP_MODULE_NAME, capabilities: [McpCapability.READ] } as UpdateMcpConfigDto, commit),
		).rejects.toBeInstanceOf(ServiceUnavailableException);

		expect(commit).not.toHaveBeenCalled();
		expect(writeStream.signal.aborted).toBe(false);
		expect(auditService.recordOAuthAuthorizationInvalidation).not.toHaveBeenCalled();
	});

	it('closes contracted streams before propagating a configuration commit failure', async () => {
		const readStream = await subscriptions.openOAuth('read-stream', () =>
			Promise.resolve({ clientId: 'read-client', binding: oauthBinding([McpOAuthScope.READ]) }),
		);
		const writeStream = await subscriptions.openOAuth('write-stream', () =>
			Promise.resolve({
				clientId: 'write-client',
				binding: oauthBinding([McpOAuthScope.READ, McpOAuthScope.WRITE]),
			}),
		);
		const commitError = new Error('configuration persistence failed');

		await expect(
			service.update({ type: MCP_MODULE_NAME, capabilities: [McpCapability.READ] } as UpdateMcpConfigDto, () =>
				Promise.reject(commitError),
			),
		).rejects.toBe(commitError);

		expect(serverState.increment).toHaveBeenCalledTimes(1);
		expect(configService.reload).toHaveBeenCalledTimes(1);
		expect(readStream.signal.aborted).toBe(false);
		expect(writeStream.signal.aborted).toBe(true);
		expect(auditService.recordOAuthAuthorizationInvalidation).toHaveBeenCalledWith({
			reasons: ['module_policy_changed'],
			authorizationProfile: 'oauth',
			outcome: 'partial',
		});
	});

	it('discards an unpersisted capability expansion before propagating a commit failure', async () => {
		config.capabilities = [McpCapability.READ];
		configService.reload.mockImplementation(() => {
			config.capabilities = [McpCapability.READ];
		});
		const commitError = new Error('configuration persistence failed');
		const commit = jest.fn().mockImplementation(() => {
			config.capabilities = [McpCapability.READ, McpCapability.WRITE];
			throw commitError;
		});

		await expect(
			service.update(
				{ type: MCP_MODULE_NAME, capabilities: [McpCapability.READ, McpCapability.WRITE] } as UpdateMcpConfigDto,
				commit,
			),
		).rejects.toBe(commitError);

		expect(serverState.increment).toHaveBeenCalledTimes(1);
		expect(configService.reload).toHaveBeenCalledTimes(1);
		expect(config.capabilities).toEqual([McpCapability.READ]);
	});
});
