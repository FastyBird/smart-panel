import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { AuthInfo } from '@modelcontextprotocol/server';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { OpenApiResponseInterceptor } from '../src/modules/api/interceptors/open-api-response.interceptor';
import { TransformResponseInterceptor } from '../src/modules/api/interceptors/transform-response.interceptor';
import { PermissionType } from '../src/modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity } from '../src/modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../src/modules/devices/services/channels.properties.service';
import { DeviceConnectionStateService } from '../src/modules/devices/services/device-connection-state.service';
import { DeviceControlToolService } from '../src/modules/devices/services/device-control-tool.service';
import { PlatformRegistryService } from '../src/modules/devices/services/platform.registry.service';
import { PropertyCommandService } from '../src/modules/devices/services/property-command.service';
import { McpController } from '../src/modules/mcp/controllers/mcp.controller';
import { McpClientEntity } from '../src/modules/mcp/entities/mcp-client.entity';
import { McpClientGuard } from '../src/modules/mcp/guards/mcp-client.guard';
import { MCP_CATALOG_REGISTRAR, McpCapability } from '../src/modules/mcp/mcp.constants';
import { McpConfigModel } from '../src/modules/mcp/models/config.model';
import { McpAuditService } from '../src/modules/mcp/services/mcp-audit.service';
import { McpContextService } from '../src/modules/mcp/services/mcp-context.service';
import { McpOAuthResourceServerService } from '../src/modules/mcp/services/mcp-oauth-resource-server.service';
import { McpPolicyService } from '../src/modules/mcp/services/mcp-policy.service';
import { McpPolicyRequest } from '../src/modules/mcp/services/mcp-policy.service';
import { McpServerService } from '../src/modules/mcp/services/mcp-server.service';
import { McpSubscriptionRegistryService } from '../src/modules/mcp/services/mcp-subscription-registry.service';
import { McpTargetDiscoveryToolService } from '../src/modules/mcp/tools/mcp-target-discovery-tool.service';
import { SceneExecutorService } from '../src/modules/scenes/services/scene-executor.service';
import { SceneToolService } from '../src/modules/scenes/services/scene-tool.service';
import { ScenesService } from '../src/modules/scenes/services/scenes.service';
import { SpacesService } from '../src/modules/spaces/services/spaces.service';
import { ToolAudience } from '../src/modules/tools/platforms/tool-provider.platform';
import { ShortIdMappingService } from '../src/modules/tools/services/short-id-mapping.service';
import { ToolProviderRegistryService } from '../src/modules/tools/services/tool-provider-registry.service';
import { SimulatorDeviceEntity } from '../src/plugins/simulator/entities/simulator.entity';
import { SimulatorDevicePlatform } from '../src/plugins/simulator/platforms/simulator-device.platform';
import { DeviceBehaviorManagerService } from '../src/plugins/simulator/services/device-behavior-manager.service';
import { SIMULATOR_TYPE } from '../src/plugins/simulator/simulator.constants';
import { SpaceLightingToolService } from '../src/plugins/spaces-home-control/services/space-lighting-tool.service';

const CLIENT_ID = 'simulator-client';
const PROPERTY_ID = '10000000-0000-4000-8000-000000000001';
const CHANNEL_ID = '20000000-0000-4000-8000-000000000001';
const DEVICE_ID = '30000000-0000-4000-8000-000000000001';
const SCENE_ID = '40000000-0000-4000-8000-000000000001';
const SPACE_ID = '50000000-0000-4000-8000-000000000001';
const ALL_CAPABILITIES = [McpCapability.WRITE, McpCapability.TRIGGER];
let runtimeCapabilities = [...ALL_CAPABILITIES];

interface Deferred {
	promise: Promise<void>;
	resolve: () => void;
}

let authorizationStartedSignal: Deferred | null = null;
let policyChangeGate: Deferred | null = null;

@Injectable()
class TestOperationsGuard implements CanActivate {
	constructor(private readonly serverService: McpServerService) {}

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<McpPolicyRequest>();
		const client = {
			id: CLIENT_ID,
			name: 'Simulator MCP client',
			enabled: true,
			capabilities: [...ALL_CAPABILITIES],
			tokenId: 'simulator-token-id',
			token: {
				id: 'simulator-token-id',
				revoked: false,
				expiresAt: new Date(Date.now() + 60_000),
			},
		} as McpClientEntity;

		request.mcpPolicy = {
			client,
			clientPolicyRevision: this.serverService.getClientPolicyRevision(client.id),
			config: Object.assign(new McpConfigModel(), { enabled: true, capabilities: [...ALL_CAPABILITIES] }),
			effectiveCapabilities: [...ALL_CAPABILITIES],
			installationId: 'simulator-installation',
			policyRevision: this.serverService.getPolicyRevision(),
			tokenId: client.tokenId,
		};

		return true;
	}
}

describe('MCP simulator operations', () => {
	let app: NestFastifyApplication;
	let endpoint: URL;
	let serverService: McpServerService;
	let channelsPropertiesService: { findOne: jest.Mock; findWritableCandidates: jest.Mock; update: jest.Mock };
	let propertyCommandService: { executePropertyCommandById: jest.Mock };
	let behaviorManager: { handlePropertyChange: jest.Mock };
	let sceneExecutor: { triggerScene: jest.Mock };
	let spaceIntentService: { executeLightingIntent: jest.Mock };
	let simulatorProperty: ChannelPropertyEntity;

	beforeAll(async () => {
		const simulatorDevice = {
			id: DEVICE_ID,
			name: 'Simulator outlet',
			type: SIMULATOR_TYPE,
			enabled: true,
			hidden: false,
		} as SimulatorDeviceEntity;
		const simulatorChannel = {
			id: CHANNEL_ID,
			name: 'Simulator outlet channel',
			category: 'outlet',
			device: simulatorDevice,
		} as unknown as ChannelEntity;

		simulatorProperty = {
			id: PROPERTY_ID,
			name: 'On',
			type: SIMULATOR_TYPE,
			category: 'on',
			permissions: [PermissionType.READ_WRITE],
			dataType: 'bool',
			value: { value: false },
			channel: simulatorChannel,
		} as ChannelPropertyEntity;
		channelsPropertiesService = {
			findOne: jest.fn().mockResolvedValue(simulatorProperty),
			findWritableCandidates: jest.fn().mockResolvedValue({ properties: [simulatorProperty], total: 1 }),
			update: jest.fn().mockImplementation((_id: string, dto: { value: unknown }) => {
				simulatorProperty.value = { value: dto.value } as ChannelPropertyEntity['value'];

				return Promise.resolve();
			}),
		};
		behaviorManager = { handlePropertyChange: jest.fn() };
		const simulatorPlatform = new SimulatorDevicePlatform(
			channelsPropertiesService as unknown as ChannelsPropertiesService,
			behaviorManager as unknown as DeviceBehaviorManagerService,
		);
		propertyCommandService = {
			executePropertyCommandById: jest
				.fn()
				.mockImplementation(async (propertyId: string, value: string | number | boolean) => ({
					device: DEVICE_ID,
					deviceName: simulatorDevice.name,
					channel: CHANNEL_ID,
					property: PROPERTY_ID,
					value,
					success:
						propertyId === PROPERTY_ID &&
						(await simulatorPlatform.process({
							device: simulatorDevice,
							channel: simulatorChannel,
							property: simulatorProperty,
							value,
						})),
				})),
		};
		const scenesService = {
			findOne: jest.fn().mockResolvedValue({ id: SCENE_ID, name: 'Simulator evening', enabled: true }),
			findTriggerableSummaryPage: jest.fn().mockResolvedValue({
				scenes: [
					{
						id: SCENE_ID,
						name: 'Simulator evening',
						category: 'generic',
						primarySpaceId: SPACE_ID,
						enabled: true,
						triggerable: true,
					},
				],
				total: 1,
			}),
		};
		sceneExecutor = {
			triggerScene: jest.fn().mockResolvedValue({ status: 'completed', successfulActions: 1, totalActions: 1 }),
		};
		const spacesService = {
			findOne: jest.fn().mockResolvedValue({ id: SPACE_ID, name: 'Simulator living room' }),
			findLightingTriggerSummaryPage: jest.fn().mockResolvedValue({
				spaces: [{ id: SPACE_ID, name: 'Simulator living room', type: 'room' }],
				total: 1,
			}),
		};
		spaceIntentService = {
			executeLightingIntent: jest
				.fn()
				.mockResolvedValue({ success: true, affectedDevices: 1, failedDevices: 0, skippedOfflineDevices: 0 }),
		};
		const shortIds = new ShortIdMappingService();
		const deviceProvider = new DeviceControlToolService(
			propertyCommandService as unknown as PropertyCommandService,
			shortIds,
		);
		const sceneProvider = new SceneToolService(
			scenesService as unknown as ScenesService,
			sceneExecutor as unknown as SceneExecutorService,
			shortIds,
		);
		const lightingProvider = new SpaceLightingToolService(
			spacesService as unknown as SpacesService,
			{ get: jest.fn().mockReturnValue(spaceIntentService) } as never,
			shortIds,
		);

		await lightingProvider.onModuleInit();

		const toolRegistry = new ToolProviderRegistryService();

		toolRegistry.register(deviceProvider);
		toolRegistry.register(sceneProvider);
		toolRegistry.register(lightingProvider);

		const contextService = {
			getInstallation: jest.fn().mockImplementation((capabilities: McpCapability[], endpointUrl?: string) => ({
				id: 'simulator-installation',
				name: 'MCP E2E Simulator',
				version: '1.0.0',
				timezone: 'UTC',
				endpoint: endpointUrl ?? null,
				effective_capabilities: [...capabilities],
			})),
		};
		const policyService = {
			authorizeAuthInfo: jest.fn().mockImplementation(async (authInfo: AuthInfo, capability: McpCapability) => {
				authorizationStartedSignal?.resolve();

				if (policyChangeGate !== null) {
					await policyChangeGate.promise;
				}

				if (!runtimeCapabilities.includes(capability)) {
					throw new ForbiddenException(`MCP capability '${capability}' is not granted`);
				}

				return { client: { id: authInfo.clientId }, effectiveCapabilities: [...runtimeCapabilities] };
			}),
		};
		const auditService = new McpAuditService();
		const targetTools = new McpTargetDiscoveryToolService(
			channelsPropertiesService as unknown as ChannelsPropertiesService,
			{ readLatestMany: jest.fn().mockResolvedValue(new Map()) } as unknown as DeviceConnectionStateService,
			{ get: jest.fn().mockReturnValue(simulatorPlatform) } as unknown as PlatformRegistryService,
			scenesService as unknown as ScenesService,
			spacesService as unknown as SpacesService,
			toolRegistry,
			contextService as unknown as McpContextService,
			policyService as unknown as McpPolicyService,
			auditService,
		);
		const moduleRef = await Test.createTestingModule({
			controllers: [McpController],
			providers: [
				{ provide: McpAuditService, useValue: auditService },
				{ provide: McpOAuthResourceServerService, useValue: { verifyAccessToken: jest.fn() } },
				McpServerService,
				McpSubscriptionRegistryService,
				{ provide: MCP_CATALOG_REGISTRAR, useValue: targetTools },
			],
		})
			.overrideGuard(McpClientGuard)
			.useClass(TestOperationsGuard)
			.compile();

		app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		const reflector = app.get(Reflector);

		app.useGlobalInterceptors(new OpenApiResponseInterceptor(reflector), new TransformResponseInterceptor(reflector));
		await app.listen(0, '127.0.0.1');

		serverService = app.get(McpServerService);
		endpoint = new URL('/', await app.getUrl());
	}, 30_000);

	afterAll(async () => {
		await serverService.closeAll();
		await app.close();
	});

	it('executes write and trigger tools against the simulator with MCP traces', async () => {
		const client = new Client(
			{ name: 'simulator-e2e-client', version: '1.0.0' },
			{ versionNegotiation: { mode: 'auto' } },
		);
		const transport = new StreamableHTTPClientTransport(endpoint, {
			requestInit: { headers: { Authorization: `Bearer ${CLIENT_ID}` } },
		});

		try {
			await client.connect(transport);

			const tools = await client.listTools();
			const writeResult = await client.callTool({
				name: 'set_device_property',
				arguments: { property_id: PROPERTY_ID, value: true },
			});
			const sceneResult = await client.callTool({ name: 'run_scene', arguments: { scene_id: SCENE_ID } });
			const lightingResult = await client.callTool({
				name: 'set_space_lighting',
				arguments: { space_id: SPACE_ID, mode: 'relax' },
			});

			expect(tools.tools.map(({ name }) => name)).toEqual([
				'list_writable_properties',
				'set_device_property',
				'list_trigger_targets',
				'run_scene',
				'set_space_lighting',
			]);
			expect(writeResult.isError).not.toBe(true);
			expect(sceneResult.isError).not.toBe(true);
			expect(lightingResult.isError).not.toBe(true);
			expect(channelsPropertiesService.update).toHaveBeenCalledWith(
				PROPERTY_ID,
				expect.objectContaining({ type: SIMULATOR_TYPE, value: true }),
			);
			expect(behaviorManager.handlePropertyChange).toHaveBeenCalled();

			const propertyTrace = propertyCommandService.executePropertyCommandById.mock.calls[0] as unknown as [
				string,
				unknown,
				{ requestId: string; context: { origin: string; extra: Record<string, unknown> } },
			];

			expect(propertyTrace[2]).toMatchObject({
				context: { origin: 'api', extra: { source: 'mcp', audience: ToolAudience.MCP, actorId: CLIENT_ID } },
			});
			const sceneTrace = sceneExecutor.triggerScene.mock.calls[0] as unknown as [
				string,
				string,
				{ origin: string; extra: Record<string, unknown> },
			];
			const lightingTrace = spaceIntentService.executeLightingIntent.mock.calls[0] as unknown as [
				string,
				{ type: string; mode?: string },
				{ origin: string; extra: Record<string, unknown> },
			];

			expect(sceneTrace[0]).toBe(SCENE_ID);
			expect(sceneTrace[1]).toBe('mcp');
			expect(sceneTrace[2]).toMatchObject({
				origin: 'api',
				extra: { source: 'mcp', audience: ToolAudience.MCP, actorId: CLIENT_ID },
			});
			expect(lightingTrace[0]).toBe(SPACE_ID);
			expect(lightingTrace[1]).toMatchObject({ type: 'set_mode', mode: 'relax' });
			expect(lightingTrace[2]).toMatchObject({
				origin: 'api',
				extra: { source: 'mcp', audience: ToolAudience.MCP, actorId: CLIENT_ID },
			});
		} finally {
			await client.close();
		}
	});

	it('rejects an in-flight tool call when its advertised capability is reduced before authorization', async () => {
		const client = new Client(
			{ name: 'simulator-policy-client', version: '1.0.0' },
			{ versionNegotiation: { mode: 'auto' } },
		);
		const transport = new StreamableHTTPClientTransport(endpoint, {
			requestInit: { headers: { Authorization: `Bearer ${CLIENT_ID}` } },
		});
		const authorizationStarted = createDeferred();
		const authorizationGate = createDeferred();

		try {
			runtimeCapabilities = [...ALL_CAPABILITIES];
			await client.connect(transport);
			expect((await client.listTools()).tools.map(({ name }) => name)).toContain('set_device_property');

			propertyCommandService.executePropertyCommandById.mockClear();
			authorizationStartedSignal = authorizationStarted;
			policyChangeGate = authorizationGate;
			const resultPromise = client.callTool({
				name: 'set_device_property',
				arguments: { property_id: PROPERTY_ID, value: false },
			});

			await expect(
				Promise.race([authorizationStarted.promise, rejectAfter(2_000, 'Timed out waiting for tool authorization')]),
			).resolves.toBeUndefined();
			runtimeCapabilities = [McpCapability.TRIGGER];
			authorizationGate.resolve();
			const result = await resultPromise;

			expect(result.isError).toBe(true);
			const structuredContent = result.structuredContent as {
				error?: { code?: string };
				tool?: string;
			};

			expect(structuredContent.tool).toBe('set_device_property');
			expect(structuredContent.error?.code).toBe('permission_denied');
			expect(propertyCommandService.executePropertyCommandById).not.toHaveBeenCalled();
		} finally {
			authorizationGate.resolve();
			authorizationStartedSignal = null;
			policyChangeGate = null;
			runtimeCapabilities = [...ALL_CAPABILITIES];
			await client.close();
		}
	});

	function rejectAfter(milliseconds: number, message: string): Promise<never> {
		return new Promise((_, reject) => {
			const timer = setTimeout(() => reject(new Error(message)), milliseconds);
			timer.unref();
		});
	}

	function createDeferred(): Deferred {
		let resolve!: () => void;
		const promise = new Promise<void>((deferredResolve) => {
			resolve = deferredResolve;
		});

		return { promise, resolve };
	}
});
