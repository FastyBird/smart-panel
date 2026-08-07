import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { OpenApiResponseInterceptor } from '../src/modules/api/interceptors/open-api-response.interceptor';
import { TransformResponseInterceptor } from '../src/modules/api/interceptors/transform-response.interceptor';
import { McpController } from '../src/modules/mcp/controllers/mcp.controller';
import { McpClientEntity } from '../src/modules/mcp/entities/mcp-client.entity';
import { McpClientGuard } from '../src/modules/mcp/guards/mcp-client.guard';
import { MCP_CATALOG_REGISTRAR, McpCapability } from '../src/modules/mcp/mcp.constants';
import { McpConfigModel } from '../src/modules/mcp/models/config.model';
import { McpContextService } from '../src/modules/mcp/services/mcp-context.service';
import { McpPolicyService } from '../src/modules/mcp/services/mcp-policy.service';
import { McpPolicyRequest } from '../src/modules/mcp/services/mcp-policy.service';
import { McpServerService } from '../src/modules/mcp/services/mcp-server.service';
import { McpSubscriptionRegistryService } from '../src/modules/mcp/services/mcp-subscription-registry.service';
import { McpReadToolService } from '../src/modules/mcp/tools/mcp-read-tool.service';

const AUTH_TOKEN = 'phase-4-client';

@Injectable()
class TestMcpClientGuard implements CanActivate {
	constructor(private readonly serverService: McpServerService) {}

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<McpPolicyRequest>();
		const clientId = request.headers.authorization?.replace(/^Bearer /, '') || AUTH_TOKEN;
		const client = {
			id: clientId,
			name: `Test ${clientId}`,
			enabled: true,
			capabilities: [McpCapability.READ],
			tokenId: `token-${clientId}`,
			token: {
				id: `token-${clientId}`,
				revoked: false,
				expiresAt: new Date(Date.now() + 60_000),
			},
		} as McpClientEntity;

		request.mcpPolicy = {
			client,
			clientPolicyRevision: this.serverService.getClientPolicyRevision(client.id),
			config: Object.assign(new McpConfigModel(), {
				enabled: true,
				capabilities: [McpCapability.READ],
			}),
			effectiveCapabilities: [McpCapability.READ],
			installationId: 'phase-4-installation',
			policyRevision: this.serverService.getPolicyRevision(),
			tokenId: client.tokenId,
		};

		return true;
	}
}

describe('MCP endpoint', () => {
	let app: NestFastifyApplication;
	let endpoint: URL;
	let serverService: McpServerService;
	let subscriptions: McpSubscriptionRegistryService;

	beforeAll(async () => {
		const contextService = {
			getInstallation: jest.fn().mockResolvedValue({
				id: 'phase-4-installation',
				name: 'FastyBird Smart Panel',
				version: '1.0.0',
				timezone: 'UTC',
				endpoint: 'http://localhost/api/v1/modules/mcp',
				effective_capabilities: [McpCapability.READ],
			}),
			getHomeContext: jest.fn().mockResolvedValue({ devices: [], spaces: [], scenes: [] }),
			getDeviceState: jest.fn(),
			getPropertyTimeseries: jest.fn(),
			getEnergySummary: jest.fn(),
			getWeather: jest.fn(),
			getSecurityStatus: jest.fn(),
			listSpaces: jest.fn().mockImplementation((cursor?: string) =>
				Promise.resolve(
					cursor
						? { spaces: [{ id: 'space-id-2', name: 'Workshop', type: 'room' }] }
						: {
								spaces: [{ id: 'space-id', name: 'Living room', type: 'room' }],
								nextCursor: '50',
							},
				),
			),
		};
		const policyService = {
			authorizeClient: jest.fn().mockResolvedValue({ effectiveCapabilities: [McpCapability.READ] }),
		};
		const readTools = new McpReadToolService(
			contextService as unknown as McpContextService,
			policyService as unknown as McpPolicyService,
		);
		const moduleRef = await Test.createTestingModule({
			controllers: [McpController],
			providers: [
				McpServerService,
				McpSubscriptionRegistryService,
				{ provide: MCP_CATALOG_REGISTRAR, useValue: readTools },
			],
		})
			.overrideGuard(McpClientGuard)
			.useClass(TestMcpClientGuard)
			.compile();

		app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		const reflector = app.get(Reflector);
		app.useGlobalInterceptors(new OpenApiResponseInterceptor(reflector), new TransformResponseInterceptor(reflector));

		await app.listen(0, '127.0.0.1');

		serverService = app.get(McpServerService);
		subscriptions = app.get(McpSubscriptionRegistryService);
		endpoint = new URL('/', await app.getUrl());
	});

	afterEach(async () => {
		await serverService.closeAll();
	});

	afterAll(async () => {
		await app.close();
	});

	it('serves modern discovery and the read catalog without response wrapping', async () => {
		const { client, transport } = createClient('modern-client', 'auto');

		try {
			await client.connect(transport);

			const serverVersion = client.getServerVersion();
			expect(serverVersion?.name).toBe('fastybird-smart-panel');
			expect(typeof serverVersion?.version).toBe('string');
			expect(client.getInstructions()).toContain('phase-4-installation');
			expect(client.getInstructions()).toContain('Effective capabilities: read');
			const tools = await client.listTools();
			const resources = await client.listResources();
			const nextResources = await client.listResources({ cursor: '50' });
			const templates = await client.listResourceTemplates();
			const result = await client.callTool({ name: 'get_home_context', arguments: {} });
			const installation = await client.readResource({ uri: 'smart-panel://installation' });

			expect(tools.tools.map(({ name }) => name)).toEqual([
				'get_home_context',
				'get_device_state',
				'get_property_timeseries',
				'get_energy_summary',
				'get_weather',
				'get_security_status',
			]);
			expect(resources.resources.map(({ uri }) => uri)).toEqual(
				expect.arrayContaining([
					'smart-panel://installation',
					'smart-panel://home/context',
					'smart-panel://spaces/space-id/snapshot',
					'smart-panel://spaces/space-id-2/snapshot',
				]),
			);
			expect(nextResources.resources.map(({ uri }) => uri)).toEqual(['smart-panel://spaces/space-id-2/snapshot']);
			expect(templates.resourceTemplates.map(({ uriTemplate }) => uriTemplate)).toContain(
				'smart-panel://spaces/{spaceId}/snapshot',
			);
			expect(result.structuredContent).toEqual(
				expect.objectContaining({ tool: 'get_home_context', data: { devices: [], spaces: [], scenes: [] } }),
			);
			expect(installation.contents[0]).toEqual(
				expect.objectContaining({ uri: 'smart-panel://installation', mimeType: 'application/json' }),
			);
		} finally {
			await client.close();
		}
	});

	it('serves the stateless legacy initialization path', async () => {
		const { client, transport } = createClient('legacy-client');

		try {
			await client.connect(transport);

			const tools = await client.listTools();

			expect(tools.tools.map(({ name }) => name)).toContain('get_home_context');
		} finally {
			await client.close();
		}
	});

	it.each(['GET', 'DELETE'])('returns the SDK-defined 405 for legacy %s operations', async (method) => {
		const response = await fetch(endpoint, {
			method,
			headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
		});

		expect(response.status).toBe(405);
	});

	it('rejects unsupported content types before JSON-RPC dispatch', async () => {
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				Accept: 'application/json, text/event-stream',
				Authorization: `Bearer ${AUTH_TOKEN}`,
				'Content-Type': 'text/plain',
			},
			body: '{}',
		});

		expect(response.status).toBe(415);
	});

	it('preserves JSON-RPC errors for malformed requests', async () => {
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				Accept: 'application/json, text/event-stream',
				Authorization: `Bearer ${AUTH_TOKEN}`,
				'Content-Type': 'application/json',
			},
			body: '{}',
		});
		const body = (await response.json()) as { jsonrpc?: string; error?: { code?: number } };

		expect(response.status).toBe(400);
		expect(body).toMatchObject({ jsonrpc: '2.0', error: { code: -32600 } });
	});

	it('delivers targeted list changes and closes only the selected client stream', async () => {
		const first = createClient('client-a', 'auto');
		const second = createClient('client-b', 'auto');
		let resolveNotification!: () => void;
		const notification = new Promise<void>((resolve) => {
			resolveNotification = resolve;
		});

		first.client.setNotificationHandler('notifications/tools/list_changed', () => resolveNotification());

		try {
			await first.client.connect(first.transport);
			await second.client.connect(second.transport);
			const firstSubscription = await first.client.listen({ toolsListChanged: true });
			const secondSubscription = await second.client.listen({ toolsListChanged: true });

			expect(subscriptions.countForClient('client-a')).toBe(1);
			expect(subscriptions.countForClient('client-b')).toBe(1);

			serverService.notifyToolsChanged('client-a');

			await expect(Promise.race([notification, timeout(2_000)])).resolves.toBeUndefined();

			const secondClosedBeforeTargetClose = await Promise.race([
				secondSubscription.closed.then(() => true),
				timeout(50).then(() => false),
			]);

			expect(secondClosedBeforeTargetClose).toBe(false);

			await serverService.closeClient('client-a');

			await expect(firstSubscription.closed).resolves.toBe('remote');
			expect(subscriptions.countForClient('client-a')).toBe(0);
			expect(subscriptions.countForClient('client-b')).toBe(1);

			await secondSubscription.close();
		} finally {
			await first.client.close();
			await second.client.close();
		}
	});

	function createClient(name: string, mode?: 'auto') {
		const client = new Client({ name, version: '1.0.0' }, mode ? { versionNegotiation: { mode } } : undefined);
		const transport = new StreamableHTTPClientTransport(endpoint, {
			requestInit: { headers: { Authorization: `Bearer ${name}` } },
		});

		return { client, transport };
	}

	function timeout(milliseconds: number): Promise<void> {
		return new Promise((resolve) => {
			const timer = setTimeout(resolve, milliseconds);
			timer.unref();
		});
	}
});
