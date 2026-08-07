import { FastifyReply } from 'fastify';
import { readFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { resolve } from 'path';

import { toNodeHandler } from '@modelcontextprotocol/node';
import { AuthInfo, McpHttpHandler, McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { Injectable, OnApplicationShutdown, Optional, UnauthorizedException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { createExtensionLogger } from '../../../common/logger';
import { extractAccessTokenFromHeader } from '../../auth/utils/token.utils';
import { MCP_CATALOG_REGISTRAR, MCP_MAX_SUBSCRIPTIONS_PER_CLIENT, MCP_MODULE_NAME } from '../mcp.constants';

import { McpPolicyRequest } from './mcp-policy.service';
import {
	McpSubscriptionCapacityError,
	McpSubscriptionHandle,
	McpSubscriptionRegistryService,
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
}

interface McpCatalogRegistrar {
	register(server: McpServer, authInfo?: AuthInfo): void;
}

@Injectable()
export class McpServerService implements OnApplicationShutdown {
	private readonly logger = createExtensionLogger(MCP_MODULE_NAME, 'McpServerService');
	private readonly handlers = new Map<string, ClientHandler>();
	private readonly clientPolicyRevisions = new Map<string, number>();
	private policyRevision = 0;

	constructor(
		private readonly subscriptions: McpSubscriptionRegistryService,
		@Optional() private readonly moduleRef?: ModuleRef,
	) {}

	async handle(request: McpPolicyRequest, reply: FastifyReply): Promise<void> {
		if (!request.mcpPolicy) {
			throw new UnauthorizedException('MCP request policy was not resolved');
		}

		const token = extractAccessTokenFromHeader(request);

		if (!token) {
			throw new UnauthorizedException('Authentication required');
		}

		const policy = request.mcpPolicy;

		if (
			policy.policyRevision !== this.policyRevision ||
			policy.clientPolicyRevision !== this.getClientPolicyRevision(policy.client.id)
		) {
			throw new UnauthorizedException('MCP request policy is no longer current');
		}

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
		this.subscriptions.closeAll();
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
				const [webRequest, options] = args;

				if (!this.isSubscriptionListen(options?.parsedBody)) {
					return fetch(webRequest, options);
				}

				let subscription: McpSubscriptionHandle;

				try {
					subscription = this.subscriptions.open(clientId);
				} catch (error) {
					if (error instanceof McpSubscriptionCapacityError) {
						return this.subscriptionLimitResponse(options?.parsedBody);
					}

					throw error;
				}

				const signal = AbortSignal.any([webRequest.signal, subscription.signal]);
				let response: Response;

				try {
					response = await fetch(new Request(webRequest, { signal }), options);
				} catch (error) {
					subscription.close();
					throw error;
				}

				return this.trackSubscriptionResponse(response, subscription);
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

	private subscriptionLimitResponse(body: unknown): Response {
		const request = this.getRequestBody(body);

		return Response.json(
			{
				jsonrpc: '2.0',
				id: request.id ?? null,
				error: { code: -32603, message: 'Subscription limit reached' },
			},
			{ status: 200 },
		);
	}

	private getRequestBody(body: unknown): JsonRpcRequestBody {
		return body && typeof body === 'object' && !Array.isArray(body) ? (body as JsonRpcRequestBody) : {};
	}

	private trackSubscriptionResponse(response: Response, subscription: McpSubscriptionHandle): Response {
		if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
			subscription.close();
			return response;
		}

		const reader = response.body.getReader();
		const stream = new ReadableStream<Uint8Array>({
			pull: async (controller) => {
				try {
					const result = await reader.read();

					if (result.done) {
						subscription.close();
						controller.close();
						return;
					}

					subscription.touch();
					controller.enqueue(result.value);
				} catch (error) {
					subscription.close();
					controller.error(error);
				}
			},
			cancel: async (reason) => {
				subscription.close();
				await reader.cancel(reason);
			},
		});

		return new Response(stream, {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});
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
