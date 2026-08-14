import { AuthInfo, McpServer, ServerContext } from '@modelcontextprotocol/server';
import { UnauthorizedException } from '@nestjs/common';

import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../devices/devices.constants';
import { ChannelPropertyEntity } from '../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { DeviceConnectionStateService } from '../../devices/services/device-connection-state.service';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { SceneEntity } from '../../scenes/entities/scenes.entity';
import { SceneCategory } from '../../scenes/scenes.constants';
import { ScenesService } from '../../scenes/services/scenes.service';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { SpacesService } from '../../spaces/services/spaces.service';
import { SpaceType } from '../../spaces/spaces.constants';
import { ToolAccessKind, ToolAudience, ToolExecutionStatus } from '../../tools/platforms/tool-provider.platform';
import { ToolProviderRegistryService } from '../../tools/services/tool-provider-registry.service';
import { MCP_MAX_WRITABLE_PROPERTY_CANDIDATES, MCP_TOOL_CALL_TIMEOUT_MS, McpCapability } from '../mcp.constants';
import { McpEndpointDisabledException } from '../mcp.exceptions';
import { McpAuditService } from '../services/mcp-audit.service';
import { McpContextService } from '../services/mcp-context.service';
import { McpPolicyService } from '../services/mcp-policy.service';

import { McpTargetDiscoveryToolService } from './mcp-target-discovery-tool.service';

type ToolCallback = (
	args: Record<string, unknown>,
	ctx: ServerContext,
) => Promise<{ isError?: boolean; structuredContent: Record<string, unknown> }>;

describe('McpTargetDiscoveryToolService', () => {
	let service: McpTargetDiscoveryToolService;
	let channelsPropertiesService: { findOne: jest.Mock; findWritableCandidates: jest.Mock };
	let deviceConnectionStateService: { readLatestMany: jest.Mock };
	let platformRegistryService: { get: jest.Mock };
	let scenesService: { findTriggerableSummaryPage: jest.Mock };
	let spacesService: { findLightingTriggerSummaryPage: jest.Mock };
	let toolRegistry: { getAllToolDefinitions: jest.Mock; executeTool: jest.Mock };
	let contextService: { getInstallation: jest.Mock };
	let policyService: { authorizeAuthInfo: jest.Mock };
	let auditService: { getRequestId: jest.Mock; recordPolicyDenial: jest.Mock; recordToolResult: jest.Mock };
	let registerTool: jest.Mock;
	let callbacks: Map<string, ToolCallback>;
	let providerTools: Array<{ name: string; audiences: ToolAudience[]; access: ToolAccessKind }>;

	beforeEach(() => {
		channelsPropertiesService = {
			findOne: jest.fn(),
			findWritableCandidates: jest.fn().mockResolvedValue({ properties: [], total: 0 }),
		};
		deviceConnectionStateService = {
			readLatestMany: jest.fn().mockResolvedValue(new Map()),
		};
		platformRegistryService = {
			get: jest.fn().mockReturnValue({}),
		};
		scenesService = {
			findTriggerableSummaryPage: jest.fn().mockResolvedValue({ scenes: [], total: 0 }),
		};
		spacesService = {
			findLightingTriggerSummaryPage: jest.fn().mockResolvedValue({ spaces: [], total: 0 }),
		};
		providerTools = [];
		toolRegistry = {
			getAllToolDefinitions: jest.fn().mockImplementation(() => providerTools),
			executeTool: jest.fn(),
		};
		contextService = {
			getInstallation: jest.fn().mockResolvedValue({
				id: 'installation-id',
				name: 'FastyBird Smart Panel',
				version: '1.0.0',
				timezone: 'UTC',
				endpoint: 'https://panel.test/api/v1/modules/mcp',
				effective_capabilities: [],
			}),
		};
		policyService = {
			authorizeAuthInfo: jest.fn().mockImplementation((_authInfo, capability: McpCapability) =>
				Promise.resolve({
					client: { id: 'client-id' },
					effectiveCapabilities: [capability],
				}),
			),
		};
		auditService = {
			getRequestId: jest.fn().mockReturnValue('17'),
			recordPolicyDenial: jest.fn(),
			recordToolResult: jest.fn(),
		};
		callbacks = new Map();
		registerTool = jest.fn((name: string, _config: unknown, callback: ToolCallback) => {
			callbacks.set(name, callback);
		});
		service = new McpTargetDiscoveryToolService(
			channelsPropertiesService as unknown as ChannelsPropertiesService,
			deviceConnectionStateService as unknown as DeviceConnectionStateService,
			platformRegistryService as unknown as PlatformRegistryService,
			scenesService as unknown as ScenesService,
			spacesService as unknown as SpacesService,
			toolRegistry as unknown as ToolProviderRegistryService,
			contextService as unknown as McpContextService,
			policyService as unknown as McpPolicyService,
			auditService as unknown as McpAuditService,
		);
	});

	it('registers no tools without write or trigger capability', () => {
		service.register(server(), authInfo([]));

		expect(registerTool).not.toHaveBeenCalled();
	});

	it('lets a write-only client discover only actionable writable properties', async () => {
		providerTools = [providerTool('control_device', ToolAccessKind.WRITE)];
		const connected = property('10000000-0000-4000-8000-000000000001', PermissionType.READ_WRITE);
		connected.category = PropertyCategory.TEMPERATURE;
		connected.dataType = DataTypeType.FLOAT;
		(connected.channel as { category: ChannelCategory }).category = ChannelCategory.TEMPERATURE;
		const disconnected = property('10000000-0000-4000-8000-000000000002', PermissionType.WRITE_ONLY);
		const readOnly = property('10000000-0000-4000-8000-000000000003', PermissionType.READ_ONLY);
		channelsPropertiesService.findWritableCandidates.mockResolvedValue({
			properties: [connected, disconnected, readOnly],
			total: 3,
		});
		deviceConnectionStateService.readLatestMany.mockResolvedValue(
			new Map([
				[deviceId(connected), { online: true, status: ConnectionState.CONNECTED, lastChanged: new Date() }],
				[deviceId(disconnected), { online: false, status: ConnectionState.DISCONNECTED, lastChanged: new Date() }],
				[deviceId(readOnly), { online: true, status: ConnectionState.CONNECTED, lastChanged: new Date() }],
			]),
		);
		service.register(server(), authInfo([McpCapability.WRITE]));

		expect([...callbacks.keys()]).toEqual(['list_writable_properties', 'set_device_property']);
		const result = await callbacks.get('list_writable_properties')?.({}, requestContext([McpCapability.WRITE]));
		const data = result?.structuredContent.data as { properties: Array<Record<string, unknown>> };

		expect(policyService.authorizeAuthInfo).toHaveBeenCalledWith(
			expect.objectContaining({ clientId: 'client-id', token: 'raw-token' }),
			McpCapability.WRITE,
		);
		expect(data.properties).toEqual([
			expect.objectContaining({
				property_id: connected.id,
				device_id: deviceId(connected),
				data_type: DataTypeType.FLOAT,
				unit: '°C',
			}),
		]);
		expect(data.properties[0]).not.toHaveProperty('value');
		expect(scenesService.findTriggerableSummaryPage).not.toHaveBeenCalled();
	});

	it('lets a trigger-only client discover enabled scenes and lighting-capable spaces', async () => {
		providerTools = [
			providerTool('run_scene', ToolAccessKind.TRIGGER),
			providerTool('set_space_lighting', ToolAccessKind.TRIGGER),
		];
		scenesService.findTriggerableSummaryPage.mockResolvedValue({
			scenes: [scene(true), scene(false)],
			total: 2,
		});
		spacesService.findLightingTriggerSummaryPage.mockResolvedValue({
			spaces: [space()],
			total: 1,
		});
		service.register(server(), authInfo([McpCapability.TRIGGER]));

		expect([...callbacks.keys()]).toEqual(['list_trigger_targets', 'run_scene', 'set_space_lighting']);
		const result = await callbacks.get('list_trigger_targets')?.({}, requestContext([McpCapability.TRIGGER]));
		const data = result?.structuredContent.data as {
			scenes: Array<Record<string, unknown>>;
			spaces: Array<Record<string, unknown>>;
		};

		expect(data.scenes).toHaveLength(1);
		expect(data.spaces).toEqual([expect.objectContaining({ modes: ['off', 'on', 'work', 'relax', 'night'] })]);
		expect(channelsPropertiesService.findWritableCandidates).not.toHaveBeenCalled();
	});

	it('does not advertise or control writable properties without a registered device platform', async () => {
		providerTools = [providerTool('control_device', ToolAccessKind.WRITE)];
		const target = property('10000000-0000-4000-8000-000000000001', PermissionType.READ_WRITE);
		channelsPropertiesService.findWritableCandidates.mockResolvedValue({ properties: [target], total: 1 });
		channelsPropertiesService.findOne.mockResolvedValue(target);
		platformRegistryService.get.mockReturnValue(null);
		service.register(server(), authInfo([McpCapability.WRITE]));

		const discoveryResult = await callbacks.get('list_writable_properties')?.(
			{},
			requestContext([McpCapability.WRITE]),
		);
		const discoveryData = discoveryResult?.structuredContent.data as { properties: unknown[] };
		const writeResult = await callbacks.get('set_device_property')?.(
			{ property_id: target.id, value: true },
			requestContext([McpCapability.WRITE]),
		);

		expect(discoveryData.properties).toEqual([]);
		expect(deviceConnectionStateService.readLatestMany).toHaveBeenCalledWith([]);
		expect(writeResult?.isError).toBe(true);
		expect(writeResult?.structuredContent.error).toEqual(expect.objectContaining({ code: 'not_found' }));
		expect(toolRegistry.executeTool).not.toHaveBeenCalled();
	});

	it('pages past filtered writable candidates to find later actionable properties', async () => {
		providerTools = [providerTool('control_device', ToolAccessKind.WRITE)];
		const offline = Array.from({ length: MCP_MAX_WRITABLE_PROPERTY_CANDIDATES }, (_, index) => {
			const target = property(
				`10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
				PermissionType.READ_WRITE,
			);
			(target.channel as { device: { id: string } }).device.id =
				`30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;

			return target;
		});
		const connected = property('10000000-0000-4000-8000-999999999999', PermissionType.READ_WRITE);
		channelsPropertiesService.findWritableCandidates
			.mockResolvedValueOnce({ properties: offline, total: offline.length + 1 })
			.mockResolvedValueOnce({ properties: [connected], total: offline.length + 1 });
		deviceConnectionStateService.readLatestMany
			.mockResolvedValueOnce(
				new Map(
					offline.map((target) => [
						deviceId(target),
						{ online: false, status: ConnectionState.DISCONNECTED, lastChanged: new Date() },
					]),
				),
			)
			.mockResolvedValueOnce(
				new Map([[deviceId(connected), { online: true, status: ConnectionState.CONNECTED, lastChanged: new Date() }]]),
			);
		service.register(server(), authInfo([McpCapability.WRITE]));

		const result = await callbacks.get('list_writable_properties')?.({}, requestContext([McpCapability.WRITE]));
		const data = result?.structuredContent.data as { properties: Array<{ property_id: string }>; truncated: boolean };

		expect(channelsPropertiesService.findWritableCandidates).toHaveBeenNthCalledWith(
			1,
			MCP_MAX_WRITABLE_PROPERTY_CANDIDATES,
			0,
		);
		expect(channelsPropertiesService.findWritableCandidates).toHaveBeenNthCalledWith(
			2,
			MCP_MAX_WRITABLE_PROPERTY_CANDIDATES,
			MCP_MAX_WRITABLE_PROPERTY_CANDIDATES,
		);
		expect(data.properties).toEqual([expect.objectContaining({ property_id: connected.id })]);
		expect(data.truncated).toBe(false);
	});

	it('returns all 100 actionable writable properties without marking the discovery result as truncated', async () => {
		const targets = writableProperties(100);
		channelsPropertiesService.findWritableCandidates.mockResolvedValue({
			properties: targets,
			total: 100,
		});
		service.register(server(), authInfo([McpCapability.WRITE]));

		const result = await callbacks.get('list_writable_properties')?.({}, requestContext([McpCapability.WRITE]));
		const data = result?.structuredContent.data as { properties: Array<{ property_id: string }>; truncated: boolean };

		expect(data.properties).toHaveLength(100);
		expect(data.properties[0]?.property_id).toBe(targets[0]?.id);
		expect(data.properties[99]?.property_id).toBe(targets[99]?.id);
		expect(data.truncated).toBe(false);
	});

	it('returns only 100 of 101 actionable writable properties and marks the discovery result as truncated', async () => {
		const targets = writableProperties(101);
		channelsPropertiesService.findWritableCandidates.mockResolvedValue({
			properties: targets,
			total: 101,
		});
		service.register(server(), authInfo([McpCapability.WRITE]));

		const result = await callbacks.get('list_writable_properties')?.({}, requestContext([McpCapability.WRITE]));
		const data = result?.structuredContent.data as { properties: Array<{ property_id: string }>; truncated: boolean };

		expect(data.properties).toHaveLength(100);
		expect(data.properties[0]?.property_id).toBe(targets[0]?.id);
		expect(data.properties[99]?.property_id).toBe(targets[99]?.id);
		expect(data.properties).not.toContainEqual(expect.objectContaining({ property_id: targets[100]?.id }));
		expect(data.truncated).toBe(true);
	});

	it('omits space targets and the lighting tool when the optional provider is absent', async () => {
		providerTools = [providerTool('run_scene', ToolAccessKind.TRIGGER)];
		service.register(server(), authInfo([McpCapability.TRIGGER]));

		expect([...callbacks.keys()]).toEqual(['list_trigger_targets', 'run_scene']);
		const result = await callbacks.get('list_trigger_targets')?.({}, requestContext([McpCapability.TRIGGER]));
		const data = result?.structuredContent.data as { spaces: unknown[] };

		expect(data.spaces).toEqual([]);
		expect(spacesService.findLightingTriggerSummaryPage).not.toHaveBeenCalled();
	});

	it('adapts the public set_device_property name to the shared write provider', async () => {
		providerTools = [providerTool('control_device', ToolAccessKind.WRITE)];
		channelsPropertiesService.findOne.mockResolvedValue(
			property('10000000-0000-4000-8000-000000000001', PermissionType.READ_WRITE),
		);
		toolRegistry.executeTool.mockResolvedValue({
			success: true,
			status: ToolExecutionStatus.COMPLETED,
			message: 'Property updated',
			data: { property_id: '10000000-0000-4000-8000-000000000001', value: true },
		});
		service.register(server(), authInfo([McpCapability.WRITE]));

		const result = await callbacks.get('set_device_property')?.(
			{ property_id: '10000000-0000-4000-8000-000000000001', value: true },
			requestContext([McpCapability.WRITE]),
		);

		expect(toolRegistry.executeTool).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'control_device' }),
			expect.objectContaining({
				audience: ToolAudience.MCP,
				actorId: 'client-id',
				allowedAccessKinds: [ToolAccessKind.WRITE],
			}),
		);
		expect(result?.isError).toBeUndefined();
		expect(result?.structuredContent.tool).toBe('set_device_property');
		expect(auditService.recordToolResult).toHaveBeenCalledWith(
			expect.objectContaining({
				tool: 'set_device_property',
				capability: McpCapability.WRITE,
				outcome: 'completed',
				arguments: {
					property_id: '10000000-0000-4000-8000-000000000001',
					value: true,
				},
			}),
		);
	});

	it('waits for an authoritative provider result after a side effect has started', async () => {
		jest.useFakeTimers();

		try {
			providerTools = [providerTool('control_device', ToolAccessKind.WRITE)];
			const target = property('10000000-0000-4000-8000-000000000001', PermissionType.READ_WRITE);
			channelsPropertiesService.findOne.mockResolvedValue(target);
			let resolveExecution: (result: {
				success: boolean;
				status: ToolExecutionStatus;
				message: string;
				data: Record<string, unknown>;
			}) => void = () => undefined;
			const execution = new Promise<{
				success: boolean;
				status: ToolExecutionStatus;
				message: string;
				data: Record<string, unknown>;
			}>((resolve) => {
				resolveExecution = resolve;
			});
			toolRegistry.executeTool.mockReturnValue(execution);
			service.register(server(), authInfo([McpCapability.WRITE]));

			const resultPromise = callbacks.get('set_device_property')?.(
				{ property_id: target.id, value: true },
				requestContext([McpCapability.WRITE]),
			);
			await jest.advanceTimersByTimeAsync(MCP_TOOL_CALL_TIMEOUT_MS + 1);
			resolveExecution({
				success: true,
				status: ToolExecutionStatus.COMPLETED,
				message: 'Property updated',
				data: { property_id: target.id, value: true },
			});

			const result = await resultPromise;
			expect(result?.isError).toBeUndefined();
			expect(result?.structuredContent.data).toEqual(expect.objectContaining({ property_id: target.id, value: true }));
		} finally {
			jest.useRealTimers();
		}
	});

	it.each([
		{ enabled: false, hidden: false },
		{ enabled: true, hidden: true },
	])('rejects a write when its device is no longer available: %p', async ({ enabled, hidden }) => {
		providerTools = [providerTool('control_device', ToolAccessKind.WRITE)];
		const target = property('10000000-0000-4000-8000-000000000001', PermissionType.READ_WRITE);
		const device = (target.channel as { device: { enabled: boolean; hidden: boolean } }).device;
		device.enabled = enabled;
		device.hidden = hidden;
		channelsPropertiesService.findOne.mockResolvedValue(target);
		service.register(server(), authInfo([McpCapability.WRITE]));

		const result = await callbacks.get('set_device_property')?.(
			{ property_id: target.id, value: true },
			requestContext([McpCapability.WRITE]),
		);

		expect(result?.isError).toBe(true);
		expect(result?.structuredContent.error).toEqual(expect.objectContaining({ code: 'not_found' }));
		expect(auditService.recordPolicyDenial).not.toHaveBeenCalled();
		expect(auditService.recordToolResult).toHaveBeenCalledWith(
			expect.objectContaining({ outcome: 'failed', tool: 'set_device_property' }),
		);
		expect(toolRegistry.executeTool).not.toHaveBeenCalled();
	});

	it('reports an unknown write target without recording a policy denial', async () => {
		providerTools = [providerTool('control_device', ToolAccessKind.WRITE)];
		channelsPropertiesService.findOne.mockResolvedValue(null);
		service.register(server(), authInfo([McpCapability.WRITE]));

		const result = await callbacks.get('set_device_property')?.(
			{ property_id: '10000000-0000-4000-8000-000000000001', value: true },
			requestContext([McpCapability.WRITE]),
		);

		expect(result?.isError).toBe(true);
		expect(result?.structuredContent.error).toEqual(expect.objectContaining({ code: 'not_found' }));
		expect(auditService.recordPolicyDenial).not.toHaveBeenCalled();
		expect(auditService.recordToolResult).toHaveBeenCalledWith(
			expect.objectContaining({ outcome: 'failed', tool: 'set_device_property' }),
		);
		expect(toolRegistry.executeTool).not.toHaveBeenCalled();
	});

	it('reports a disabled scene as a domain failure without recording a capability denial', async () => {
		providerTools = [providerTool('run_scene', ToolAccessKind.TRIGGER)];
		toolRegistry.executeTool.mockResolvedValue({
			success: false,
			status: ToolExecutionStatus.DENIED,
			message: 'Scene is disabled',
			errorCode: 'SCENE_DISABLED',
		});
		service.register(server(), authInfo([McpCapability.TRIGGER]));

		const result = await callbacks.get('run_scene')?.(
			{ scene_id: '10000000-0000-4000-8000-000000000001' },
			requestContext([McpCapability.TRIGGER]),
		);

		expect(result?.isError).toBe(true);
		expect(result?.structuredContent.error).toEqual(expect.objectContaining({ code: 'trigger_failed' }));
		expect(auditService.recordPolicyDenial).not.toHaveBeenCalled();
		expect(auditService.recordToolResult).toHaveBeenCalledWith(
			expect.objectContaining({ outcome: 'failed', tool: 'run_scene' }),
		);
	});

	it('continues to audit provider access rejections as capability denials', async () => {
		providerTools = [providerTool('run_scene', ToolAccessKind.TRIGGER)];
		toolRegistry.executeTool.mockResolvedValue({
			success: false,
			status: ToolExecutionStatus.DENIED,
			message: 'Tool access denied',
			errorCode: 'TOOL_ACCESS_DENIED',
		});
		service.register(server(), authInfo([McpCapability.TRIGGER]));

		const result = await callbacks.get('run_scene')?.(
			{ scene_id: '10000000-0000-4000-8000-000000000001' },
			requestContext([McpCapability.TRIGGER]),
		);

		expect(result?.isError).toBe(true);
		expect(result?.structuredContent.error).toEqual(expect.objectContaining({ code: 'permission_denied' }));
		expect(auditService.recordPolicyDenial).toHaveBeenCalledWith(
			{ requestId: '17', clientId: 'client-id' },
			'capability_denied',
			{ capability: McpCapability.TRIGGER, tool: 'run_scene' },
		);
		expect(auditService.recordToolResult).toHaveBeenCalledWith(
			expect.objectContaining({ outcome: 'denied', tool: 'run_scene' }),
		);
	});

	it('audits a module-disable race as an endpoint denial for write and trigger tools', async () => {
		providerTools = [providerTool('run_scene', ToolAccessKind.TRIGGER)];
		policyService.authorizeAuthInfo.mockRejectedValue(new McpEndpointDisabledException());
		service.register(server(), authInfo([McpCapability.TRIGGER]));

		const result = await callbacks.get('run_scene')?.(
			{ scene_id: '10000000-0000-4000-8000-000000000001' },
			requestContext([McpCapability.TRIGGER]),
		);

		expect(result?.isError).toBe(true);
		expect(auditService.recordPolicyDenial).toHaveBeenCalledWith(
			{ requestId: '17', clientId: 'client-id' },
			'endpoint_disabled',
			{ capability: McpCapability.TRIGGER, tool: 'run_scene' },
		);
		expect(auditService.recordToolResult).toHaveBeenCalledWith(
			expect.objectContaining({ outcome: 'denied', tool: 'run_scene' }),
		);
	});

	it('distinguishes a live credential rejection from a capability denial for mutating tools', async () => {
		providerTools = [providerTool('run_scene', ToolAccessKind.TRIGGER)];
		policyService.authorizeAuthInfo.mockRejectedValue(new UnauthorizedException('private credential detail'));
		service.register(server(), authInfo([McpCapability.TRIGGER]));

		const result = await callbacks.get('run_scene')?.(
			{ scene_id: '10000000-0000-4000-8000-000000000001' },
			requestContext([McpCapability.TRIGGER]),
		);

		expect(result?.isError).toBe(true);
		expect(auditService.recordPolicyDenial).toHaveBeenCalledWith(
			{ requestId: '17', clientId: 'client-id' },
			'invalid_credential',
			{ capability: McpCapability.TRIGGER, tool: 'run_scene' },
		);
	});

	function server(): McpServer {
		return { registerTool } as unknown as McpServer;
	}

	function authInfo(scopes: McpCapability[]): AuthInfo {
		return {
			token: 'raw-token',
			clientId: 'client-id',
			scopes,
			extra: {
				endpoint: 'https://panel.test/api/v1/modules/mcp',
				installationId: 'installation-id',
				tokenId: 'token-id',
			},
		};
	}

	function requestContext(scopes: McpCapability[]): ServerContext {
		return {
			http: { authInfo: authInfo(scopes) },
			mcpReq: { id: 17 },
		} as unknown as ServerContext;
	}

	function providerTool(name: string, access: ToolAccessKind) {
		return { name, audiences: [ToolAudience.MCP], access };
	}

	function property(id: string, permission: PermissionType): ChannelPropertyEntity {
		const suffix = id.slice(-1);

		return {
			id,
			name: `Power ${suffix}`,
			category: PropertyCategory.ON,
			permissions: [permission],
			dataType: DataTypeType.BOOL,
			unit: null,
			format: null,
			step: null,
			invalid: null,
			channel: {
				id: `20000000-0000-4000-8000-00000000000${suffix}`,
				name: `Switch ${suffix}`,
				category: ChannelCategory.SWITCHER,
				device: {
					id: `30000000-0000-4000-8000-00000000000${suffix}`,
					name: `Device ${suffix}`,
					enabled: true,
					hidden: false,
				},
			},
		} as unknown as ChannelPropertyEntity;
	}

	function writableProperties(count: number): ChannelPropertyEntity[] {
		return Array.from({ length: count }, (_, index) =>
			property(`10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, PermissionType.READ_WRITE),
		);
	}

	function deviceId(target: ChannelPropertyEntity): string {
		return (target.channel as { device: { id: string } }).device.id;
	}

	function scene(enabled: boolean): SceneEntity {
		return {
			id: enabled ? '40000000-0000-4000-8000-000000000001' : '40000000-0000-4000-8000-000000000002',
			name: enabled ? 'Movie night' : 'Disabled scene',
			category: SceneCategory.GENERIC,
			enabled,
			triggerable: true,
			primarySpaceId: null,
		} as SceneEntity;
	}

	function space(): SpaceEntity {
		return {
			id: '50000000-0000-4000-8000-000000000001',
			name: 'Living room',
			type: SpaceType.ROOM,
		} as SpaceEntity;
	}
});
