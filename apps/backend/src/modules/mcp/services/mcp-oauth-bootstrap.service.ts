import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ServerResponse } from 'node:http';

import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';

import {
	MCP_OAUTH_AUTHORIZATION_PATH,
	MCP_OAUTH_AUTHORIZATION_SERVER_METADATA_PATH,
	MCP_OAUTH_ISSUER_PATH,
	MCP_OAUTH_PROTECTED_RESOURCE_METADATA_PATH,
	MCP_OAUTH_REVOCATION_PATH,
	MCP_OAUTH_TOKEN_PATH,
} from '../mcp.constants';

import { McpOAuthProxyPolicyService } from './mcp-oauth-proxy-policy.service';
import { McpOAuthReadinessControl, McpOAuthReadinessService } from './mcp-oauth-readiness.service';
import { McpOAuthResourceServerService } from './mcp-oauth-resource-server.service';
import { McpOAuthRouteGateService } from './mcp-oauth-route-gate.service';
import { McpOAuthRuntimeService } from './mcp-oauth-runtime.service';

type McpOAuthBootstrapRoute =
	| 'protected_resource_metadata'
	| 'authorization_server_metadata'
	| 'authorization'
	| 'token'
	| 'revocation';

@Injectable()
export class McpOAuthBootstrapService {
	private registered = false;

	constructor(
		private readonly readiness: McpOAuthReadinessService,
		private readonly routeGate: McpOAuthRouteGateService,
		private readonly proxyPolicy: McpOAuthProxyPolicyService,
		private readonly resourceServer: McpOAuthResourceServerService,
		private readonly runtime: McpOAuthRuntimeService,
	) {}

	register(fastify: FastifyInstance): void {
		if (this.registered) {
			throw new ServiceUnavailableException('The MCP OAuth bootstrap route set is already registered');
		}

		fastify.addHook('onRequest', async (request, reply) => this.handle(request, reply));
		this.registered = true;
		this.readiness.register(McpOAuthReadinessControl.COMPLETE_ROUTE_SET);
	}

	private handle(request: FastifyRequest, reply: FastifyReply): void {
		const route = this.match(request);

		if (!route) return;

		reply.hijack();

		try {
			this.routeGate.assertOpen();
			this.proxyPolicy.assertForwardedHeadersTrusted(request);

			switch (route) {
				case 'protected_resource_metadata':
					this.writeJson(reply.raw, 200, this.resourceServer.getProtectedResourceMetadata());
					return;
				case 'authorization_server_metadata':
					this.writeJson(reply.raw, 200, this.resourceServer.getAuthorizationServerMetadata());
					return;
				default:
					this.dispatchProvider(request, reply);
			}
		} catch (error) {
			this.writeRouteError(reply.raw, error);
		}
	}

	private match(request: FastifyRequest): McpOAuthBootstrapRoute | null {
		const pathname = new URL(request.raw.url ?? '/', 'http://localhost').pathname;
		const method = request.raw.method ?? request.method;

		if (method === 'GET' && pathname === MCP_OAUTH_PROTECTED_RESOURCE_METADATA_PATH) {
			return 'protected_resource_metadata';
		}
		if (method === 'GET' && pathname === MCP_OAUTH_AUTHORIZATION_SERVER_METADATA_PATH) {
			return 'authorization_server_metadata';
		}
		if (method === 'GET' && this.isAuthorizationPath(pathname)) {
			return 'authorization';
		}
		if ((method === 'POST' || method === 'OPTIONS') && pathname === MCP_OAUTH_TOKEN_PATH) return 'token';
		if ((method === 'POST' || method === 'OPTIONS') && pathname === MCP_OAUTH_REVOCATION_PATH) return 'revocation';

		return null;
	}

	private isAuthorizationPath(pathname: string): boolean {
		if (pathname === MCP_OAUTH_AUTHORIZATION_PATH) return true;

		const resumePrefix = `${MCP_OAUTH_AUTHORIZATION_PATH}/`;
		const resumeId = pathname.startsWith(resumePrefix) ? pathname.slice(resumePrefix.length) : '';

		return resumeId.length > 0 && !resumeId.includes('/');
	}

	private dispatchProvider(request: FastifyRequest, reply: FastifyReply): void {
		const runtime = this.runtime.getActive();
		const url = new URL(request.raw.url ?? '/', 'http://localhost');
		const providerIssuerPath = new URL(runtime.urls.issuer).pathname;
		request.raw.url = `${providerIssuerPath}${url.pathname.slice(MCP_OAUTH_ISSUER_PATH.length)}${url.search}`;
		runtime.callback(request.raw, reply.raw);
	}

	private writeRouteError(response: ServerResponse, error: unknown): void {
		const status = error instanceof ForbiddenException ? 403 : error instanceof ServiceUnavailableException ? 503 : 500;
		const code = status === 403 ? 'access_denied' : status === 503 ? 'temporarily_unavailable' : 'server_error';

		this.writeJson(response, status, { error: code });
	}

	private writeJson(response: ServerResponse, status: number, payload: unknown): void {
		if (response.headersSent || response.writableEnded) return;

		response.statusCode = status;
		response.setHeader('content-type', 'application/json');
		response.setHeader('cache-control', 'no-store');
		response.setHeader('pragma', 'no-cache');
		response.end(JSON.stringify(payload));
	}
}
