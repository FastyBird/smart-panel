import { FastifyReply } from 'fastify';
import { readFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { resolve } from 'path';

import { toNodeHandler } from '@modelcontextprotocol/node';
import { AuthInfo, McpHttpHandler, McpServer, OAuthError, createMcpHandler } from '@modelcontextprotocol/server';
import { Injectable, OnApplicationShutdown, Optional, UnauthorizedException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { createExtensionLogger } from '../../../common/logger';
import { extractAccessTokenFromHeader } from '../../auth/utils/token.utils';
import {
	MCP_CATALOG_REGISTRAR,
	MCP_MAX_SUBSCRIPTIONS_PER_CLIENT,
	MCP_MODULE_NAME,
	MCP_OAUTH_PRINCIPAL_TYPE,
	McpOAuthScope,
} from '../mcp.constants';
import { McpOAuthPrincipal } from '../oauth/mcp-oauth.types';

import { McpAuditService } from './mcp-audit.service';
import { McpOAuthResourceServerService } from './mcp-oauth-resource-server.service';
import { McpPolicyRequest } from './mcp-policy.service';
import {
	McpOAuthSubscriptionBinding,
	McpSubscriptionHandle,
	McpSubscriptionRegistryService,
	McpSubscriptionUnavailableError,
} from './mcp-subscription-registry.service';

const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../../../../package.json'), 'utf-8')) as {
	version: string;
};

type AuthenticatedIncomingMessage = IncomingMessage & { auth?: AuthInfo };

interface ClientHandler {
	handler: McpHttpHandler;
	nodeHandler: ReturnType<typeof toNodeHandler>;
}

interface JsonRpcRequestBody {
	id?: number | string | null;
	method?: string;
	params?: { protocolVersion?: unknown };
}

interface McpCatalogRegistrar {
	register(server: McpServer, authInfo?: AuthInfo): void;
}

interface McpSubscriptionRegistration {
	clientId: string;
	oauth?: McpOAuthSubscriptionBinding;
}

interface McpOpenedSubscription {
	authInfo?: AuthInfo;
	handle: McpSubscriptionHandle;
}

@Injectable()
export class McpServerService implements OnApplicationShutdown {
	private readonly logger = createExtensionLogger(MCP_MODULE_NAME, 'McpServerService');
	private readonly handlers = new Map<string, ClientHandler>();
	private readonly clientPolicyRevisions = new Map<string, number>();
	private policyRevision = 0;

	constructor(
		private readonly subscriptions: McpSubscriptionRegistryService,
		private readonly auditService: McpAuditService,
		private readonly oauthResourceServerService: McpOAuthResourceServerService,
		@Optional() private readonly moduleRef?: ModuleRef,
	) {}

	async handle(request: McpPolicyRequest, reply: FastifyReply): Promise<void> {
		const requestId = this.auditService.getRequestId(request.body);

		if (!request.mcpPolicy) {
			this.auditService.recordPolicyDenial({ requestId }, 'request_denied');
			throw new UnauthorizedException('MCP request policy was not resolved');
		}

		const token = extractAccessTokenFromHeader(request);

		if (!token) {
			this.auditService.recordAuthenticationFailure(
				{ requestId, clientId: request.mcpPolicy.client.id },
				'authentication_required',
			);
			throw new UnauthorizedException('Authentication required');
		}

		const policy = request.mcpPolicy;

		if (
			policy.policyRevision !== this.policyRevision ||
			policy.clientPolicyRevision !== this.getClientPolicyRevision(policy.client.id)
		) {
			this.auditService.recordPolicyDenial({ requestId, clientId: policy.client.id }, 'policy_changed');
			throw new UnauthorizedException('MCP request policy is no longer current');
		}

		this.auditProtocolRequest(request.body, requestId, policy.client.id);

		const clientHandler = this.getOrCreateHandler(policy.client.id);
		const rawRequest = request.raw as AuthenticatedIncomingMessage;
		const endpoint = new URL(request.url, `${request.protocol}://${request.headers.host ?? 'localhost'}`);

		rawRequest.auth = {
			token,
			clientId: policy.client.id,
			scopes: [...policy.effectiveCapabilities],
			expiresAt: policy.client.token?.expiresAt
				? Math.floor(policy.client.token.expiresAt.getTime() / 1000)
				: undefined,
			resource: endpoint,
			extra: {
				endpoint: endpoint.href,
				installationId: policy.installationId,
				clientName: policy.client.name,
				tokenId: policy.tokenId,
			},
		};

		reply.hijack();

		await clientHandler.nodeHandler(rawRequest, reply.raw, request.body);
	}

	async handleOAuth(request: McpPolicyRequest, reply: FastifyReply, authInfo: AuthInfo): Promise<void> {
		const requestId = this.auditService.getRequestId(request.body);
		this.auditProtocolRequest(request.body, requestId, authInfo.clientId);
		const clientHandler = this.getOrCreateHandler(`oauth:${authInfo.clientId}`);
		const rawRequest = request.raw as AuthenticatedIncomingMessage;

		rawRequest.auth = authInfo;
		reply.hijack();

		await clientHandler.nodeHandler(rawRequest, reply.raw, request.body);
	}

	notifyToolsChanged(clientId?: string): void {
		this.notify(clientId, (handler) => handler.notify.toolsChanged());
	}

	notifyResourcesChanged(clientId?: string): void {
		this.notify(clientId, (handler) => handler.notify.resourcesChanged());
	}

	getPolicyRevision(): number {
		return this.policyRevision;
	}

	getClientPolicyRevision(clientId: string): number {
		return this.clientPolicyRevisions.get(clientId) ?? 0;
	}

	invalidatePolicies(): void {
		this.policyRevision += 1;
	}

	invalidateClientPolicy(clientId: string): void {
		this.clientPolicyRevisions.set(clientId, this.getClientPolicyRevision(clientId) + 1);
	}

	async closeClient(clientId: string): Promise<void> {
		this.invalidateClientPolicy(clientId);
		this.subscriptions.closeClient(clientId);
		const clientHandler = this.handlers.get(clientId);

		if (!clientHandler) {
			return;
		}

		this.handlers.delete(clientId);

		try {
			await clientHandler.handler.close();
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			this.logger.error(`Failed to close MCP handler client=${clientId}`, {
				message: err.message,
				stack: err.stack,
			});
		}
	}

	async closeAll(): Promise<void> {
		this.invalidatePolicies();
		await this.subscriptions.closeAll();
		const handlers = [...this.handlers.values()];
		this.handlers.clear();
		const results = await Promise.allSettled(handlers.map(({ handler }) => handler.close()));

		for (const result of results) {
			if (result.status === 'rejected') {
				const err = result.reason instanceof Error ? result.reason : new Error(String(result.reason));
				this.logger.error('Failed to close an MCP handler during shutdown', {
					message: err.message,
					stack: err.stack,
				});
			}
		}
	}

	async onApplicationShutdown(): Promise<void> {
		await this.closeAll();
	}

	private getOrCreateHandler(clientId: string): ClientHandler {
		const existing = this.handlers.get(clientId);

		if (existing) {
			return existing;
		}

		const handler = createMcpHandler(
			({ authInfo, requestInfo }) => {
				const server = new McpServer(
					{
						name: 'fastybird-smart-panel',
						version: packageJson.version,
					},
					{
						capabilities: {
							resources: { listChanged: true },
							tools: { listChanged: true },
						},
						instructions: this.buildInstructions(authInfo, requestInfo),
					},
				);

				this.moduleRef?.get<McpCatalogRegistrar>(MCP_CATALOG_REGISTRAR, { strict: false })?.register(server, authInfo);

				return server;
			},
			{
				legacy: 'stateless',
				maxSubscriptions: MCP_MAX_SUBSCRIPTIONS_PER_CLIENT,
			},
		);
		const fetch = handler.fetch;
		const wrappedHandler = {
			fetch: async (...args: Parameters<McpHttpHandler['fetch']>): Promise<Response> => {
				const [webRequest, requestOptions] = args;

				if (!this.isSubscriptionListen(requestOptions?.parsedBody)) {
					return fetch(webRequest, requestOptions);
				}

				let subscription: McpSubscriptionHandle;
				let options = requestOptions;

				try {
					const opened = await this.openSubscription(
						clientId,
						this.auditService.getRequestId(requestOptions?.parsedBody),
						requestOptions?.authInfo,
						this.getWireRequestId(requestOptions?.parsedBody),
					);

					subscription = opened.handle;
					if (opened.authInfo !== requestOptions?.authInfo) {
						options = { ...requestOptions, authInfo: opened.authInfo };
					}
				} catch (error) {
					if (error instanceof McpSubscriptionUnavailableError) {
						return this.getSubscriptionErrorResponse(error, requestOptions?.parsedBody);
					}
					if (OAuthError.isInstance(error)) return this.getSubscriptionErrorResponse(error);

					throw error;
				}

				const signal = AbortSignal.any([webRequest.signal, subscription.signal]);
				let response: Response;

				try {
					response = await fetch(new Request(webRequest, { signal }), options);
				} catch (error) {
					subscription.close('error');
					throw error;
				}

				return this.trackSubscriptionResponse(response, subscription, webRequest.signal);
			},
		};
		const clientHandler = {
			handler,
			nodeHandler: toNodeHandler(wrappedHandler),
		};

		this.handlers.set(clientId, clientHandler);

		return clientHandler;
	}

	private buildInstructions(authInfo?: AuthInfo, requestInfo?: Request): string {
		const installationId = this.getStringExtra(authInfo?.extra?.installationId, 'unknown');
		const clientName = this.getStringExtra(authInfo?.extra?.clientName, authInfo?.clientId ?? 'unknown');
		const capabilities = authInfo?.scopes.join(', ') || 'none';
		const endpoint = requestInfo?.url ?? 'the configured MCP endpoint';

		return `Smart Panel installation ${installationId}. Client ${clientName}. Effective capabilities: ${capabilities}. Endpoint: ${endpoint}.`;
	}

	private getStringExtra(value: unknown, fallback: string): string {
		return typeof value === 'string' ? value : fallback;
	}

	private isSubscriptionListen(body: unknown): boolean {
		return this.getRequestBody(body).method === 'subscriptions/listen';
	}

	private subscriptionUnavailableResponse(error: McpSubscriptionUnavailableError, body: unknown): Response {
		const request = this.getRequestBody(body);

		return Response.json(
			{
				jsonrpc: '2.0',
				id: request.id ?? null,
				error: { code: -32603, message: error.message },
			},
			{ status: 200 },
		);
	}

	private getSubscriptionErrorResponse(error: McpSubscriptionUnavailableError | OAuthError, body?: unknown): Response {
		return error instanceof McpSubscriptionUnavailableError
			? this.subscriptionUnavailableResponse(error, body)
			: this.oauthResourceServerService.getBearerChallenge(error);
	}

	private getRequestBody(body: unknown): JsonRpcRequestBody {
		return body && typeof body === 'object' && !Array.isArray(body) ? (body as JsonRpcRequestBody) : {};
	}

	private getSubscriptionRegistration(clientId: string, authInfo?: AuthInfo): McpSubscriptionRegistration {
		const value = authInfo?.extra?.principal;

		if (value === undefined) return { clientId };
		if (!this.isOAuthPrincipal(value)) {
			throw new UnauthorizedException('MCP OAuth subscription identity is unavailable');
		}

		return {
			clientId: value.clientId,
			oauth: {
				accessTokenId: value.accessTokenId,
				approverAuthorityGeneration: value.approverAuthorityGeneration,
				approverId: value.approverId,
				grantId: value.grantId,
				...(value.refreshFamilyId ? { refreshFamilyId: value.refreshFamilyId } : {}),
				authorizationDeadline: new Date(value.authorizationDeadline),
				effectiveScopes: [...value.effectiveScopes],
				modulePolicyGeneration: value.modulePolicyGeneration,
				oauthEnabledGeneration: value.oauthEnabledGeneration,
				publicIdentityGeneration: value.publicIdentityGeneration,
				serverSecretVersion: value.serverSecretVersion,
				clientGeneration: value.clientGeneration,
				grantGeneration: value.grantGeneration,
			},
		};
	}

	private async openSubscription(
		clientId: string,
		requestId: string,
		authInfo?: AuthInfo,
		wireRequestId: number | string = requestId,
	): Promise<McpOpenedSubscription> {
		const registration = this.getSubscriptionRegistration(clientId, authInfo);

		if (!registration.oauth) {
			return { authInfo, handle: this.subscriptions.open(registration.clientId, requestId, wireRequestId) };
		}
		if (!authInfo) {
			throw new UnauthorizedException('MCP OAuth subscription identity is unavailable');
		}

		let currentAuthInfo: AuthInfo | undefined;
		const handle = await this.subscriptions.openOAuth(
			requestId,
			async () => {
				currentAuthInfo = await this.oauthResourceServerService.verifyMcpBearerToken(`Bearer ${authInfo.token}`);
				const current = this.getSubscriptionRegistration(clientId, currentAuthInfo);

				if (!current.oauth) {
					throw new UnauthorizedException('MCP OAuth subscription identity is unavailable');
				}

				return { clientId: current.clientId, binding: current.oauth };
			},
			wireRequestId,
			true,
		);

		if (!currentAuthInfo) {
			throw new UnauthorizedException('MCP OAuth subscription revalidation did not complete');
		}

		return { authInfo: currentAuthInfo, handle };
	}

	private isOAuthPrincipal(value: unknown): value is McpOAuthPrincipal {
		if (typeof value !== 'object' || value === null) return false;

		const principal = value as Partial<McpOAuthPrincipal>;
		const generations = [
			principal.modulePolicyGeneration,
			principal.oauthEnabledGeneration,
			principal.publicIdentityGeneration,
			principal.serverSecretVersion,
			principal.clientGeneration,
			principal.grantGeneration,
			principal.approverAuthorityGeneration,
		];

		return (
			principal.type === MCP_OAUTH_PRINCIPAL_TYPE &&
			this.isNonEmptyString(principal.accessTokenId) &&
			this.isNonEmptyString(principal.approverId) &&
			this.isNonEmptyString(principal.clientId) &&
			this.isNonEmptyString(principal.grantId) &&
			(principal.refreshFamilyId === undefined || this.isNonEmptyString(principal.refreshFamilyId)) &&
			typeof principal.authorizationDeadline === 'number' &&
			Number.isFinite(principal.authorizationDeadline) &&
			principal.authorizationDeadline > 0 &&
			Array.isArray(principal.effectiveScopes) &&
			principal.effectiveScopes.every((scope) => Object.values(McpOAuthScope).includes(scope)) &&
			generations.every((generation) => Number.isInteger(generation) && (generation ?? -1) >= 0)
		);
	}

	private isNonEmptyString(value: unknown): value is string {
		return typeof value === 'string' && value.length > 0;
	}

	private trackSubscriptionResponse(
		response: Response,
		subscription: McpSubscriptionHandle,
		transportSignal?: AbortSignal,
	): Response {
		if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
			subscription.close('completed');
			return response;
		}
		const reader = response.body.getReader();
		let streamClosed = false;
		let cancellationSent = false;
		let abortStream = (): void => undefined;
		let abortTransport = (): void => undefined;
		const removeAbortListener = (): void => subscription.signal.removeEventListener('abort', abortStream);
		const removeTransportAbortListener = (): void => transportSignal?.removeEventListener('abort', abortTransport);
		const stream = new ReadableStream<Uint8Array>({
			start: (controller) => {
				abortTransport = (): void => {
					if (streamClosed) return;

					streamClosed = true;
					removeAbortListener();
					removeTransportAbortListener();
					try {
						controller.close();
					} catch {
						// The response consumer already closed the stream.
					} finally {
						void reader.cancel(transportSignal?.reason).catch(() => undefined);
						subscription.close('cancelled');
						subscription.completeTransport();
					}
				};
				transportSignal?.addEventListener('abort', abortTransport, { once: true });
				if (transportSignal?.aborted) abortTransport();

				abortStream = (): void => {
					if (streamClosed || cancellationSent) return;

					cancellationSent = true;
					removeAbortListener();
					try {
						controller.enqueue(this.subscriptionCancellationEvent(subscription.wireRequestId));
						if (subscription.signal.reason !== 'authorization_revoked') {
							streamClosed = true;
							removeTransportAbortListener();
							controller.close();
						}
					} catch {
						// The response consumer already closed the stream.
					} finally {
						void reader.cancel(subscription.signal.reason).catch(() => undefined);
					}
				};
				subscription.signal.addEventListener('abort', abortStream, { once: true });
				if (subscription.signal.aborted) abortStream();
			},
			pull: async (controller) => {
				if (streamClosed || cancellationSent) return;

				try {
					const result = await reader.read();
					if (streamClosed || cancellationSent) return;

					if (result.done) {
						streamClosed = true;
						removeAbortListener();
						removeTransportAbortListener();
						subscription.close('completed');
						controller.close();
						return;
					}

					subscription.touch();
					controller.enqueue(result.value);
				} catch (error) {
					if (streamClosed) return;

					streamClosed = true;
					removeAbortListener();
					removeTransportAbortListener();
					subscription.close('error');
					controller.error(error);
				}
			},
			cancel: async (reason) => {
				streamClosed = true;
				removeAbortListener();
				removeTransportAbortListener();
				subscription.close('cancelled');
				try {
					await reader.cancel(reason);
				} finally {
					subscription.completeTransport();
				}
			},
		});

		return new Response(stream, {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});
	}

	private subscriptionCancellationEvent(requestId: number | string): Uint8Array {
		return new TextEncoder().encode(
			`event: message\ndata: ${JSON.stringify({
				jsonrpc: '2.0',
				method: 'notifications/cancelled',
				params: { requestId },
			})}\n\n`,
		);
	}

	private getWireRequestId(body: unknown): number | string {
		const id = this.getRequestBody(body).id;

		return typeof id === 'number' || typeof id === 'string' ? id : this.auditService.getRequestId(body);
	}

	private auditProtocolRequest(body: unknown, requestId: string, clientId: string): void {
		const request = this.getRequestBody(body);

		if (request.method === 'initialize') {
			const protocolVersion = this.getProtocolVersion(request.params?.protocolVersion);

			this.auditService.recordProtocolRequest(
				{ requestId, clientId },
				{
					kind: 'initialization',
					method: request.method,
					...(protocolVersion ? { protocolVersion } : {}),
				},
			);

			return;
		}

		if (['resources/list', 'resources/templates/list', 'tools/list'].includes(request.method ?? '')) {
			this.auditService.recordProtocolRequest(
				{ requestId, clientId },
				{ kind: 'discovery', method: request.method ?? 'unknown' },
			);
		}
	}

	private getProtocolVersion(value: unknown): string | undefined {
		return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
	}

	private notify(clientId: string | undefined, callback: (handler: McpHttpHandler) => void): void {
		if (clientId) {
			const clientHandler = this.handlers.get(clientId);

			if (clientHandler) {
				callback(clientHandler.handler);
				this.subscriptions.touchClient(clientId);
			}

			return;
		}

		for (const [activeClientId, clientHandler] of this.handlers.entries()) {
			callback(clientHandler.handler);
			this.subscriptions.touchClient(activeClientId);
		}
	}
}
