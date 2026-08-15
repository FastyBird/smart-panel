import { AuthInfo, McpServer, ServerContext } from '@modelcontextprotocol/server';
import { UnauthorizedException } from '@nestjs/common';

import { ChannelCategory, DataTypeType, PermissionType, PropertyCategory } from '../../devices/devices.constants';
import { ChannelPropertyEntity } from '../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY } from '../../home-context/home-context.constants';
import {
	HomeTriggerTargetsResult,
	HomeWritablePropertiesResult,
} from '../../home-context/models/home-target-result.model';
import { HomeTargetQueryService } from '../../home-context/services/home-target-query.service';
import { SceneCategory } from '../../scenes/scenes.constants';
import { SpaceType } from '../../spaces/spaces.constants';
import { ToolAccessKind, ToolAudience, ToolExecutionStatus } from '../../tools/platforms/tool-provider.platform';
import { ToolProviderRegistryService } from '../../tools/services/tool-provider-registry.service';
import { MCP_TOOL_CALL_TIMEOUT_MS, McpCapability } from '../mcp.constants';
import { McpEndpointDisabledException } from '../mcp.exceptions';
import { McpAuditService } from '../services/mcp-audit.service';
import { McpContextService } from '../services/mcp-context.service';
import { McpPolicyService } from '../services/mcp-policy.service';

import { McpTargetDiscoveryToolService } from './mcp-target-discovery-tool.service';

type ToolCallback = (
	args: Record<string, unknown>,
	ctx: ServerContext,
) => Promise<{
	content: Array<{ type: string; text: string }>;
	isError?: boolean;
	structuredContent: Record<string, unknown>;
}>;

describe('McpTargetDiscoveryToolService', () => {
	let service: McpTargetDiscoveryToolService;
	let channelsPropertiesService: { findOne: jest.Mock };
	let platformRegistryService: { get: jest.Mock };
	let homeTargetQueryService: { getWritableProperties: jest.Mock; getTriggerTargets: jest.Mock };
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
		};
		platformRegistryService = {
			get: jest.fn().mockReturnValue({}),
		};
		homeTargetQueryService = {
			getWritableProperties: jest.fn().mockResolvedValue({ properties: [], truncated: false }),
			getTriggerTargets: jest.fn().mockResolvedValue({
				scenes: [],
				spaces: [],
				truncated: { scenes: false, spaces: false },
			}),
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
			platformRegistryService as unknown as PlatformRegistryService,
			homeTargetQueryService as unknown as HomeTargetQueryService,
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

	it('delegates writable discovery with the compatibility profile and preserves exact data identity and text', async () => {
		providerTools = [providerTool('control_device', ToolAccessKind.WRITE)];
		const discovery: HomeWritablePropertiesResult = {
			properties: [
				{
					property_id: '10000000-0000-4000-8000-000000000001',
					property_name: 'Temperature',
					property_category: PropertyCategory.TEMPERATURE,
					device_id: '30000000-0000-4000-8000-000000000001',
					device_name: 'Thermostat',
					channel_id: '20000000-0000-4000-8000-000000000001',
					channel_name: 'Climate',
					channel_category: ChannelCategory.TEMPERATURE,
					data_type: DataTypeType.FLOAT,
					unit: '°C',
					format: [-40, 125],
					step: 0.1,
					invalid: -999,
				},
			],
			truncated: true,
		};
		homeTargetQueryService.getWritableProperties.mockResolvedValue(discovery);
		service.register(server(), authInfo([McpCapability.WRITE]));

		expect([...callbacks.keys()]).toEqual(['list_writable_properties', 'set_device_property']);
		const result = await callbacks.get('list_writable_properties')?.({}, requestContext([McpCapability.WRITE]));

		expect(homeTargetQueryService.getWritableProperties).toHaveBeenCalledWith({
			profile: HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY,
		});
		expect(policyService.authorizeAuthInfo).toHaveBeenCalledWith(
			expect.objectContaining({ clientId: 'client-id', token: 'raw-token' }),
			McpCapability.WRITE,
		);
		expect(result?.structuredContent.data).toBe(discovery);
		expect(result?.structuredContent.data).toEqual(discovery);
		expect(result?.content).toEqual([{ type: 'text', text: 'Found 1 writable device property.' }]);
		expect(result?.structuredContent).toEqual(
			expect.objectContaining({
				tool: 'list_writable_properties',
				request_id: '17',
				data: discovery,
			}),
		);
	});

	it('delegates mixed trigger discovery with exact provider flags, data identity, and text', async () => {
		providerTools = [
			providerTool('run_scene', ToolAccessKind.TRIGGER),
			providerTool('set_space_lighting', ToolAccessKind.TRIGGER),
		];
		const discovery: HomeTriggerTargetsResult = {
			scenes: [
				{
					scene_id: '40000000-0000-4000-8000-000000000001',
					name: 'Movie night',
					category: SceneCategory.GENERIC,
					primary_space_id: null,
				},
			],
			spaces: [
				{
					space_id: '50000000-0000-4000-8000-000000000001',
					name: 'Living room',
					type: SpaceType.ROOM,
					modes: ['off', 'on', 'work', 'relax', 'night'],
				},
			],
			truncated: { scenes: true, spaces: false },
		};
		homeTargetQueryService.getTriggerTargets.mockResolvedValue(discovery);
		service.register(server(), authInfo([McpCapability.TRIGGER]));

		expect([...callbacks.keys()]).toEqual(['list_trigger_targets', 'run_scene', 'set_space_lighting']);
		const result = await callbacks.get('list_trigger_targets')?.({}, requestContext([McpCapability.TRIGGER]));

		expect(homeTargetQueryService.getTriggerTargets).toHaveBeenCalledWith({
			profile: HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY,
			includeScenes: true,
			includeSpaces: true,
		});
		expect(result?.structuredContent.data).toBe(discovery);
		expect(result?.structuredContent.data).toEqual(discovery);
		expect(result?.content).toEqual([{ type: 'text', text: 'Found 1 scene(s) and 1 lighting-capable space(s).' }]);
	});

	it('passes false for an absent optional trigger provider and omits its execution tool', async () => {
		providerTools = [providerTool('run_scene', ToolAccessKind.TRIGGER)];
		const discovery: HomeTriggerTargetsResult = {
			scenes: [],
			spaces: [],
			truncated: { scenes: false, spaces: false },
		};
		homeTargetQueryService.getTriggerTargets.mockResolvedValue(discovery);
		service.register(server(), authInfo([McpCapability.TRIGGER]));

		expect([...callbacks.keys()]).toEqual(['list_trigger_targets', 'run_scene']);
		const result = await callbacks.get('list_trigger_targets')?.({}, requestContext([McpCapability.TRIGGER]));

		expect(homeTargetQueryService.getTriggerTargets).toHaveBeenCalledWith({
			profile: HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY,
			includeScenes: true,
			includeSpaces: false,
		});
		expect(result?.structuredContent.data).toBe(discovery);
	});

	it('preserves the exact legacy discovery contracts through the real shared mapper and MCP envelope', async () => {
		const target = property('10000000-0000-4000-8000-000000000001', PermissionType.READ_WRITE);
		const targetDevice = (target.channel as { device: { id: string } }).device;
		const realTargetQuery = new HomeTargetQueryService(
			{ findWritableCandidates: jest.fn().mockResolvedValue({ properties: [target], total: 1 }) } as never,
			{
				readLatestMany: jest
					.fn()
					.mockResolvedValue(new Map([[targetDevice.id, { online: true, status: 'connected', lastChanged: null }]])),
			} as never,
			platformRegistryService as unknown as PlatformRegistryService,
			{
				findTriggerableSummaryPage: jest.fn().mockResolvedValue({
					scenes: [
						{
							id: '40000000-0000-4000-8000-000000000001',
							name: 'Movie night',
							category: SceneCategory.GENERIC,
							enabled: true,
							triggerable: true,
							primarySpaceId: null,
						},
					],
					total: 1,
				}),
			} as never,
			{
				findLightingTriggerSummaryPage: jest.fn().mockResolvedValue({
					spaces: [
						{
							id: '50000000-0000-4000-8000-000000000001',
							name: 'Living room',
							type: SpaceType.ROOM,
						},
					],
					total: 1,
				}),
			} as never,
		);
		service = new McpTargetDiscoveryToolService(
			channelsPropertiesService as unknown as ChannelsPropertiesService,
			platformRegistryService as unknown as PlatformRegistryService,
			realTargetQuery,
			toolRegistry as unknown as ToolProviderRegistryService,
			contextService as unknown as McpContextService,
			policyService as unknown as McpPolicyService,
			auditService as unknown as McpAuditService,
		);
		providerTools = [
			providerTool('control_device', ToolAccessKind.WRITE),
			providerTool('run_scene', ToolAccessKind.TRIGGER),
			providerTool('set_space_lighting', ToolAccessKind.TRIGGER),
		];
		service.register(server(), authInfo([McpCapability.WRITE, McpCapability.TRIGGER]));

		const writable = await callbacks.get('list_writable_properties')?.(
			{},
			requestContext([McpCapability.WRITE, McpCapability.TRIGGER]),
		);
		const triggers = await callbacks.get('list_trigger_targets')?.(
			{},
			requestContext([McpCapability.WRITE, McpCapability.TRIGGER]),
		);

		expect(writable?.structuredContent.data).toEqual({
			properties: [
				{
					property_id: target.id,
					property_name: 'Power 1',
					property_category: PropertyCategory.ON,
					device_id: '30000000-0000-4000-8000-000000000001',
					device_name: 'Device 1',
					channel_id: '20000000-0000-4000-8000-000000000001',
					channel_name: 'Switch 1',
					channel_category: ChannelCategory.SWITCHER,
					data_type: DataTypeType.BOOL,
					unit: null,
					format: null,
					step: null,
					invalid: null,
				},
			],
			truncated: false,
		});
		expect(triggers?.structuredContent.data).toEqual({
			scenes: [
				{
					scene_id: '40000000-0000-4000-8000-000000000001',
					name: 'Movie night',
					category: SceneCategory.GENERIC,
					primary_space_id: null,
				},
			],
			spaces: [
				{
					space_id: '50000000-0000-4000-8000-000000000001',
					name: 'Living room',
					type: SpaceType.ROOM,
					modes: ['off', 'on', 'work', 'relax', 'night'],
				},
			],
			truncated: { scenes: false, spaces: false },
		});
	});

	it('keeps writable execution preflight local when the device platform is unavailable', async () => {
		providerTools = [providerTool('control_device', ToolAccessKind.WRITE)];
		const target = property('10000000-0000-4000-8000-000000000001', PermissionType.READ_WRITE);
		channelsPropertiesService.findOne.mockResolvedValue(target);
		platformRegistryService.get.mockReturnValue(null);
		service.register(server(), authInfo([McpCapability.WRITE]));

		const result = await callbacks.get('set_device_property')?.(
			{ property_id: target.id, value: true },
			requestContext([McpCapability.WRITE]),
		);

		expect(channelsPropertiesService.findOne).toHaveBeenCalledWith(target.id);
		expect(platformRegistryService.get).toHaveBeenCalledWith(
			expect.objectContaining({ id: '30000000-0000-4000-8000-000000000001' }),
		);
		expect(result?.isError).toBe(true);
		expect(result?.structuredContent.error).toEqual(expect.objectContaining({ code: 'not_found' }));
		expect(toolRegistry.executeTool).not.toHaveBeenCalled();
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
});
