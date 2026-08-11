import Fastify, { FastifyInstance } from 'fastify';
import { IncomingMessage, ServerResponse } from 'node:http';

import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';

import {
	MCP_OAUTH_AUTHORIZATION_PATH,
	MCP_OAUTH_AUTHORIZATION_SERVER_METADATA_PATH,
	MCP_OAUTH_PROTECTED_RESOURCE_METADATA_PATH,
	MCP_OAUTH_REVOCATION_PATH,
	MCP_OAUTH_TOKEN_PATH,
} from '../mcp.constants';
import { McpOAuthProviderRuntime } from '../oauth/mcp-oauth-provider.factory';

import { McpOAuthBootstrapService } from './mcp-oauth-bootstrap.service';
import { McpOAuthProxyPolicyService } from './mcp-oauth-proxy-policy.service';
import { McpOAuthReadinessControl, McpOAuthReadinessService } from './mcp-oauth-readiness.service';
import { McpOAuthResourceServerService } from './mcp-oauth-resource-server.service';
import { McpOAuthRouteGateService } from './mcp-oauth-route-gate.service';
import { McpOAuthRuntimeService } from './mcp-oauth-runtime.service';

describe('McpOAuthBootstrapService', () => {
	let fastify: FastifyInstance;
	let gateOpen: boolean;
	let readiness: { register: jest.Mock };
	let routeGate: { assertOpen: jest.Mock };
	let proxyPolicy: { assertForwardedHeadersTrusted: jest.Mock };
	let resourceServer: {
		getProtectedResourceMetadata: jest.Mock;
		getAuthorizationServerMetadata: jest.Mock;
	};
	let runtime: { getActive: jest.Mock };
	let providerCallback: jest.Mock;
	let laterPreflightHook: jest.Mock;
	let service: McpOAuthBootstrapService;

	beforeEach(async () => {
		gateOpen = false;
		readiness = { register: jest.fn() };
		routeGate = {
			assertOpen: jest.fn(() => {
				if (!gateOpen) throw new ServiceUnavailableException('closed');
			}),
		};
		proxyPolicy = { assertForwardedHeadersTrusted: jest.fn() };
		resourceServer = {
			getProtectedResourceMetadata: jest.fn(() => ({ resource: 'https://panel.example/api/v1/modules/mcp' })),
			getAuthorizationServerMetadata: jest.fn(() => ({
				issuer: 'https://panel.example/api/v1/modules/mcp/oauth',
			})),
		};
		providerCallback = jest.fn((request: IncomingMessage, response: ServerResponse) => {
			response.statusCode = 204;
			response.setHeader('x-provider-path', request.url ?? '');
			response.end();
		});
		runtime = {
			getActive: jest.fn(
				() =>
					({
						callback: providerCallback,
						urls: { issuer: 'https://panel.example/api/v1/modules/mcp/oauth' },
					}) as unknown as McpOAuthProviderRuntime,
			),
		};
		service = new McpOAuthBootstrapService(
			readiness as unknown as McpOAuthReadinessService,
			routeGate as unknown as McpOAuthRouteGateService,
			proxyPolicy as unknown as McpOAuthProxyPolicyService,
			resourceServer as unknown as McpOAuthResourceServerService,
			runtime as unknown as McpOAuthRuntimeService,
		);
		fastify = Fastify();
		service.register(fastify);
		laterPreflightHook = jest.fn();
		fastify.addHook('onRequest', async (request, reply) => {
			if (request.method !== 'OPTIONS') return;

			laterPreflightHook();
			await reply.status(204).send();
		});
		await fastify.ready();
	});

	afterEach(async () => {
		await fastify.close();
	});

	it('registers the complete route-set readiness control exactly once', () => {
		expect(readiness.register).toHaveBeenCalledWith(McpOAuthReadinessControl.COMPLETE_ROUTE_SET);
		expect(() => service.register(fastify)).toThrow('The MCP OAuth bootstrap route set is already registered');
		expect(readiness.register).toHaveBeenCalledTimes(1);
	});

	it.each([
		['protected-resource metadata', 'GET', MCP_OAUTH_PROTECTED_RESOURCE_METADATA_PATH],
		['authorization-server metadata', 'GET', MCP_OAUTH_AUTHORIZATION_SERVER_METADATA_PATH],
		['authorization', 'GET', MCP_OAUTH_AUTHORIZATION_PATH],
		['authorization resume', 'GET', `${MCP_OAUTH_AUTHORIZATION_PATH}/interaction-id`],
		['token', 'POST', MCP_OAUTH_TOKEN_PATH],
		['token preflight', 'OPTIONS', MCP_OAUTH_TOKEN_PATH],
		['revocation', 'POST', MCP_OAUTH_REVOCATION_PATH],
		['revocation preflight', 'OPTIONS', MCP_OAUTH_REVOCATION_PATH],
	])('fails closed for the %s route', async (_label, method, url) => {
		const response = await fastify.inject({ method: method as 'GET' | 'POST' | 'OPTIONS', url });

		expect(response.statusCode).toBe(503);
		expect(response.json()).toEqual({ error: 'temporarily_unavailable' });
		expect(response.headers['cache-control']).toBe('no-store');
		expect(proxyPolicy.assertForwardedHeadersTrusted).not.toHaveBeenCalled();
		expect(runtime.getActive).not.toHaveBeenCalled();
	});

	it('checks the shared gate before a later CORS-style preflight hook can terminate the request', async () => {
		const response = await fastify.inject({ method: 'OPTIONS', url: MCP_OAUTH_TOKEN_PATH });

		expect(response.statusCode).toBe(503);
		expect(response.json()).toEqual({ error: 'temporarily_unavailable' });
		expect(laterPreflightHook).not.toHaveBeenCalled();
	});

	it('publishes only the bounded metadata projections after the gate opens', async () => {
		gateOpen = true;

		const protectedResource = await fastify.inject({ method: 'GET', url: MCP_OAUTH_PROTECTED_RESOURCE_METADATA_PATH });
		const authorizationServer = await fastify.inject({
			method: 'GET',
			url: MCP_OAUTH_AUTHORIZATION_SERVER_METADATA_PATH,
		});

		expect(protectedResource.json()).toEqual({ resource: 'https://panel.example/api/v1/modules/mcp' });
		expect(authorizationServer.json()).toEqual({ issuer: 'https://panel.example/api/v1/modules/mcp/oauth' });
		expect(resourceServer.getProtectedResourceMetadata).toHaveBeenCalledTimes(1);
		expect(resourceServer.getAuthorizationServerMetadata).toHaveBeenCalledTimes(1);
		expect(runtime.getActive).not.toHaveBeenCalled();
	});

	it.each([
		['GET', `${MCP_OAUTH_AUTHORIZATION_PATH}?client_id=client`, `${MCP_OAUTH_AUTHORIZATION_PATH}?client_id=client`],
		['GET', `${MCP_OAUTH_AUTHORIZATION_PATH}/interaction-id`, `${MCP_OAUTH_AUTHORIZATION_PATH}/interaction-id`],
		['POST', MCP_OAUTH_TOKEN_PATH, MCP_OAUTH_TOKEN_PATH],
		['POST', MCP_OAUTH_REVOCATION_PATH, MCP_OAUTH_REVOCATION_PATH],
	])('dispatches the finite provider route %s %s without a catch-all', async (method, url, providerPath) => {
		gateOpen = true;

		const response = await fastify.inject({ method: method as 'GET' | 'POST', url });

		expect(response.statusCode).toBe(204);
		expect(response.headers['x-provider-path']).toBe(providerPath);
		expect(providerCallback).toHaveBeenCalledTimes(1);
	});

	it('does not intercept unregistered dependency or application paths', async () => {
		gateOpen = true;

		const rawDiscovery = await fastify.inject({
			method: 'GET',
			url: '/api/v1/modules/mcp/oauth/.well-known/openid-configuration',
		});
		const registration = await fastify.inject({ method: 'POST', url: '/api/v1/modules/mcp/oauth/reg' });
		const nestedAuthorization = await fastify.inject({
			method: 'GET',
			url: `${MCP_OAUTH_AUTHORIZATION_PATH}/interaction-id/nested`,
		});
		const unrelated = await fastify.inject({ method: 'GET', url: '/api/v1/modules/devices' });

		expect([
			rawDiscovery.statusCode,
			registration.statusCode,
			nestedAuthorization.statusCode,
			unrelated.statusCode,
		]).toEqual([404, 404, 404, 404]);
		expect(providerCallback).not.toHaveBeenCalled();
	});

	it('rejects forwarded headers before provider dispatch', async () => {
		gateOpen = true;
		proxyPolicy.assertForwardedHeadersTrusted.mockImplementation(() => {
			throw new ForbiddenException('untrusted proxy');
		});

		const response = await fastify.inject({ method: 'POST', url: MCP_OAUTH_TOKEN_PATH });

		expect(response.statusCode).toBe(403);
		expect(response.json()).toEqual({ error: 'access_denied' });
		expect(providerCallback).not.toHaveBeenCalled();
	});
});
