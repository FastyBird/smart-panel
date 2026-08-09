import { FastifyReply } from 'fastify';

import { AuthInfo } from '@modelcontextprotocol/server';
import { UnauthorizedException } from '@nestjs/common';

import { MCP_OAUTH_PRINCIPAL_TYPE, McpCapability, McpOAuthScope } from '../mcp.constants';

import { McpAuditService } from './mcp-audit.service';
import { McpPolicyRequest } from './mcp-policy.service';
import { McpServerService } from './mcp-server.service';
import { McpSubscriptionHandle, McpSubscriptionRegistryService } from './mcp-subscription-registry.service';

describe('McpServerService policy revision', () => {
	let service: McpServerService;
	let subscriptions: { closeAll: jest.Mock; closeClient: jest.Mock; touchClient: jest.Mock };
	let auditService: {
		getRequestId: jest.Mock;
		recordAuthenticationFailure: jest.Mock;
		recordPolicyDenial: jest.Mock;
		recordProtocolRequest: jest.Mock;
	};

	beforeEach(() => {
		subscriptions = {
			closeAll: jest.fn(),
			closeClient: jest.fn(),
			touchClient: jest.fn(),
		};
		auditService = {
			getRequestId: jest.fn().mockReturnValue('request-1'),
			recordAuthenticationFailure: jest.fn(),
			recordPolicyDenial: jest.fn(),
			recordProtocolRequest: jest.fn(),
		};
		service = new McpServerService(
			subscriptions as unknown as McpSubscriptionRegistryService,
			auditService as unknown as McpAuditService,
		);
	});

	it('invalidates only the targeted client policy before closing it', async () => {
		const globalRevision = service.getPolicyRevision();
		const clientRevision = service.getClientPolicyRevision('client-id');
		const otherRevision = service.getClientPolicyRevision('other-client');

		await service.closeClient('client-id');

		expect(service.getPolicyRevision()).toBe(globalRevision);
		expect(service.getClientPolicyRevision('client-id')).toBe(clientRevision + 1);
		expect(service.getClientPolicyRevision('other-client')).toBe(otherRevision);
		expect(subscriptions.closeClient).toHaveBeenCalledWith('client-id');
	});

	it('rejects a request whose policy was resolved before cleanup', async () => {
		const request = {
			headers: { authorization: 'Bearer token' },
			mcpPolicy: {
				client: { id: 'client-id' },
				clientPolicyRevision: service.getClientPolicyRevision('client-id'),
				policyRevision: service.getPolicyRevision(),
			},
		} as unknown as McpPolicyRequest;

		await service.closeClient('client-id');

		await expect(service.handle(request, {} as FastifyReply)).rejects.toThrow(
			new UnauthorizedException('MCP request policy is no longer current'),
		);
		expect(auditService.recordPolicyDenial).toHaveBeenCalledWith(
			{ requestId: 'request-1', clientId: 'client-id' },
			'policy_changed',
		);
	});

	it('invalidates in-flight policies before closing all clients', async () => {
		const revision = service.getPolicyRevision();

		await service.closeAll();

		expect(service.getPolicyRevision()).toBe(revision + 1);
		expect(subscriptions.closeAll).toHaveBeenCalledTimes(1);
	});

	it('publishes list changes only to the targeted client handler', () => {
		const firstToolsChanged = jest.fn();
		const secondToolsChanged = jest.fn();
		const handlers = (
			service as unknown as {
				handlers: Map<string, { handler: { notify: { toolsChanged: () => void } } }>;
			}
		).handlers;
		handlers.set('client-a', { handler: { notify: { toolsChanged: firstToolsChanged } } });
		handlers.set('client-b', { handler: { notify: { toolsChanged: secondToolsChanged } } });

		service.notifyToolsChanged('client-a');

		expect(firstToolsChanged).toHaveBeenCalledTimes(1);
		expect(secondToolsChanged).not.toHaveBeenCalled();
		expect(subscriptions.touchClient).toHaveBeenCalledWith('client-a');
	});

	it('binds OAuth subscription registration to validated artifact, scope, deadline, and generation identities', () => {
		const authorizationDeadline = Date.now() + 60_000;
		const authInfo: AuthInfo = {
			token: 'opaque-token',
			clientId: 'public-client-id',
			scopes: [McpOAuthScope.READ],
			extra: {
				principal: {
					type: MCP_OAUTH_PRINCIPAL_TYPE,
					accessTokenId: 'access-token-id',
					authorizationDeadline,
					clientId: 'internal-client-id',
					clientGeneration: 2,
					effectiveScopes: [McpOAuthScope.READ],
					grantId: 'grant-id',
					grantGeneration: 3,
					installationId: 'installation-id',
					modulePolicyGeneration: 1,
					refreshFamilyId: 'refresh-family-id',
					scopes: [McpOAuthScope.READ],
					effectiveCapabilities: [McpCapability.READ],
				},
			},
		};
		const internalService = service as unknown as {
			getSubscriptionRegistration(
				clientId: string,
				authInfo?: AuthInfo,
			): {
				clientId: string;
				oauth?: unknown;
			};
		};

		expect(internalService.getSubscriptionRegistration('handler-client-id', authInfo)).toEqual({
			clientId: 'internal-client-id',
			oauth: {
				accessTokenId: 'access-token-id',
				grantId: 'grant-id',
				refreshFamilyId: 'refresh-family-id',
				authorizationDeadline: new Date(authorizationDeadline),
				effectiveScopes: [McpOAuthScope.READ],
				modulePolicyGeneration: 1,
				clientGeneration: 2,
				grantGeneration: 3,
			},
		});
	});

	it('preserves static subscription registration and rejects malformed OAuth identities', () => {
		const internalService = service as unknown as {
			getSubscriptionRegistration(clientId: string, authInfo?: AuthInfo): unknown;
		};

		expect(internalService.getSubscriptionRegistration('static-client-id')).toEqual({
			clientId: 'static-client-id',
		});
		expect(() =>
			internalService.getSubscriptionRegistration('handler-client-id', {
				token: 'opaque-token',
				clientId: 'public-client-id',
				scopes: [McpOAuthScope.READ],
				extra: { principal: { type: MCP_OAUTH_PRINCIPAL_TYPE } },
			}),
		).toThrow(new UnauthorizedException('MCP OAuth subscription identity is unavailable'));
	});

	it('audits initialization and discovery without passing request parameters', () => {
		const internalService = service as unknown as {
			auditProtocolRequest(body: unknown, requestId: string, clientId: string): void;
		};

		internalService.auditProtocolRequest(
			{
				id: 1,
				method: 'initialize',
				params: { protocolVersion: '2025-06-18', authorization: 'Bearer secret' },
			},
			'1',
			'client-a',
		);
		internalService.auditProtocolRequest(
			{ id: 2, method: 'tools/list', params: { cursor: 'private-cursor' } },
			'2',
			'client-a',
		);
		internalService.auditProtocolRequest(
			{ id: 3, method: 'initialize', params: { protocolVersion: 'Bearer private-version' } },
			'3',
			'client-a',
		);

		expect(auditService.recordProtocolRequest).toHaveBeenNthCalledWith(
			1,
			{ requestId: '1', clientId: 'client-a' },
			{ kind: 'initialization', method: 'initialize', protocolVersion: '2025-06-18' },
		);
		expect(auditService.recordProtocolRequest).toHaveBeenNthCalledWith(
			2,
			{ requestId: '2', clientId: 'client-a' },
			{ kind: 'discovery', method: 'tools/list' },
		);
		expect(auditService.recordProtocolRequest).toHaveBeenNthCalledWith(
			3,
			{ requestId: '3', clientId: 'client-a' },
			{ kind: 'initialization', method: 'initialize' },
		);
		expect(JSON.stringify(auditService.recordProtocolRequest.mock.calls)).not.toContain('secret');
		expect(JSON.stringify(auditService.recordProtocolRequest.mock.calls)).not.toContain('private-cursor');
		expect(JSON.stringify(auditService.recordProtocolRequest.mock.calls)).not.toContain('private-version');
	});

	it('refreshes the idle deadline when subscription traffic is forwarded', async () => {
		const touch = jest.fn();
		const close = jest.fn();
		const upstream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array([1]));
				controller.close();
			},
		});
		const response = new Response(upstream, { headers: { 'content-type': 'text/event-stream' } });
		const subscription = { close, touch } as unknown as McpSubscriptionHandle;
		const tracked = (
			service as unknown as {
				trackSubscriptionResponse(response: Response, subscription: McpSubscriptionHandle): Response;
			}
		).trackSubscriptionResponse(response, subscription);
		const reader = tracked.body?.getReader();

		await expect(reader?.read()).resolves.toEqual({ done: false, value: new Uint8Array([1]) });
		expect(touch).toHaveBeenCalledTimes(1);
		expect(close).not.toHaveBeenCalled();

		await expect(reader?.read()).resolves.toEqual({ done: true, value: undefined });
		expect(close).toHaveBeenCalledTimes(1);
	});
});
