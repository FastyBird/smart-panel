import { DataSource, Repository } from 'typeorm';
import { z } from 'zod';

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { AuthInfo, McpServer } from '@modelcontextprotocol/server';
import { CanActivate, ExecutionContext, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { OpenApiResponseInterceptor } from '../src/modules/api/interceptors/open-api-response.interceptor';
import { TransformResponseInterceptor } from '../src/modules/api/interceptors/transform-response.interceptor';
import { TokensService } from '../src/modules/auth/services/tokens.service';
import { ConfigService } from '../src/modules/config/services/config.service';
import { ChannelsPropertiesService } from '../src/modules/devices/services/channels.properties.service';
import { DeviceConnectionStateService } from '../src/modules/devices/services/device-connection-state.service';
import { PlatformRegistryService } from '../src/modules/devices/services/platform.registry.service';
import { McpController } from '../src/modules/mcp/controllers/mcp.controller';
import { McpClientEntity } from '../src/modules/mcp/entities/mcp-client.entity';
import { McpClientGuard } from '../src/modules/mcp/guards/mcp-client.guard';
import { MCP_CATALOG_REGISTRAR, McpCapability } from '../src/modules/mcp/mcp.constants';
import { McpConfigModel } from '../src/modules/mcp/models/config.model';
import { McpAuditService } from '../src/modules/mcp/services/mcp-audit.service';
import { McpClientService } from '../src/modules/mcp/services/mcp-client.service';
import { McpContextService } from '../src/modules/mcp/services/mcp-context.service';
import { McpInstallationService } from '../src/modules/mcp/services/mcp-installation.service';
import { McpPolicyService } from '../src/modules/mcp/services/mcp-policy.service';
import { McpPolicyRequest } from '../src/modules/mcp/services/mcp-policy.service';
import { McpServerService } from '../src/modules/mcp/services/mcp-server.service';
import { McpSubscriptionRegistryService } from '../src/modules/mcp/services/mcp-subscription-registry.service';
import { McpReadToolService } from '../src/modules/mcp/tools/mcp-read-tool.service';
import { McpTargetDiscoveryToolService } from '../src/modules/mcp/tools/mcp-target-discovery-tool.service';
import { ScenesService } from '../src/modules/scenes/services/scenes.service';
import { SpacesService } from '../src/modules/spaces/services/spaces.service';
import {
	ToolAccessKind,
	ToolAudience,
	createToolDefinition,
} from '../src/modules/tools/platforms/tool-provider.platform';
import { ToolProviderRegistryService } from '../src/modules/tools/services/tool-provider-registry.service';

const AUTH_TOKEN = 'phase-4-client';
const ALL_CAPABILITIES = [McpCapability.READ, McpCapability.WRITE, McpCapability.TRIGGER];
const READ_TOOLS = [
	'get_home_context',
	'get_device_state',
	'get_property_timeseries',
	'get_energy_summary',
	'get_weather',
	'get_security_status',
];
const WRITE_TOOLS = ['list_writable_properties', 'set_device_property'];
const TRIGGER_TOOLS = ['list_trigger_targets', 'run_scene', 'set_space_lighting'];
const CAPABILITY_CASES: { capabilities: McpCapability[]; expectedTools: string[] }[] = [
	{ capabilities: [], expectedTools: [] },
	{ capabilities: [McpCapability.READ], expectedTools: [...READ_TOOLS] },
	{ capabilities: [McpCapability.WRITE], expectedTools: [...WRITE_TOOLS] },
	{ capabilities: [McpCapability.TRIGGER], expectedTools: [...TRIGGER_TOOLS] },
	{
		capabilities: [McpCapability.READ, McpCapability.WRITE],
		expectedTools: [...READ_TOOLS, ...WRITE_TOOLS],
	},
	{
		capabilities: [McpCapability.READ, McpCapability.TRIGGER],
		expectedTools: [...READ_TOOLS, ...TRIGGER_TOOLS],
	},
	{
		capabilities: [McpCapability.WRITE, McpCapability.TRIGGER],
		expectedTools: [...WRITE_TOOLS, ...TRIGGER_TOOLS],
	},
	{ capabilities: [...ALL_CAPABILITIES], expectedTools: [...READ_TOOLS, ...WRITE_TOOLS, ...TRIGGER_TOOLS] },
];

interface TestClientPolicy {
	capabilities: McpCapability[];
	revoked?: boolean;
}

let endpointEnabled = true;
let moduleCapabilities = [...ALL_CAPABILITIES];
const clientPolicies = new Map<string, TestClientPolicy>();

@Injectable()
class TestMcpClientGuard implements CanActivate {
	constructor(private readonly serverService: McpServerService) {}

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<McpPolicyRequest>();
		const clientId = request.headers.authorization?.replace(/^Bearer /, '') || AUTH_TOKEN;
		const clientPolicy = clientPolicies.get(clientId) ?? { capabilities: [McpCapability.READ] };

		if (!endpointEnabled) {
			throw new NotFoundException('MCP endpoint is disabled');
		}

		if (clientPolicy.revoked) {
			throw new UnauthorizedException('MCP credential is no longer active');
		}

		const effectiveCapabilities = clientPolicy.capabilities.filter((capability) =>
			moduleCapabilities.includes(capability),
		);
		const client = {
			id: clientId,
			name: `Test ${clientId}`,
			enabled: true,
			capabilities: [...clientPolicy.capabilities],
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
				capabilities: [...moduleCapabilities],
			}),
			effectiveCapabilities,
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
	let clientsService: McpClientService;
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
		const auditService = new McpAuditService();
		const readTools = new McpReadToolService(
			contextService as unknown as McpContextService,
			policyService as unknown as McpPolicyService,
			auditService,
		);
		const toolRegistry = new ToolProviderRegistryService();

		toolRegistry.register({
			getType: () => 'mcp-endpoint-catalog',
			getToolDefinitions: () => [
				createToolDefinition({
					name: 'control_device',
					description: 'Test device control provider.',
					audiences: [ToolAudience.MCP],
					access: ToolAccessKind.WRITE,
					inputSchema: z.object({}),
					outputSchema: z.object({}),
				}),
				createToolDefinition({
					name: 'run_scene',
					description: 'Test scene provider.',
					audiences: [ToolAudience.MCP],
					access: ToolAccessKind.TRIGGER,
					inputSchema: z.object({}),
					outputSchema: z.object({}),
				}),
				createToolDefinition({
					name: 'set_space_lighting',
					description: 'Test space lighting provider.',
					audiences: [ToolAudience.MCP],
					access: ToolAccessKind.TRIGGER,
					inputSchema: z.object({}),
					outputSchema: z.object({}),
				}),
			],
			executeTool: jest.fn().mockResolvedValue(null),
		});

		const targetTools = new McpTargetDiscoveryToolService(
			{} as ChannelsPropertiesService,
			{} as DeviceConnectionStateService,
			{} as PlatformRegistryService,
			{} as ScenesService,
			{} as SpacesService,
			toolRegistry,
			contextService as unknown as McpContextService,
			policyService as unknown as McpPolicyService,
			auditService,
		);
		const catalog = {
			register(server: McpServer, authInfo?: AuthInfo): void {
				readTools.register(server, authInfo);
				targetTools.register(server, authInfo);
			},
		};
		const moduleRef = await Test.createTestingModule({
			controllers: [McpController],
			providers: [
				{ provide: McpAuditService, useValue: auditService },
				McpServerService,
				McpSubscriptionRegistryService,
				{ provide: MCP_CATALOG_REGISTRAR, useValue: catalog },
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
		const repository = {
			findOne: jest.fn(({ where }: { where: { id: string } }) => Promise.resolve(toClientEntity(where.id))),
		};
		const managedRepository = {
			update: jest.fn((criteria: { id: string }, update: Partial<McpClientEntity>) => {
				const policy = clientPolicies.get(criteria.id);

				if (!policy) {
					return Promise.resolve({ affected: 0 });
				}

				if (update.capabilities) {
					policy.capabilities = [...update.capabilities];
				}

				if (update.enabled === false) {
					policy.revoked = true;
				}

				return Promise.resolve({ affected: 1 });
			}),
		};
		const dataSource = {
			transaction: jest.fn((callback: (manager: { getRepository: () => typeof managedRepository }) => unknown) =>
				callback({ getRepository: () => managedRepository }),
			),
		};
		clientsService = new McpClientService(
			repository as unknown as Repository<McpClientEntity>,
			dataSource as unknown as DataSource,
			{ revoke: jest.fn().mockResolvedValue(undefined) } as unknown as TokensService,
			{} as JwtService,
			{
				getModuleConfig: jest.fn(() => ({ capabilities: [...moduleCapabilities] })),
			} as unknown as ConfigService,
			{} as McpInstallationService,
			serverService,
		);
		subscriptions = app.get(McpSubscriptionRegistryService);
		endpoint = new URL('/', await app.getUrl());
	});

	afterEach(async () => {
		await serverService.closeAll();
		endpointEnabled = true;
		moduleCapabilities = [...ALL_CAPABILITIES];
		clientPolicies.clear();
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

	it.each(CAPABILITY_CASES.map((testCase, index) => ({ ...testCase, index })))(
		'exposes the exact catalog for module capability set $capabilities',
		async ({ capabilities, expectedTools, index }) => {
			const clientId = `module-matrix-${index}`;

			moduleCapabilities = [...capabilities];
			clientPolicies.set(clientId, { capabilities: [...ALL_CAPABILITIES] });
			const { client, transport } = createClient(clientId, 'auto');

			try {
				await client.connect(transport);

				const tools = await client.listTools();
				const resources = await client.listResources();

				expect(tools.tools.map(({ name }) => name)).toEqual(expectedTools);
				expect(resources.resources.length > 0).toBe(capabilities.includes(McpCapability.READ));
			} finally {
				await client.close();
			}
		},
	);

	it.each([
		{
			module: [McpCapability.READ, McpCapability.WRITE],
			client: [McpCapability.WRITE, McpCapability.TRIGGER],
			expected: [McpCapability.WRITE],
		},
		{
			module: [McpCapability.READ, McpCapability.TRIGGER],
			client: [McpCapability.READ, McpCapability.WRITE],
			expected: [McpCapability.READ],
		},
		{
			module: [McpCapability.WRITE, McpCapability.TRIGGER],
			client: [McpCapability.TRIGGER],
			expected: [McpCapability.TRIGGER],
		},
		{ module: [...ALL_CAPABILITIES], client: [], expected: [] },
	])(
		'intersects module $module with client $client before discovery',
		async ({ module, client: clientCapabilities, expected }) => {
			const clientId = `intersection-${module.join('-')}-${clientCapabilities.join('-') || 'none'}`;

			moduleCapabilities = [...module];
			clientPolicies.set(clientId, { capabilities: [...clientCapabilities] });
			const { client, transport } = createClient(clientId, 'auto');

			try {
				await client.connect(transport);
				const tools = await client.listTools();
				const resources = await client.listResources();

				expect(tools.tools.map(({ name }) => name)).toEqual(expectedCatalogTools(expected));
				expect(resources.resources.length > 0).toBe(expected.includes(McpCapability.READ));
			} finally {
				await client.close();
			}
		},
	);

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
		clientPolicies.set('client-a', { capabilities: [McpCapability.READ] });
		clientPolicies.set('client-b', { capabilities: [McpCapability.TRIGGER] });
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
			const [firstTools, secondTools] = await Promise.all([first.client.listTools(), second.client.listTools()]);
			const firstSubscription = await first.client.listen({ toolsListChanged: true });
			const secondSubscription = await second.client.listen({ toolsListChanged: true });

			expect(firstTools.tools.map(({ name }) => name)).toEqual(READ_TOOLS);
			expect(secondTools.tools.map(({ name }) => name)).toEqual(TRIGGER_TOOLS);
			expect(first.client.getInstructions()).toContain('Client Test client-a. Effective capabilities: read.');
			expect(second.client.getInstructions()).toContain('Client Test client-b. Effective capabilities: trigger.');

			expect(subscriptions.countForClient('client-a')).toBe(1);
			expect(subscriptions.countForClient('client-b')).toBe(1);

			serverService.notifyToolsChanged('client-a');

			await expect(
				Promise.race([notification, rejectAfter(2_000, 'Timed out waiting for tools/list_changed')]),
			).resolves.toBeUndefined();

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

	it('applies a permission reduction and notifies a client that remains connected', async () => {
		const clientId = 'mutable-client';

		clientPolicies.set(clientId, { capabilities: [...ALL_CAPABILITIES] });
		const connection = createClient(clientId, 'auto');
		let resolveNotification!: () => void;
		const notification = new Promise<void>((resolve) => {
			resolveNotification = resolve;
		});

		connection.client.setNotificationHandler('notifications/tools/list_changed', () => resolveNotification());

		try {
			await connection.client.connect(connection.transport);
			const subscription = await connection.client.listen({ toolsListChanged: true });

			expect((await connection.client.listTools()).tools.map(({ name }) => name)).toEqual(
				expectedCatalogTools(ALL_CAPABILITIES),
			);

			await clientsService.update(clientId, { capabilities: [McpCapability.READ] });

			await expect(
				Promise.race([notification, rejectAfter(2_000, 'Timed out waiting for tools/list_changed')]),
			).resolves.toBeUndefined();
			expect((await connection.client.listTools()).tools.map(({ name }) => name)).toEqual(READ_TOOLS);
			expect(subscriptions.countForClient(clientId)).toBe(1);

			await subscription.close();
		} finally {
			await connection.client.close();
		}
	});

	it('closes only the revoked client and rejects its next request', async () => {
		const revokedId = 'revoked-client';
		const activeId = 'active-client';

		clientPolicies.set(revokedId, { capabilities: [McpCapability.READ] });
		clientPolicies.set(activeId, { capabilities: [McpCapability.READ] });
		const revoked = createClient(revokedId, 'auto');
		const active = createClient(activeId, 'auto');

		try {
			await revoked.client.connect(revoked.transport);
			await active.client.connect(active.transport);
			const revokedSubscription = await revoked.client.listen({ toolsListChanged: true });
			const activeSubscription = await active.client.listen({ toolsListChanged: true });

			await clientsService.revoke(revokedId);

			await expect(revokedSubscription.closed).resolves.toBe('remote');
			await expect(revoked.client.listTools()).rejects.toThrow();
			expect((await active.client.listTools()).tools.map(({ name }) => name)).toEqual(READ_TOOLS);
			expect(subscriptions.countForClient(activeId)).toBe(1);

			await activeSubscription.close();
		} finally {
			await revoked.client.close();
			await active.client.close();
		}
	});

	function createClient(name: string, mode?: 'auto') {
		const client = new Client({ name, version: '1.0.0' }, mode ? { versionNegotiation: { mode } } : undefined);
		const transport = new StreamableHTTPClientTransport(endpoint, {
			requestInit: { headers: { Authorization: `Bearer ${name}` } },
		});

		return { client, transport };
	}

	function toClientEntity(clientId: string): McpClientEntity | null {
		const policy = clientPolicies.get(clientId);

		if (!policy) {
			return null;
		}

		return {
			id: clientId,
			name: `Test ${clientId}`,
			description: null,
			enabled: !policy.revoked,
			capabilities: [...policy.capabilities],
			createdById: null,
			tokenId: `token-${clientId}`,
			token: {
				id: `token-${clientId}`,
				revoked: Boolean(policy.revoked),
				expiresAt: new Date(Date.now() + 60_000),
			},
		} as McpClientEntity;
	}

	function timeout(milliseconds: number): Promise<void> {
		return new Promise((resolve) => {
			const timer = setTimeout(resolve, milliseconds);
			timer.unref();
		});
	}

	function rejectAfter(milliseconds: number, message: string): Promise<never> {
		return new Promise((_, reject) => {
			const timer = setTimeout(() => reject(new Error(message)), milliseconds);
			timer.unref();
		});
	}

	function expectedCatalogTools(capabilities: readonly string[]): string[] {
		return [
			...(capabilities.includes(McpCapability.READ) ? READ_TOOLS : []),
			...(capabilities.includes(McpCapability.WRITE) ? WRITE_TOOLS : []),
			...(capabilities.includes(McpCapability.TRIGGER) ? TRIGGER_TOOLS : []),
		];
	}
});
