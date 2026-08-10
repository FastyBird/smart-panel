import { FastifyReply } from 'fastify';

import { AuthInfo, OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';
import { UnauthorizedException } from '@nestjs/common';

import { MCP_OAUTH_PRINCIPAL_TYPE, McpCapability, McpOAuthScope } from '../mcp.constants';

import { McpAuditService } from './mcp-audit.service';
import { McpOAuthResourceServerService } from './mcp-oauth-resource-server.service';
import { McpPolicyRequest } from './mcp-policy.service';
import { McpServerService } from './mcp-server.service';
import {
	McpSubscriptionClosingError,
	McpSubscriptionHandle,
	McpSubscriptionRegistryService,
} from './mcp-subscription-registry.service';

const oauthAuthInfo = (clientGeneration = 2): AuthInfo => ({
	token: 'opaque-token',
	clientId: 'public-client-id',
	scopes: [McpOAuthScope.READ],
	extra: {
		principal: {
			type: MCP_OAUTH_PRINCIPAL_TYPE,
			accessTokenId: 'access-token-id',
			approverAuthorityGeneration: 4,
			approverId: 'approver-id',
			authorizationDeadline: Date.now() + 60_000,
			clientId: 'internal-client-id',
			clientGeneration,
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
});

describe('McpServerService policy revision', () => {
	let service: McpServerService;
	let subscriptions: {
		closeAll: jest.Mock;
		closeClient: jest.Mock;
		open: jest.Mock;
		openOAuth: jest.Mock;
		touchClient: jest.Mock;
	};
	let auditService: {
		getRequestId: jest.Mock;
		recordAuthenticationFailure: jest.Mock;
		recordPolicyDenial: jest.Mock;
		recordProtocolRequest: jest.Mock;
	};
	let oauthResourceServerService: { getBearerChallenge: jest.Mock; verifyMcpBearerToken: jest.Mock };

	beforeEach(() => {
		subscriptions = {
			closeAll: jest.fn(),
			closeClient: jest.fn(),
			open: jest.fn(),
			openOAuth: jest.fn(),
			touchClient: jest.fn(),
		};
		auditService = {
			getRequestId: jest.fn().mockReturnValue('request-1'),
			recordAuthenticationFailure: jest.fn(),
			recordPolicyDenial: jest.fn(),
			recordProtocolRequest: jest.fn(),
		};
		oauthResourceServerService = {
			getBearerChallenge: jest.fn(),
			verifyMcpBearerToken: jest.fn(),
		};
		service = new McpServerService(
			subscriptions as unknown as McpSubscriptionRegistryService,
			auditService as unknown as McpAuditService,
			oauthResourceServerService as unknown as McpOAuthResourceServerService,
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
		const authInfo = oauthAuthInfo();
		(authInfo.extra?.principal as { authorizationDeadline: number }).authorizationDeadline = authorizationDeadline;
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
				approverAuthorityGeneration: 4,
				approverId: 'approver-id',
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

	it('revalidates OAuth authorization inside the registration gate and serves with the refreshed AuthInfo', async () => {
		const initialAuthInfo = oauthAuthInfo(2);
		const currentAuthInfo = { ...oauthAuthInfo(4), scopes: [McpCapability.READ] };
		const handle = { id: 'subscription-id' } as unknown as McpSubscriptionHandle;

		oauthResourceServerService.verifyMcpBearerToken.mockResolvedValue(currentAuthInfo);
		subscriptions.openOAuth.mockImplementation(
			async (requestId: string, revalidate: () => Promise<{ clientId: string; binding: unknown }>) => {
				expect(requestId).toBe('request-1');
				const registration = await revalidate();

				expect(registration.clientId).toBe('internal-client-id');
				expect(registration.binding).toEqual(expect.objectContaining({ clientGeneration: 4 }));

				return handle;
			},
		);
		const internalService = service as unknown as {
			openSubscription(
				clientId: string,
				requestId: string,
				authInfo?: AuthInfo,
			): Promise<{
				authInfo?: AuthInfo;
				handle: McpSubscriptionHandle;
			}>;
		};

		await expect(internalService.openSubscription('handler-client-id', 'request-1', initialAuthInfo)).resolves.toEqual({
			authInfo: currentAuthInfo,
			handle,
		});
		expect(oauthResourceServerService.verifyMcpBearerToken).toHaveBeenCalledWith('Bearer opaque-token');
		expect(subscriptions.open).not.toHaveBeenCalled();
	});

	it('maps gated OAuth revalidation failures to the resource-server bearer challenge', () => {
		const error = new OAuthError(OAuthErrorCode.InvalidToken, 'The access token expired');
		const challenge = new Response(null, {
			status: 401,
			headers: { 'www-authenticate': 'Bearer error="invalid_token"' },
		});

		oauthResourceServerService.getBearerChallenge.mockReturnValue(challenge);
		const internalService = service as unknown as {
			getSubscriptionErrorResponse(error: OAuthError, body?: unknown): Response;
		};
		const response = internalService.getSubscriptionErrorResponse(error);

		expect(response).toBe(challenge);
		expect(response.status).toBe(401);
		expect(response.headers.get('www-authenticate')).toContain('invalid_token');
		expect(oauthResourceServerService.getBearerChallenge).toHaveBeenCalledWith(error);
	});

	it('returns a controlled protocol error when subscription cleanup is in progress', async () => {
		const error = new McpSubscriptionClosingError();
		const internalService = service as unknown as {
			getSubscriptionErrorResponse(error: McpSubscriptionClosingError, body?: unknown): Response;
		};
		const response = internalService.getSubscriptionErrorResponse(error, { id: 7 });

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			jsonrpc: '2.0',
			id: 7,
			error: { code: -32603, message: 'Subscription service is closing' },
		});
	});

	it('opens static subscriptions without entering OAuth revalidation', async () => {
		const handle = { id: 'static-subscription-id' } as unknown as McpSubscriptionHandle;

		subscriptions.open.mockReturnValue(handle);
		const internalService = service as unknown as {
			openSubscription(
				clientId: string,
				requestId: string,
				authInfo?: AuthInfo,
			): Promise<{
				authInfo?: AuthInfo;
				handle: McpSubscriptionHandle;
			}>;
		};

		await expect(internalService.openSubscription('static-client-id', 'request-1')).resolves.toEqual({
			authInfo: undefined,
			handle,
		});
		expect(subscriptions.open).toHaveBeenCalledWith('static-client-id', 'request-1');
		expect(subscriptions.openOAuth).not.toHaveBeenCalled();
		expect(oauthResourceServerService.verifyMcpBearerToken).not.toHaveBeenCalled();
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
