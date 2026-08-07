import { z } from 'zod';

import { AuthInfo, McpServer, ServerContext } from '@modelcontextprotocol/server';
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';

import { withTimeout } from '../../../common/utils/http.utils';
import { ConnectionState, PermissionType } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { DeviceConnectionStateService } from '../../devices/services/device-connection-state.service';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { resolvePropertyUnit } from '../../devices/utils/property-metadata.utils';
import { SceneSummaryPage, ScenesService } from '../../scenes/services/scenes.service';
import { SpaceSummaryPage, SpacesService } from '../../spaces/services/spaces.service';
import {
	ToolAccessKind,
	ToolAudience,
	ToolExecutionResult,
	ToolExecutionStatus,
} from '../../tools/platforms/tool-provider.platform';
import { ToolProviderRegistryService } from '../../tools/services/tool-provider-registry.service';
import {
	MCP_MAX_TRIGGER_SCENES,
	MCP_MAX_TRIGGER_SPACES,
	MCP_MAX_WRITABLE_PROPERTIES,
	MCP_MAX_WRITABLE_PROPERTY_CANDIDATES,
	MCP_TOOL_CALL_TIMEOUT_MS,
	McpCapability,
} from '../mcp.constants';
import { McpContextService, McpInstallationContext } from '../services/mcp-context.service';
import { McpPolicyService } from '../services/mcp-policy.service';

const toolOutputSchema = z.object({
	installation: z.object({
		id: z.string(),
		name: z.string(),
		version: z.string(),
		timezone: z.string(),
		endpoint: z.string().nullable(),
		effective_capabilities: z.array(z.enum(McpCapability)),
	}),
	tool: z.string(),
	request_id: z.string(),
	observed_at: z.string(),
	data: z.unknown().nullable(),
	error: z
		.object({
			code: z.string(),
			message: z.string(),
		})
		.optional(),
});

const emptyInputSchema = z.object({});

const setDevicePropertyInputSchema = z.object({
	property_id: z.string().uuid(),
	value: z.union([z.string(), z.number(), z.boolean()]),
});

const runSceneInputSchema = z.object({
	scene_id: z.string().uuid(),
});

const lightingModes = ['off', 'on', 'work', 'relax', 'night'] as const;

const setSpaceLightingInputSchema = z.object({
	space_id: z.string().uuid(),
	mode: z.enum(lightingModes),
});

interface ToolData {
	data: Record<string, unknown>;
	text: string;
	error?: { code: string; message: string };
}

interface ToolEnvelope {
	installation: McpInstallationContext;
	tool: string;
	request_id: string;
	observed_at: string;
	data: unknown;
	error?: { code: string; message: string };
}

@Injectable()
export class McpTargetDiscoveryToolService {
	constructor(
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deviceConnectionStateService: DeviceConnectionStateService,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly scenesService: ScenesService,
		private readonly spacesService: SpacesService,
		private readonly toolRegistry: ToolProviderRegistryService,
		private readonly contextService: McpContextService,
		private readonly policyService: McpPolicyService,
	) {}

	register(server: McpServer, authInfo?: AuthInfo): void {
		if (authInfo?.scopes.includes(McpCapability.WRITE)) {
			this.registerWriteTools(server);
		}

		if (authInfo?.scopes.includes(McpCapability.TRIGGER)) {
			this.registerTriggerTools(server);
		}
	}

	private registerWriteTools(server: McpServer): void {
		server.registerTool(
			'list_writable_properties',
			{
				description: 'Lists bounded, currently actionable device properties with the metadata required to set a value.',
				inputSchema: emptyInputSchema,
				outputSchema: toolOutputSchema,
			},
			async (_args, ctx) =>
				this.runTool('list_writable_properties', McpCapability.WRITE, ctx, async () => {
					const candidates = await this.channelsPropertiesService.findWritableCandidates(
						MCP_MAX_WRITABLE_PROPERTY_CANDIDATES,
					);
					const devices = this.uniqueDevices(candidates.properties);
					const availableDevices = devices.filter(
						(device) => device.enabled && !device.hidden && this.platformRegistryService.get(device) !== null,
					);
					const availableDeviceIds = new Set(availableDevices.map((device) => device.id));
					const statuses = await this.deviceConnectionStateService.readLatestMany(availableDevices);
					const actionable = candidates.properties.filter((property) => {
						const device = this.getDevice(property);
						const status = statuses.get(device.id);

						return (
							availableDeviceIds.has(device.id) &&
							property.permissions.some((permission) =>
								[PermissionType.READ_WRITE, PermissionType.WRITE_ONLY].includes(permission),
							) &&
							(status === undefined || status.online || status.status === ConnectionState.UNKNOWN)
						);
					});
					const properties = actionable
						.slice(0, MCP_MAX_WRITABLE_PROPERTIES)
						.map((property) => this.toWritableProperty(property));
					const truncated =
						candidates.total > MCP_MAX_WRITABLE_PROPERTY_CANDIDATES || actionable.length > MCP_MAX_WRITABLE_PROPERTIES;

					return {
						data: { properties, truncated },
						text: `Found ${properties.length} writable device propert${properties.length === 1 ? 'y' : 'ies'}.`,
					};
				}),
		);

		if (!this.hasProviderTool('control_device', ToolAccessKind.WRITE)) {
			return;
		}

		server.registerTool(
			'set_device_property',
			{
				description: 'Sets one writable device property using an ID returned by list_writable_properties.',
				inputSchema: setDevicePropertyInputSchema,
				outputSchema: toolOutputSchema,
			},
			async (args, ctx) =>
				this.runProviderTool(
					'set_device_property',
					'control_device',
					McpCapability.WRITE,
					ToolAccessKind.WRITE,
					args,
					ctx,
				),
		);
	}

	private registerTriggerTools(server: McpServer): void {
		server.registerTool(
			'list_trigger_targets',
			{
				description: 'Lists bounded, enabled scenes and lighting-capable spaces available to trigger tools.',
				inputSchema: emptyInputSchema,
				outputSchema: toolOutputSchema,
			},
			async (_args, ctx) =>
				this.runTool('list_trigger_targets', McpCapability.TRIGGER, ctx, async () => {
					const supportsScenes = this.hasProviderTool('run_scene', ToolAccessKind.TRIGGER);
					const supportsSpaceLighting = this.hasProviderTool('set_space_lighting', ToolAccessKind.TRIGGER);
					const emptyScenePage: SceneSummaryPage = { scenes: [], total: 0 };
					const emptySpacePage: SpaceSummaryPage = { spaces: [], total: 0 };
					const [scenePage, spacePage] = await Promise.all([
						supportsScenes
							? this.scenesService.findTriggerableSummaryPage(MCP_MAX_TRIGGER_SCENES)
							: Promise.resolve(emptyScenePage),
						supportsSpaceLighting
							? this.spacesService.findLightingTriggerSummaryPage(MCP_MAX_TRIGGER_SPACES)
							: Promise.resolve(emptySpacePage),
					]);
					const scenes = scenePage.scenes
						.filter((scene) => scene.enabled && scene.triggerable)
						.map((scene) => ({
							scene_id: scene.id,
							name: scene.name,
							category: scene.category,
							primary_space_id: scene.primarySpaceId,
						}));
					const spaces = spacePage.spaces.map((space) => ({
						space_id: space.id,
						name: space.name,
						type: space.type,
						modes: [...lightingModes],
					}));

					return {
						data: {
							scenes,
							spaces,
							truncated: {
								scenes: scenePage.total > MCP_MAX_TRIGGER_SCENES,
								spaces: spacePage.total > MCP_MAX_TRIGGER_SPACES,
							},
						},
						text: `Found ${scenes.length} scene(s) and ${spaces.length} lighting-capable space(s).`,
					};
				}),
		);

		if (this.hasProviderTool('run_scene', ToolAccessKind.TRIGGER)) {
			server.registerTool(
				'run_scene',
				{
					description: 'Runs one enabled scene using an ID returned by list_trigger_targets.',
					inputSchema: runSceneInputSchema,
					outputSchema: toolOutputSchema,
				},
				async (args, ctx) =>
					this.runProviderTool('run_scene', 'run_scene', McpCapability.TRIGGER, ToolAccessKind.TRIGGER, args, ctx),
			);
		}

		if (this.hasProviderTool('set_space_lighting', ToolAccessKind.TRIGGER)) {
			server.registerTool(
				'set_space_lighting',
				{
					description: 'Sets a supported lighting mode for a space returned by list_trigger_targets.',
					inputSchema: setSpaceLightingInputSchema,
					outputSchema: toolOutputSchema,
				},
				async (args, ctx) =>
					this.runProviderTool(
						'set_space_lighting',
						'set_space_lighting',
						McpCapability.TRIGGER,
						ToolAccessKind.TRIGGER,
						args,
						ctx,
					),
			);
		}
	}

	private async runProviderTool(
		publicName: string,
		providerName: string,
		capability: McpCapability,
		access: ToolAccessKind,
		args: Record<string, unknown>,
		ctx: ServerContext,
	) {
		return this.runTool(publicName, capability, ctx, async (policy) => {
			if (providerName === 'control_device' && !(await this.isAvailableDeviceProperty(args.property_id))) {
				return this.toProviderToolData(capability, {
					success: false,
					status: ToolExecutionStatus.DENIED,
					message: 'Device property is unavailable',
					errorCode: 'DEVICE_PROPERTY_NOT_FOUND',
				});
			}

			const result = await this.toolRegistry.executeTool(
				{ id: String(ctx.mcpReq.id), name: providerName, arguments: args },
				{
					audience: ToolAudience.MCP,
					source: 'mcp',
					actorId: policy.client.id,
					requestId: String(ctx.mcpReq.id),
					allowedAccessKinds: [access],
				},
			);

			return this.toProviderToolData(capability, result);
		});
	}

	private async runTool(
		tool: string,
		capability: McpCapability,
		ctx: ServerContext,
		callback: (policy: Awaited<ReturnType<McpPolicyService['authorizeClient']>>) => Promise<ToolData>,
	): Promise<{
		content: Array<{ type: 'text'; text: string }>;
		structuredContent: ToolEnvelope;
		isError?: boolean;
	}> {
		const requestId = String(ctx.mcpReq.id);
		let installation = this.getInstallationFallback(ctx);

		try {
			const execution = await withTimeout(
				Promise.resolve().then(async () => {
					const policy = await this.authorize(ctx, capability);
					const liveInstallation = await this.contextService.getInstallation(
						policy.effectiveCapabilities,
						this.getEndpoint(ctx.http?.authInfo),
					);

					return { installation: liveInstallation, result: await callback(policy) };
				}),
				MCP_TOOL_CALL_TIMEOUT_MS,
				`MCP tool ${tool}`,
			);
			installation = execution.installation;
			const structuredContent: ToolEnvelope = {
				installation,
				tool,
				request_id: requestId,
				observed_at: new Date().toISOString(),
				data: execution.result.data,
				...(execution.result.error ? { error: execution.result.error } : {}),
			};

			return {
				content: [{ type: 'text', text: execution.result.text }],
				structuredContent,
				...(execution.result.error ? { isError: true } : {}),
			};
		} catch (error) {
			const sanitized = this.sanitizeError(error, capability);
			const structuredContent: ToolEnvelope = {
				installation,
				tool,
				request_id: requestId,
				observed_at: new Date().toISOString(),
				data: null,
				error: sanitized,
			};

			return {
				content: [{ type: 'text', text: sanitized.message }],
				structuredContent,
				isError: true,
			};
		}
	}

	private async authorize(ctx: ServerContext, capability: McpCapability) {
		const authInfo = ctx.http?.authInfo;
		const tokenId = this.getExtraString(authInfo?.extra?.tokenId);

		if (!authInfo?.clientId || !tokenId) {
			throw new UnauthorizedException('MCP request identity is unavailable');
		}

		return this.policyService.authorizeClient(tokenId, authInfo.clientId, capability);
	}

	private hasProviderTool(name: string, access: ToolAccessKind): boolean {
		return this.toolRegistry
			.getAllToolDefinitions({ audience: ToolAudience.MCP, accessKinds: [access] })
			.some((definition) => definition.name === name);
	}

	private uniqueDevices(properties: ChannelPropertyEntity[]): DeviceEntity[] {
		return [
			...new Map(
				properties.map((property) => {
					const device = this.getDevice(property);

					return [device.id, device];
				}),
			).values(),
		];
	}

	private toWritableProperty(property: ChannelPropertyEntity): Record<string, unknown> {
		const channel = property.channel as ChannelEntity;
		const device = channel.device as DeviceEntity;

		return {
			property_id: property.id,
			property_name: property.name,
			property_category: property.category,
			device_id: device.id,
			device_name: device.name,
			channel_id: channel.id,
			channel_name: channel.name,
			channel_category: channel.category,
			data_type: property.dataType,
			unit: resolvePropertyUnit(property),
			format: property.format,
			step: property.step,
			invalid: property.invalid,
		};
	}

	private getDevice(property: ChannelPropertyEntity): DeviceEntity {
		return (property.channel as ChannelEntity).device as DeviceEntity;
	}

	private async isAvailableDeviceProperty(propertyId: unknown): Promise<boolean> {
		if (typeof propertyId !== 'string') {
			return false;
		}

		const property = await this.channelsPropertiesService.findOne(propertyId);

		if (!property) {
			return false;
		}

		const device = this.getDevice(property);

		return device.enabled && !device.hidden && this.platformRegistryService.get(device) !== null;
	}

	private toProviderToolData(capability: McpCapability, result: ToolExecutionResult): ToolData {
		const data = { status: result.status, ...(result.data ?? {}) };

		if (result.success) {
			return { data, text: result.message };
		}

		const invalid = result.errorCode === 'INVALID_TOOL_ARGUMENTS';
		const notFound = result.errorCode?.endsWith('_NOT_FOUND') ?? false;
		const denied = result.status === ToolExecutionStatus.DENIED;
		const operation = capability === McpCapability.WRITE ? 'write' : 'trigger';

		return {
			data,
			text: invalid
				? 'The tool arguments are invalid.'
				: notFound
					? 'The requested Smart Panel target was not found.'
					: denied
						? `The MCP client is not authorized for this ${operation} operation.`
						: `Smart Panel could not complete the requested ${operation} operation.`,
			error: {
				code: invalid
					? 'invalid_request'
					: notFound
						? 'not_found'
						: denied
							? 'permission_denied'
							: `${operation}_failed`,
				message: invalid
					? 'The tool arguments are invalid.'
					: notFound
						? 'The requested Smart Panel target was not found.'
						: denied
							? `The MCP client is not authorized for this ${operation} operation.`
							: `Smart Panel could not complete the requested ${operation} operation.`,
			},
		};
	}

	private sanitizeError(error: unknown, capability: McpCapability): { code: string; message: string } {
		const operation = capability === McpCapability.WRITE ? 'write' : 'trigger';

		if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
			return {
				code: 'permission_denied',
				message: `The MCP client is not authorized for this ${operation} operation.`,
			};
		}

		return {
			code: `${operation}_failed`,
			message: `Smart Panel could not complete the requested ${operation} operation.`,
		};
	}

	private getInstallationFallback(ctx: ServerContext): McpInstallationContext {
		const authInfo = ctx.http?.authInfo;
		const capabilities = (authInfo?.scopes ?? []).filter((scope): scope is McpCapability =>
			Object.values(McpCapability).includes(scope as McpCapability),
		);

		return {
			id: this.getExtraString(authInfo?.extra?.installationId) ?? 'unknown',
			name: 'FastyBird Smart Panel',
			version: 'unknown',
			timezone: 'UTC',
			endpoint: this.getEndpoint(authInfo) ?? null,
			effective_capabilities: capabilities,
		};
	}

	private getEndpoint(authInfo?: AuthInfo): string | undefined {
		return this.getExtraString(authInfo?.extra?.endpoint);
	}

	private getExtraString(value: unknown): string | undefined {
		return typeof value === 'string' && value.length > 0 ? value : undefined;
	}
}
