import { IncomingMessage, ServerResponse } from 'node:http';
import type Provider from 'oidc-provider';
import { v4 as uuid } from 'uuid';

import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { McpOAuthClientEntity, McpOAuthInteractionEntity } from '../entities/mcp-oauth.entity';
import { MCP_MODULE_NAME, McpCapability, McpOAuthScope } from '../mcp.constants';
import { McpOAuthInteractionAction } from '../models/mcp-oauth-interaction.model';

import { McpInstallationService } from './mcp-installation.service';
import { McpOAuthApproverAuthorityService } from './mcp-oauth-approver-authority.service';
import { McpOAuthArtifactService } from './mcp-oauth-artifact.service';
import { McpOAuthClientService } from './mcp-oauth-client.service';
import { McpOAuthInteractionService } from './mcp-oauth-interaction.service';
import { McpOAuthRuntimeService } from './mcp-oauth-runtime.service';
import { McpSubscriptionRegistryService } from './mcp-subscription-registry.service';

describe('McpOAuthInteractionService', () => {
	const rawUid = 'opaque-interaction-identifier-123456';
	const userId = uuid();
	const client = Object.assign(new McpOAuthClientEntity(), {
		id: uuid(),
		clientIdentifier: 'codex-client',
		name: 'Codex',
		redirectUris: ['http://127.0.0.1:1455/callback'],
		maximumScopes: [McpOAuthScope.READ, McpOAuthScope.WRITE, McpOAuthScope.OFFLINE_ACCESS],
		enabled: true,
	});
	const details = {
		uid: rawUid,
		prompt: { name: 'consent', details: {} },
		params: {
			client_id: client.clientIdentifier,
			redirect_uri: client.redirectUris[0],
			scope: 'mcp:read mcp:write offline_access',
			resource: 'https://panel.example/api/v1/modules/mcp',
		},
		grantId: undefined,
	};
	const interactionDetails = jest.fn();
	const interactionFinished = jest.fn(
		(_request: IncomingMessage, response: ServerResponse, _result: unknown, _options?: unknown): Promise<void> => {
			response.statusCode = 303;
			response.setHeader('location', '/auth/resume');
			response.setHeader('set-cookie', ['_interaction=next; HttpOnly; SameSite=Lax']);
			response.end();
			return Promise.resolve();
		},
	);
	const providerGrant = {
		addResourceScope: jest.fn(),
		addOIDCScope: jest.fn(),
		save: jest.fn((_ttl?: number) => Promise.resolve('provider-grant-id')),
	};
	class Grant {
		static find = jest.fn(() => Promise.resolve(undefined));

		constructor() {
			return providerGrant;
		}
	}
	const provider = {
		interactionDetails,
		interactionFinished,
		Grant,
	} as unknown as Provider;
	const urls = {
		publicBaseUrl: 'https://panel.example',
		resource: 'https://panel.example/api/v1/modules/mcp',
	};
	const stored = new Map<string, McpOAuthInteractionEntity>();
	const interactions = {
		findOneBy: jest.fn(({ uidHash }: { uidHash: string }) => Promise.resolve(stored.get(uidHash) ?? null)),
		create: jest.fn((value: Partial<McpOAuthInteractionEntity>) =>
			Object.assign(new McpOAuthInteractionEntity(), value),
		),
		save: jest.fn((value: McpOAuthInteractionEntity) => {
			value.id ??= uuid();
			stored.set(value.uidHash, value);
			return Promise.resolve(value);
		}),
		update: jest.fn(
			(
				criteria: { id: string; authenticatedUserId: string },
				update: { consumedAt: Date },
			): Promise<{ affected: number }> => {
				const interaction = [...stored.values()].find(
					(value) => value.id === criteria.id && value.authenticatedUserId === criteria.authenticatedUserId,
				);
				if (!interaction || interaction.consumedAt) return Promise.resolve({ affected: 0 });
				interaction.consumedAt = update.consumedAt;
				return Promise.resolve({ affected: 1 });
			},
		),
	};
	const clientsService = {
		findActiveByIdentifier: jest.fn(() => Promise.resolve(client)),
		isRedirectUriAllowed: jest.fn(() => true),
	};
	const artifactService = {
		createGrant: jest.fn(
			(_input: { clientId: string; approvedById: string; approvedScopes: McpOAuthScope[]; expiresAt: Date }) =>
				Promise.resolve({ id: uuid() }),
		),
	};
	const approverAuthority = {
		runAuthorized: jest.fn((_userId: string, operation: (generation: number) => Promise<unknown>) => operation(4)),
	};
	const installationService = { getInstallationId: jest.fn(() => Promise.resolve(uuid())) };
	let mcpEnabled = true;
	let mcpCapabilities = [McpCapability.READ, McpCapability.WRITE, McpCapability.TRIGGER];
	const configService = {
		getModuleConfig: jest.fn((module: string) =>
			module === MCP_MODULE_NAME
				? { enabled: mcpEnabled, capabilities: [...mcpCapabilities] }
				: { serviceName: 'Kitchen panel' },
		),
	};
	const subscriptions = { runOAuthMutation: jest.fn((operation: () => Promise<unknown>) => operation()) };
	const runtimeService = { getActive: jest.fn(() => ({ provider, urls })) };
	const request = { headers: { cookie: '_interaction=signed' } } as IncomingMessage;
	let service: McpOAuthInteractionService;

	beforeEach(() => {
		jest.clearAllMocks();
		stored.clear();
		mcpEnabled = true;
		mcpCapabilities = [McpCapability.READ, McpCapability.WRITE, McpCapability.TRIGGER];
		delete (providerGrant as { expiresIn?: number }).expiresIn;
		interactionDetails.mockResolvedValue({ ...details, prompt: { ...details.prompt } });
		service = new McpOAuthInteractionService(
			interactions as never,
			runtimeService as unknown as McpOAuthRuntimeService,
			clientsService as unknown as McpOAuthClientService,
			artifactService as unknown as McpOAuthArtifactService,
			approverAuthority as unknown as McpOAuthApproverAuthorityService,
			installationService as unknown as McpInstallationService,
			configService as unknown as ConfigService,
			subscriptions as unknown as McpSubscriptionRegistryService,
		);
	});

	it('discloses installation, client, redirect, expiry, scopes, and physical-device impact', async () => {
		const interaction = await service.getInteraction(rawUid, userId, request);

		expect(interaction).toMatchObject({
			action: McpOAuthInteractionAction.CONSENT,
			installationName: 'Kitchen panel',
			clientIdentifier: client.clientIdentifier,
			clientName: client.name,
			redirectUri: client.redirectUris[0],
			requestedScopes: [McpOAuthScope.READ, McpOAuthScope.WRITE, McpOAuthScope.OFFLINE_ACCESS],
			accessExpiresInSeconds: 600,
			maximumGrantExpiresInDays: 90,
			physicalDeviceWarning: true,
		});
	});

	it('binds the interaction to the first authenticated owner/admin', async () => {
		await service.getInteraction(rawUid, userId, request);

		await expect(service.getInteraction(rawUid, uuid(), request)).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('completes provider login without receiving a password', async () => {
		interactionDetails.mockResolvedValue({ ...details, prompt: { name: 'login', details: {} } });

		const interaction = await service.getInteraction(rawUid, userId, request);

		expect(interaction).toMatchObject({ action: McpOAuthInteractionAction.REDIRECT, redirectTo: '/auth/resume' });
		expect(interaction.setCookies).toEqual(['_interaction=next; HttpOnly; SameSite=Lax']);
		expect(interactionFinished).toHaveBeenCalled();
		const loginResult = interactionFinished.mock.calls[0]?.[2] as {
			login?: { accountId?: string; password?: unknown };
		};

		expect(loginResult.login?.accountId).toBe(userId);
		expect(loginResult.login).not.toHaveProperty('password');
	});

	it('creates a finite bounded grant and resumes provider consent', async () => {
		let finishedInsideAuthorityBoundary = false;
		approverAuthority.runAuthorized.mockImplementationOnce(
			async (_userId: string, operation: (generation: number) => Promise<unknown>) => {
				const result = await operation(4);
				finishedInsideAuthorityBoundary = interactionFinished.mock.calls.length === 1;

				return result;
			},
		);
		await service.getInteraction(rawUid, userId, request);

		const completion = await service.approve(
			rawUid,
			userId,
			{ scopes: [McpOAuthScope.READ, McpOAuthScope.OFFLINE_ACCESS], expiresInDays: 30 },
			request,
		);

		expect(providerGrant.addResourceScope).toHaveBeenCalledWith(urls.resource, McpOAuthScope.READ);
		expect(providerGrant.addOIDCScope).toHaveBeenCalledWith(McpOAuthScope.OFFLINE_ACCESS);
		expect(providerGrant).toHaveProperty('expiresIn', 30 * 24 * 60 * 60);
		expect(providerGrant.save).toHaveBeenCalledWith();
		expect(artifactService.createGrant).toHaveBeenCalled();
		const grantInput = artifactService.createGrant.mock.calls[0]?.[0] as {
			providerGrantId?: string;
			clientId?: string;
			approvedById?: string;
			approvedScopes?: McpOAuthScope[];
			expiresAt?: unknown;
			approverAuthorityGeneration?: number;
		};

		expect(grantInput).toMatchObject({
			providerGrantId: 'provider-grant-id',
			clientId: client.id,
			approvedById: userId,
			approvedScopes: [McpOAuthScope.READ, McpOAuthScope.OFFLINE_ACCESS],
			approverAuthorityGeneration: 4,
		});
		expect(grantInput.expiresAt).toBeInstanceOf(Date);
		expect(completion.redirectTo).toBe('/auth/resume');
		expect(interactions.update).toHaveBeenCalled();
		expect(finishedInsideAuthorityBoundary).toBe(true);
	});

	it('replaces an existing provider grant so omitted scopes cannot survive reauthorization', async () => {
		interactionDetails.mockResolvedValue({ ...details, grantId: 'existing-provider-grant' });
		await service.getInteraction(rawUid, userId, request);

		await service.approve(rawUid, userId, { scopes: [McpOAuthScope.READ], expiresInDays: 7 }, request);

		expect(Grant.find).not.toHaveBeenCalled();
		expect(providerGrant.addResourceScope).toHaveBeenCalledWith(urls.resource, McpOAuthScope.READ);
		expect(providerGrant.addOIDCScope).not.toHaveBeenCalled();
		expect(interactionFinished).toHaveBeenLastCalledWith(
			request,
			expect.anything(),
			{ consent: { grantId: 'provider-grant-id' } },
			{ mergeWithLastSubmission: true },
		);
	});

	it('rejects consent scope escalation', async () => {
		await service.getInteraction(rawUid, userId, request);

		await expect(
			service.approve(rawUid, userId, { scopes: [McpOAuthScope.TRIGGER], expiresInDays: 30 }, request),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rechecks the live module ceiling inside the authoritative approval gate', async () => {
		await service.getInteraction(rawUid, userId, request);
		let enterApproval = (): void => undefined;
		const approvalEntered = new Promise<void>((resolve) => {
			enterApproval = resolve;
		});
		let releaseApproval = (): void => undefined;
		const release = new Promise<void>((resolve) => {
			releaseApproval = resolve;
		});
		approverAuthority.runAuthorized.mockImplementationOnce(
			async (_userId: string, operation: (generation: number) => Promise<unknown>) => {
				enterApproval();
				await release;

				return operation(4);
			},
		);
		const approval = service.approve(rawUid, userId, { scopes: [McpOAuthScope.WRITE], expiresInDays: 30 }, request);

		await approvalEntered;
		mcpCapabilities = [McpCapability.READ];
		releaseApproval();

		await expect(approval).rejects.toBeInstanceOf(BadRequestException);
		expect(providerGrant.save).not.toHaveBeenCalled();
		expect(interactions.update).not.toHaveBeenCalled();
	});

	it('rejects approval when the module is disabled before the gate opens', async () => {
		await service.getInteraction(rawUid, userId, request);
		let enterApproval = (): void => undefined;
		const approvalEntered = new Promise<void>((resolve) => {
			enterApproval = resolve;
		});
		let releaseApproval = (): void => undefined;
		const release = new Promise<void>((resolve) => {
			releaseApproval = resolve;
		});
		approverAuthority.runAuthorized.mockImplementationOnce(
			async (_userId: string, operation: (generation: number) => Promise<unknown>) => {
				enterApproval();
				await release;

				return operation(4);
			},
		);
		const approval = service.approve(rawUid, userId, { scopes: [McpOAuthScope.READ], expiresInDays: 30 }, request);

		await approvalEntered;
		mcpEnabled = false;
		releaseApproval();

		await expect(approval).rejects.toBeInstanceOf(ForbiddenException);
		expect(providerGrant.save).not.toHaveBeenCalled();
		expect(interactions.update).not.toHaveBeenCalled();
	});

	it('claims consent before issuing artifacts so concurrent approval cannot escape replay protection', async () => {
		await service.getInteraction(rawUid, userId, request);

		const results = await Promise.allSettled([
			service.approve(rawUid, userId, { scopes: [McpOAuthScope.READ], expiresInDays: 30 }, request),
			service.approve(rawUid, userId, { scopes: [McpOAuthScope.READ], expiresInDays: 30 }, request),
		]);

		expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
		expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
		expect(providerGrant.save).toHaveBeenCalledTimes(1);
		expect(artifactService.createGrant).toHaveBeenCalledTimes(1);
	});

	it('returns a provider access_denied redirect and consumes the interaction', async () => {
		await service.getInteraction(rawUid, userId, request);

		const completion = await service.deny(rawUid, userId, request);

		expect(completion.redirectTo).toBe('/auth/resume');
		expect(interactionFinished).toHaveBeenLastCalledWith(
			request,
			expect.anything(),
			expect.objectContaining({ error: 'access_denied' }),
			{ mergeWithLastSubmission: false },
		);
		expect(interactions.update).toHaveBeenCalled();
		expect(subscriptions.runOAuthMutation).toHaveBeenCalled();
	});
});
