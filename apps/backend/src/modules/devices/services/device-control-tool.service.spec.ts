import { ToolAccessKind, ToolAudience, ToolExecutionStatus } from '../../tools/platforms/tool-provider.platform';
import { ScopedShortIdTargetKind, ShortIdMappingService } from '../../tools/services/short-id-mapping.service';

import { DeviceControlToolService } from './device-control-tool.service';
import { PropertyCommandService } from './property-command.service';

describe('DeviceControlToolService', () => {
	let service: DeviceControlToolService;
	let propertyCommandService: { executePropertyCommandById: jest.Mock };
	let shortIdMapping: ShortIdMappingService;

	beforeEach(() => {
		propertyCommandService = {
			executePropertyCommandById: jest.fn(),
		};
		shortIdMapping = new ShortIdMappingService();
		service = new DeviceControlToolService(propertyCommandService as unknown as PropertyCommandService, shortIdMapping);
	});

	it('declares a Buddy/MCP write tool with input and output schemas', () => {
		const [definition] = service.getToolDefinitions();

		expect(definition.name).toBe('control_device');
		expect(definition.audiences).toEqual([ToolAudience.BUDDY, ToolAudience.MCP]);
		expect(definition.access).toBe(ToolAccessKind.WRITE);
		expect(definition.parameters).toEqual(
			expect.objectContaining({ type: 'object', required: ['property_id', 'value'] }),
		);
		expect(definition.inputSchema).toBeDefined();
		expect(definition.outputSchema).toBeDefined();
	});

	it('uses the shared property command path and propagates MCP context', async () => {
		const shortId = shortIdMapping.shorten('property-1');

		propertyCommandService.executePropertyCommandById.mockResolvedValue({
			device: 'device-1',
			deviceName: 'Kitchen Light',
			channel: 'channel-1',
			property: 'property-1',
			value: true,
			success: true,
		});

		const result = await service.executeTool(
			{
				id: 'request-1',
				name: 'control_device',
				arguments: { property_id: shortId, value: true },
			},
			{ audience: ToolAudience.MCP, source: 'mcp', actorId: 'client-1' },
		);

		expect(result).toEqual(
			expect.objectContaining({
				success: true,
				status: ToolExecutionStatus.COMPLETED,
				data: {
					device_id: 'device-1',
					channel_id: 'channel-1',
					property_id: 'property-1',
					value: true,
				},
			}),
		);
		expect(propertyCommandService.executePropertyCommandById).toHaveBeenCalledWith(
			'property-1',
			true,
			expect.any(Object),
		);
		const firstCall = propertyCommandService.executePropertyCommandById.mock.calls[0] as unknown as [
			string,
			unknown,
			{ requestId?: string; context?: { origin?: string; extra?: Record<string, unknown> } },
		];

		expect(firstCall[2]).toMatchObject({
			requestId: 'request-1',
			context: { origin: 'api', extra: { source: 'mcp', audience: ToolAudience.MCP, actorId: 'client-1' } },
		});
	});

	it('preserves the MCP canonical-ID fallback', async () => {
		propertyCommandService.executePropertyCommandById.mockResolvedValue({
			device: 'device-1',
			deviceName: 'Light',
			channel: 'channel-1',
			property: 'property-1',
			value: 50,
			success: true,
		});

		await service.executeTool(
			{
				id: 'call-1',
				name: 'control_device',
				arguments: { property_id: 'property-1', value: 50 },
			},
			{ audience: ToolAudience.MCP, source: 'mcp' },
		);

		expect(propertyCommandService.executePropertyCommandById).toHaveBeenCalledWith(
			'property-1',
			50,
			expect.any(Object),
		);
	});

	it('executes a Buddy property only through a same-conversation scoped property token', async () => {
		const token = shortIdMapping.exposeScoped('conversation-1', 'property-1', ScopedShortIdTargetKind.PROPERTY);

		expect(token).not.toBeNull();
		propertyCommandService.executePropertyCommandById.mockResolvedValue({
			device: 'device-1',
			deviceName: 'Light',
			channel: 'channel-1',
			property: 'property-1',
			value: 50,
			success: true,
		});

		await service.executeTool(
			{
				id: 'call-1',
				name: 'control_device',
				arguments: { property_id: token, value: 50 },
			},
			{ audience: ToolAudience.BUDDY, source: 'buddy', conversationId: 'conversation-1' },
		);

		expect(propertyCommandService.executePropertyCommandById).toHaveBeenCalledWith(
			'property-1',
			50,
			expect.any(Object),
		);
		const firstCall = propertyCommandService.executePropertyCommandById.mock.calls[0] as unknown as [
			string,
			unknown,
			{ context?: { extra?: Record<string, unknown> } },
		];

		expect(firstCall[2]).toMatchObject({
			context: { extra: { source: 'buddy', audience: ToolAudience.BUDDY } },
		});
	});

	it('denies unscoped, foreign, wrong-kind, stale, and canonical Buddy property IDs without a domain call', async () => {
		const valid = shortIdMapping.exposeScoped('conversation-a', 'property-1', ScopedShortIdTargetKind.PROPERTY);
		const wrongKind = shortIdMapping.exposeScoped('conversation-a', 'scene-1', ScopedShortIdTargetKind.SCENE);
		const stale = shortIdMapping.exposeScoped('conversation-stale', 'property-2', ScopedShortIdTargetKind.PROPERTY);

		expect(valid).not.toBeNull();
		expect(wrongKind).not.toBeNull();
		expect(stale).not.toBeNull();
		shortIdMapping.clearScope('conversation-stale');

		const attempts = [
			{ propertyId: valid, context: { audience: ToolAudience.BUDDY, source: 'buddy' } },
			{
				propertyId: valid,
				context: { audience: ToolAudience.BUDDY, source: 'buddy', conversationId: 'conversation-b' },
			},
			{
				propertyId: wrongKind,
				context: { audience: ToolAudience.BUDDY, source: 'buddy', conversationId: 'conversation-a' },
			},
			{
				propertyId: stale,
				context: { audience: ToolAudience.BUDDY, source: 'buddy', conversationId: 'conversation-stale' },
			},
			{
				propertyId: 'property-1',
				context: { audience: ToolAudience.BUDDY, source: 'buddy', conversationId: 'conversation-a' },
			},
		];

		for (const attempt of attempts) {
			await expect(
				service.executeTool(
					{
						id: 'call-denied',
						name: 'control_device',
						arguments: { property_id: attempt.propertyId, value: true },
					},
					attempt.context,
				),
			).resolves.toEqual({
				success: false,
				status: ToolExecutionStatus.DENIED,
				message: 'The requested target is not available in this Buddy conversation.',
				errorCode: 'BUDDY_TARGET_NOT_EXPOSED',
			});
		}

		expect(propertyCommandService.executePropertyCommandById).not.toHaveBeenCalled();
	});

	it('returns a structured failure from the command service', async () => {
		const token = shortIdMapping.exposeScoped('conversation-1', 'property-1', ScopedShortIdTargetKind.PROPERTY);

		propertyCommandService.executePropertyCommandById.mockResolvedValue({
			device: 'device-1',
			success: false,
			reason: 'Property is not writable',
		});

		const result = await service.executeTool(
			{
				id: 'call-1',
				name: 'control_device',
				arguments: { property_id: token, value: true },
			},
			{ audience: ToolAudience.BUDDY, source: 'buddy', conversationId: 'conversation-1' },
		);

		expect(result).toEqual(
			expect.objectContaining({
				success: false,
				status: ToolExecutionStatus.FAILED,
				message: 'Property is not writable',
				errorCode: 'DEVICE_PROPERTY_WRITE_FAILED',
			}),
		);
	});

	it('rejects missing parameters before invoking the command service', async () => {
		const result = await service.executeTool({ id: 'call-1', name: 'control_device', arguments: {} });

		expect(result).toEqual(
			expect.objectContaining({ status: ToolExecutionStatus.FAILED, errorCode: 'INVALID_TOOL_ARGUMENTS' }),
		);
		expect(propertyCommandService.executePropertyCommandById).not.toHaveBeenCalled();
	});

	it('returns null for an unknown tool name', async () => {
		await expect(service.executeTool({ id: 'call-1', name: 'unknown_tool', arguments: {} })).resolves.toBeNull();
	});
});
