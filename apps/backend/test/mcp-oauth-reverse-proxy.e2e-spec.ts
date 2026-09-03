import fastify, { FastifyInstance } from 'fastify';
import { RequestListener } from 'node:http';

import { ConfigService as NestConfigService } from '@nestjs/config';

import { TrustedProxyRegistryService } from '../src/modules/api/services/trusted-proxy-registry.service';
import { ConfigService } from '../src/modules/config/services/config.service';
import { MCP_OAUTH_PROTECTED_RESOURCE_METADATA_PATH, MCP_OAUTH_TOKEN_PATH } from '../src/modules/mcp/mcp.constants';
import { McpConfigModel } from '../src/modules/mcp/models/config.model';
import { McpOAuthProviderFactory, McpOAuthProviderRuntime } from '../src/modules/mcp/oauth/mcp-oauth-provider.factory';
import { McpOAuthPublicUrls } from '../src/modules/mcp/oauth/mcp-oauth.types';
import { McpOAuthBootstrapService } from '../src/modules/mcp/services/mcp-oauth-bootstrap.service';
import { McpOAuthLifecycleService } from '../src/modules/mcp/services/mcp-oauth-lifecycle.service';
import { McpOAuthProxyPolicyService } from '../src/modules/mcp/services/mcp-oauth-proxy-policy.service';
import { McpOAuthPublicUrlService } from '../src/modules/mcp/services/mcp-oauth-public-url.service';
import {
	MCP_OAUTH_REQUIRED_READINESS_CONTROLS,
	McpOAuthReadinessControl,
	McpOAuthReadinessService,
} from '../src/modules/mcp/services/mcp-oauth-readiness.service';
import { McpOAuthResourceServerService } from '../src/modules/mcp/services/mcp-oauth-resource-server.service';
import { McpOAuthRouteGateService } from '../src/modules/mcp/services/mcp-oauth-route-gate.service';
import { McpOAuthRuntimeService } from '../src/modules/mcp/services/mcp-oauth-runtime.service';

describe('MCP OAuth reverse-proxy boundary', () => {
	let server: FastifyInstance;

	afterEach(async () => {
		await server?.close();
	});

	it('uses only stored prefixed identity across untrusted, trusted, changed, and rolled-back proxy requests', async () => {
		const originalPublicBaseUrl = 'https://panel.example.com/smart-panel';
		const changedPublicBaseUrl = 'https://new-panel.example.com/edge/panel';
		const config = Object.assign(new McpConfigModel(), {
			enabled: true,
			oauthEnabled: true,
			oauthPublicBaseUrl: originalPublicBaseUrl,
		});
		const configService = { getModuleConfig: jest.fn(() => config) };
		const publicUrls = new McpOAuthPublicUrlService(configService as unknown as ConfigService);
		let trustedProxies = '';
		const env = { get: jest.fn(() => trustedProxies) };
		const proxyPolicy = new McpOAuthProxyPolicyService(
			env as unknown as NestConfigService,
			new TrustedProxyRegistryService(),
		);
		const readiness = new McpOAuthReadinessService();
		readiness.register(
			...MCP_OAUTH_REQUIRED_READINESS_CONTROLS.filter(
				(control) => control !== McpOAuthReadinessControl.COMPLETE_ROUTE_SET,
			),
		);
		const routeGate = new McpOAuthRouteGateService(readiness);
		const providerRequests: string[] = [];
		const callback: RequestListener = (request, response) => {
			providerRequests.push(request.url ?? '');
			response.statusCode = 200;
			response.setHeader('content-type', 'application/json');
			response.end(JSON.stringify({ path: request.url }));
		};
		const createRuntime = jest.fn(() =>
			Promise.resolve({
				provider: {} as McpOAuthProviderRuntime['provider'],
				callback,
				urls: requireUrls(publicUrls),
				metadata: {} as McpOAuthProviderRuntime['metadata'],
			} satisfies McpOAuthProviderRuntime),
		);
		const runtime = new McpOAuthRuntimeService(
			{ create: createRuntime } as unknown as McpOAuthProviderFactory,
			routeGate,
		);
		const lifecycle = new McpOAuthLifecycleService(
			configService as unknown as ConfigService,
			readiness,
			routeGate,
			runtime,
		);
		const resourceServer = {
			getProtectedResourceMetadata: jest.fn(() => {
				const urls = requireUrls(publicUrls);

				return { resource: urls.resource, authorization_servers: [urls.issuer] };
			}),
			getAuthorizationServerMetadata: jest.fn(() => ({ issuer: requireUrls(publicUrls).issuer })),
		};
		const bootstrap = new McpOAuthBootstrapService(
			readiness,
			routeGate,
			proxyPolicy,
			resourceServer as unknown as McpOAuthResourceServerService,
			runtime,
		);

		server = fastify();
		bootstrap.register(server);
		readiness.onApplicationBootstrap();
		await lifecycle.activateInternal();
		const origin = await server.listen({ host: '127.0.0.1', port: 0 });
		expect(createRuntime).toHaveBeenCalledTimes(1);

		const direct = await request(origin, MCP_OAUTH_PROTECTED_RESOURCE_METADATA_PATH, {
			host: 'host-header-attacker.example',
		});
		expect(direct.status).toBe(200);
		expect(await direct.json()).toEqual({
			resource: 'https://panel.example.com/smart-panel/api/v1/modules/mcp',
			authorization_servers: ['https://panel.example.com/smart-panel/api/v1/modules/mcp/oauth'],
		});

		const rejected = await request(origin, MCP_OAUTH_PROTECTED_RESOURCE_METADATA_PATH, {
			forwarded: 'for=203.0.113.9;host=forwarded-attacker.example;proto=http',
			'x-forwarded-host': 'forwarded-attacker.example',
			'x-forwarded-proto': 'http',
		});
		expect(rejected.status).toBe(403);
		expect(await rejected.json()).toEqual({ error: 'access_denied' });

		trustedProxies = '127.0.0.1';
		const trusted = await request(origin, MCP_OAUTH_PROTECTED_RESOURCE_METADATA_PATH, {
			forwarded: 'for=203.0.113.9;host=forwarded-attacker.example;proto=http',
			'x-forwarded-host': 'forwarded-attacker.example',
			'x-forwarded-proto': 'http',
		});
		expect(trusted.status).toBe(200);
		expect(await trusted.json()).toEqual({
			resource: 'https://panel.example.com/smart-panel/api/v1/modules/mcp',
			authorization_servers: ['https://panel.example.com/smart-panel/api/v1/modules/mcp/oauth'],
		});

		const provider = await request(origin, MCP_OAUTH_TOKEN_PATH, {
			'x-forwarded-host': 'forwarded-attacker.example',
			'x-forwarded-prefix': '/attacker-prefix',
			'x-forwarded-proto': 'http',
		});
		expect(provider.status).toBe(200);
		expect(await provider.json()).toEqual({ path: '/smart-panel/api/v1/modules/mcp/oauth/token' });

		await lifecycle.reconfigureInternal(() => {
			config.oauthPublicBaseUrl = changedPublicBaseUrl;
		});
		expect(createRuntime).toHaveBeenCalledTimes(2);
		const changed = await request(origin, MCP_OAUTH_PROTECTED_RESOURCE_METADATA_PATH);
		expect(changed.status).toBe(200);
		expect(await changed.json()).toEqual({
			resource: 'https://new-panel.example.com/edge/panel/api/v1/modules/mcp',
			authorization_servers: ['https://new-panel.example.com/edge/panel/api/v1/modules/mcp/oauth'],
		});
		const changedProvider = await request(origin, MCP_OAUTH_TOKEN_PATH);
		expect(await changedProvider.json()).toEqual({ path: '/edge/panel/api/v1/modules/mcp/oauth/token' });

		await lifecycle.reconfigureInternal(() => {
			config.oauthPublicBaseUrl = originalPublicBaseUrl;
		});
		expect(createRuntime).toHaveBeenCalledTimes(3);
		const rolledBack = await request(origin, MCP_OAUTH_PROTECTED_RESOURCE_METADATA_PATH);
		expect(await rolledBack.json()).toEqual({
			resource: 'https://panel.example.com/smart-panel/api/v1/modules/mcp',
			authorization_servers: ['https://panel.example.com/smart-panel/api/v1/modules/mcp/oauth'],
		});
		const rolledBackProvider = await request(origin, MCP_OAUTH_TOKEN_PATH);
		expect(await rolledBackProvider.json()).toEqual({ path: '/smart-panel/api/v1/modules/mcp/oauth/token' });
		expect(providerRequests).toEqual([
			'/smart-panel/api/v1/modules/mcp/oauth/token',
			'/edge/panel/api/v1/modules/mcp/oauth/token',
			'/smart-panel/api/v1/modules/mcp/oauth/token',
		]);
	});
});

function requireUrls(service: McpOAuthPublicUrlService): McpOAuthPublicUrls {
	const urls = service.getUrls();

	if (!urls) throw new Error('Expected configured MCP OAuth public URLs');

	return urls;
}

function request(origin: string, path: string, headers: Record<string, string> = {}): Promise<Response> {
	return fetch(new URL(path, origin), { method: path === MCP_OAUTH_TOKEN_PATH ? 'POST' : 'GET', headers });
}
