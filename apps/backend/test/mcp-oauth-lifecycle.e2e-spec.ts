import fastify, { FastifyInstance } from 'fastify';
import { RequestListener } from 'node:http';
import { Repository } from 'typeorm';

import { ConfigService } from '../src/modules/config/services/config.service';
import { ModuleConfigMutationRegistryService } from '../src/modules/config/services/module-config-mutation-registry.service';
import { UpdateMcpConfigDto } from '../src/modules/mcp/dto/update-config.dto';
import { McpOAuthServerStateEntity } from '../src/modules/mcp/entities/mcp-oauth.entity';
import {
	MCP_MODULE_NAME,
	MCP_OAUTH_AUTHORIZATION_PATH,
	MCP_OAUTH_AUTHORIZATION_SERVER_METADATA_PATH,
	MCP_OAUTH_PROTECTED_RESOURCE_METADATA_PATH,
	MCP_OAUTH_REVOCATION_PATH,
	MCP_OAUTH_TOKEN_PATH,
} from '../src/modules/mcp/mcp.constants';
import { McpConfigModel } from '../src/modules/mcp/models/config.model';
import { McpOAuthProviderFactory, McpOAuthProviderRuntime } from '../src/modules/mcp/oauth/mcp-oauth-provider.factory';
import { McpOAuthPublicUrls } from '../src/modules/mcp/oauth/mcp-oauth.types';
import { McpAuditService } from '../src/modules/mcp/services/mcp-audit.service';
import { McpOAuthBootstrapService } from '../src/modules/mcp/services/mcp-oauth-bootstrap.service';
import { McpOAuthGlobalInvalidationService } from '../src/modules/mcp/services/mcp-oauth-global-invalidation.service';
import { McpOAuthLifecycleService } from '../src/modules/mcp/services/mcp-oauth-lifecycle.service';
import { McpOAuthModuleConfigMutationService } from '../src/modules/mcp/services/mcp-oauth-module-config-mutation.service';
import { McpOAuthProxyPolicyService } from '../src/modules/mcp/services/mcp-oauth-proxy-policy.service';
import {
	MCP_OAUTH_REQUIRED_READINESS_CONTROLS,
	McpOAuthReadinessControl,
	McpOAuthReadinessService,
} from '../src/modules/mcp/services/mcp-oauth-readiness.service';
import { McpOAuthResourceServerService } from '../src/modules/mcp/services/mcp-oauth-resource-server.service';
import { McpOAuthRouteGateService } from '../src/modules/mcp/services/mcp-oauth-route-gate.service';
import { McpOAuthRuntimeService } from '../src/modules/mcp/services/mcp-oauth-runtime.service';
import { McpOAuthSwitchOffService } from '../src/modules/mcp/services/mcp-oauth-switch-off.service';
import { McpSubscriptionRegistryService } from '../src/modules/mcp/services/mcp-subscription-registry.service';

type RouteMethod = 'GET' | 'OPTIONS' | 'POST';

interface OAuthRouteCase {
	method: RouteMethod;
	path: string;
	provider: boolean;
}

const ROUTE_SET: readonly OAuthRouteCase[] = [
	{ method: 'GET', path: MCP_OAUTH_PROTECTED_RESOURCE_METADATA_PATH, provider: false },
	{ method: 'GET', path: MCP_OAUTH_AUTHORIZATION_SERVER_METADATA_PATH, provider: false },
	{ method: 'GET', path: MCP_OAUTH_AUTHORIZATION_PATH, provider: true },
	{ method: 'GET', path: `${MCP_OAUTH_AUTHORIZATION_PATH}/interaction-one`, provider: true },
	{ method: 'POST', path: MCP_OAUTH_TOKEN_PATH, provider: true },
	{ method: 'OPTIONS', path: MCP_OAUTH_TOKEN_PATH, provider: true },
	{ method: 'POST', path: MCP_OAUTH_REVOCATION_PATH, provider: true },
	{ method: 'OPTIONS', path: MCP_OAUTH_REVOCATION_PATH, provider: true },
];

const urls: McpOAuthPublicUrls = {
	publicBaseUrl: 'https://panel.example.com',
	resource: 'https://panel.example.com/api/v1/modules/mcp',
	protectedResourceMetadata: `https://panel.example.com${MCP_OAUTH_PROTECTED_RESOURCE_METADATA_PATH}`,
	issuer: 'https://panel.example.com/api/v1/modules/mcp/oauth',
	authorizationServerMetadata: `https://panel.example.com${MCP_OAUTH_AUTHORIZATION_SERVER_METADATA_PATH}`,
	authorizationEndpoint: `https://panel.example.com${MCP_OAUTH_AUTHORIZATION_PATH}`,
	tokenEndpoint: `https://panel.example.com${MCP_OAUTH_TOKEN_PATH}`,
	revocationEndpoint: `https://panel.example.com${MCP_OAUTH_REVOCATION_PATH}`,
};

describe('MCP OAuth runtime route lifecycle', () => {
	let server: FastifyInstance;

	afterEach(async () => {
		await server?.close();
	});

	it('transitions the complete bootstrap route set together without restarting', async () => {
		const readiness = new McpOAuthReadinessService();
		readiness.register(
			...MCP_OAUTH_REQUIRED_READINESS_CONTROLS.filter(
				(control) => control !== McpOAuthReadinessControl.COMPLETE_ROUTE_SET,
			),
		);
		const routeGate = new McpOAuthRouteGateService(readiness);
		const providerRequests: string[] = [];
		let runtimeVersion = 0;
		const createRuntime = jest.fn(() => {
			runtimeVersion += 1;
			const version = runtimeVersion;
			const callback: RequestListener = (request, response) => {
				providerRequests.push(request.url ?? '');
				response.statusCode = 200;
				response.setHeader('content-type', 'application/json');
				response.setHeader('cache-control', 'no-store');
				response.end(JSON.stringify({ runtimeVersion: version }));
			};
			const runtime: McpOAuthProviderRuntime = {
				provider: {} as McpOAuthProviderRuntime['provider'],
				callback,
				urls,
				metadata: { issuer: urls.issuer } as McpOAuthProviderRuntime['metadata'],
			};

			return Promise.resolve(runtime);
		});
		const runtime = new McpOAuthRuntimeService(
			{ create: createRuntime } as unknown as McpOAuthProviderFactory,
			routeGate,
		);
		const config = Object.assign(new McpConfigModel(), {
			enabled: true,
			oauthEnabled: false,
			oauthPublicBaseUrl: urls.publicBaseUrl,
		});
		const configService = {
			getModuleConfig: jest.fn(() => config),
			reload: jest.fn(),
		};
		const lifecycle = new McpOAuthLifecycleService(
			configService as unknown as ConfigService,
			readiness,
			routeGate,
			runtime,
		);
		const bootstrap = new McpOAuthBootstrapService(
			readiness,
			routeGate,
			{ assertForwardedHeadersTrusted: jest.fn() } as unknown as McpOAuthProxyPolicyService,
			{
				getProtectedResourceMetadata: jest.fn(() => ({
					resource: urls.resource,
					authorization_servers: [urls.issuer],
				})),
				getAuthorizationServerMetadata: jest.fn(() => ({ issuer: urls.issuer })),
			} as unknown as McpOAuthResourceServerService,
			runtime,
		);
		const invalidate = jest.fn(async (_generations: string[], persist: () => Promise<void>): Promise<void> => {
			expect(routeGate.isOpen).toBe(false);
			expect(() => runtime.getActive()).toThrow('The MCP OAuth route gate is closed');
			await persist();
		});
		const auditService = {
			recordOAuthAuthorizationInvalidation: jest.fn(),
			recordSubscriptionClosed: jest.fn(),
			recordSubscriptionOpened: jest.fn(),
		};
		const globalInvalidation = {
			invalidate,
			invalidateAll: jest.fn(),
		};
		const switchOff = new McpOAuthSwitchOffService(
			routeGate,
			runtime,
			globalInvalidation as unknown as McpOAuthGlobalInvalidationService,
			auditService as unknown as McpAuditService,
		);
		const moduleConfigMutation = new McpOAuthModuleConfigMutationService(
			configService as unknown as ConfigService,
			{} as Repository<McpOAuthServerStateEntity>,
			new McpSubscriptionRegistryService(auditService as unknown as McpAuditService),
			globalInvalidation as unknown as McpOAuthGlobalInvalidationService,
			auditService as unknown as McpAuditService,
			routeGate,
			lifecycle,
			switchOff,
		);
		const moduleConfigMutations = new ModuleConfigMutationRegistryService();
		moduleConfigMutations.register<UpdateMcpConfigDto>(MCP_MODULE_NAME, (update, commit) =>
			moduleConfigMutation.update(update, commit),
		);
		const updateOAuth = (oauthEnabled: boolean): Promise<void> =>
			moduleConfigMutations.execute(
				MCP_MODULE_NAME,
				Object.assign(new UpdateMcpConfigDto(), { oauth_enabled: oauthEnabled }),
				() => {
					config.oauthEnabled = oauthEnabled;
				},
			);

		server = fastify();
		bootstrap.register(server);
		readiness.onApplicationBootstrap();
		await lifecycle.onApplicationBootstrap();
		const origin = await server.listen({ host: '127.0.0.1', port: 0 });

		await expectRouteSet(origin, 503);
		expect(providerRequests).toEqual([]);

		await updateOAuth(true);

		await expectRouteSet(origin, 200, 1);
		expect(createRuntime).toHaveBeenCalledTimes(1);

		await updateOAuth(false);

		await expectRouteSet(origin, 503);
		expect(invalidate).toHaveBeenCalledWith(['oauthEnabledGeneration'], expect.any(Function));
		expect(createRuntime).toHaveBeenCalledTimes(1);

		await updateOAuth(true);

		await expectRouteSet(origin, 200, 2);
		expect(createRuntime).toHaveBeenCalledTimes(2);
	});
});

async function expectRouteSet(origin: string, status: number, runtimeVersion?: number): Promise<void> {
	for (const route of ROUTE_SET) {
		const response = await fetch(new URL(route.path, origin), {
			method: route.method,
			...(route.method === 'POST'
				? {
						body: 'resource=https%3A%2F%2Fpanel.example.com%2Fapi%2Fv1%2Fmodules%2Fmcp',
						headers: { 'content-type': 'application/x-www-form-urlencoded' },
					}
				: {}),
		});
		const body = (await response.json()) as { error?: string; runtimeVersion?: number };

		expect({ method: route.method, path: route.path, status: response.status }).toMatchObject({ status });
		expect(response.headers.get('cache-control')).toBe('no-store');

		if (status === 503) {
			expect(body).toEqual({ error: 'temporarily_unavailable' });
			expect(response.headers.get('pragma')).toBe('no-cache');
		} else if (route.provider) {
			expect(body.runtimeVersion).toBe(runtimeVersion);
		}
	}
}
