import { Repository } from 'typeorm';

import { ServiceUnavailableException } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { UpdateMcpConfigDto } from '../dto/update-config.dto';
import { McpOAuthServerStateEntity } from '../entities/mcp-oauth.entity';
import { MCP_MODULE_NAME, MCP_OAUTH_SERVER_STATE_KEY, McpCapability, McpOAuthScope } from '../mcp.constants';
import { McpConfigModel } from '../models/config.model';

import { McpAuditService } from './mcp-audit.service';
import { McpOAuthModuleConfigMutationService } from './mcp-oauth-module-config-mutation.service';
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
	let subscriptions: McpSubscriptionRegistryService;
	let service: McpOAuthModuleConfigMutationService;

	beforeEach(() => {
		config = new McpConfigModel();
		config.capabilities = [McpCapability.READ, McpCapability.WRITE, McpCapability.TRIGGER];
		configService = {
			getModuleConfig: jest.fn().mockImplementation(() => config),
			reload: jest.fn(),
		};
		serverState = {
			increment: jest.fn().mockResolvedValue({ affected: 1 }),
		};
		const auditService = {
			recordSubscriptionClosed: jest.fn(),
			recordSubscriptionOpened: jest.fn(),
		};
		subscriptions = new McpSubscriptionRegistryService(auditService as unknown as McpAuditService);
		service = new McpOAuthModuleConfigMutationService(
			configService as unknown as ConfigService,
			serverState as unknown as Repository<McpOAuthServerStateEntity>,
			subscriptions,
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
