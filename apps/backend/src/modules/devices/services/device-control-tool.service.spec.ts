import { IntentTargetStatus } from '../../intents/intents.constants';
import { IntentsService } from '../../intents/services/intents.service';

import { ChannelsPropertiesService } from './channels.properties.service';
import { DeviceControlToolService } from './device-control-tool.service';
import { DevicesService } from './devices.service';
import { PlatformRegistryService } from './platform.registry.service';

describe('DeviceControlToolService', () => {
	let service: DeviceControlToolService;
	let intentsService: Record<string, jest.Mock>;
	let devicesService: Record<string, jest.Mock>;
	let channelsPropertiesService: Record<string, jest.Mock>;
	let platformRegistry: Record<string, jest.Mock>;

	beforeEach(() => {
		intentsService = {
			createIntent: jest.fn().mockReturnValue({ id: 'intent-1' }),
			completeIntent: jest.fn().mockReturnValue(null),
		};

		devicesService = {
			findOne: jest.fn(),
		};

		channelsPropertiesService = {
			findOne: jest.fn(),
		};

		platformRegistry = {
			get: jest.fn(),
		};

		service = new DeviceControlToolService(
			intentsService as unknown as IntentsService,
			devicesService as unknown as DevicesService,
			channelsPropertiesService as unknown as ChannelsPropertiesService,
			platformRegistry as unknown as PlatformRegistryService,
		);
	});

	describe('getToolDefinitions', () => {
		it('should return one tool definition', () => {
			const tools = service.getToolDefinitions();

			expect(tools).toHaveLength(1);
			expect(tools[0].name).toBe('control_device');
		});

		it('should define control_device with required parameters', () => {
			const tools = service.getToolDefinitions();
			const controlDevice = tools.find((t) => t.name === 'control_device');

			expect(controlDevice).toBeDefined();
			expect(controlDevice?.parameters).toEqual(
				expect.objectContaining({
					type: 'object',
					required: ['device_id', 'channel_id', 'property_id', 'value'],
				}),
			);
		});
	});

	describe('executeTool - control_device', () => {
		it('should control a device property successfully', async () => {
			const mockDevice = { id: 'dev-1', name: 'Kitchen Light', type: 'local' };
			const mockChannel = { id: 'chan-1', device: 'dev-1' };
			const mockProperty = { id: 'prop-1', channel: mockChannel };
			const mockPlatform = { process: jest.fn().mockResolvedValue(true) };

			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsPropertiesService.findOne.mockResolvedValue(mockProperty);
			platformRegistry.get.mockReturnValue(mockPlatform);

			const result = await service.executeTool({
				id: 'call-1',
				name: 'control_device',
				arguments: {
					device_id: 'dev-1',
					channel_id: 'chan-1',
					property_id: 'prop-1',
					value: true,
				},
			});

			expect(result.success).toBe(true);
			expect(result.message).toContain('Kitchen Light');
			expect(intentsService.createIntent).toHaveBeenCalled();
			expect(intentsService.completeIntent).toHaveBeenCalledWith(
				'intent-1',
				expect.arrayContaining([expect.objectContaining({ status: IntentTargetStatus.SUCCESS })]),
			);
		});

		it('should return failure for non-existent device', async () => {
			devicesService.findOne.mockResolvedValue(null);

			const result = await service.executeTool({
				id: 'call-1',
				name: 'control_device',
				arguments: {
					device_id: 'nonexistent',
					channel_id: 'chan-1',
					property_id: 'prop-1',
					value: true,
				},
			});

			expect(result.success).toBe(false);
			expect(result.message).toContain('not found');
		});

		it('should return failure when platform rejects write', async () => {
			const mockDevice = { id: 'dev-1', name: 'Light', type: 'local' };
			const mockChannel = { id: 'chan-1', device: 'dev-1' };
			const mockProperty = { id: 'prop-1', channel: mockChannel };
			const mockPlatform = { process: jest.fn().mockResolvedValue(false) };

			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsPropertiesService.findOne.mockResolvedValue(mockProperty);
			platformRegistry.get.mockReturnValue(mockPlatform);

			const result = await service.executeTool({
				id: 'call-1',
				name: 'control_device',
				arguments: {
					device_id: 'dev-1',
					channel_id: 'chan-1',
					property_id: 'prop-1',
					value: 50,
				},
			});

			expect(result.success).toBe(false);
			expect(intentsService.completeIntent).toHaveBeenCalledWith(
				'intent-1',
				expect.arrayContaining([expect.objectContaining({ status: IntentTargetStatus.FAILED })]),
			);
		});

		it('should return failure when no platform registered', async () => {
			const mockDevice = { id: 'dev-1', name: 'Light', type: 'local' };
			const mockChannel = { id: 'chan-1', device: 'dev-1' };
			const mockProperty = { id: 'prop-1', channel: mockChannel };

			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsPropertiesService.findOne.mockResolvedValue(mockProperty);
			platformRegistry.get.mockReturnValue(null);

			const result = await service.executeTool({
				id: 'call-1',
				name: 'control_device',
				arguments: {
					device_id: 'dev-1',
					channel_id: 'chan-1',
					property_id: 'prop-1',
					value: true,
				},
			});

			expect(result.success).toBe(false);
			expect(result.message).toContain('No platform registered');
		});

		it('should return failure when missing parameters', async () => {
			const result = await service.executeTool({
				id: 'call-1',
				name: 'control_device',
				arguments: { device_id: 'dev-1' },
			});

			expect(result.success).toBe(false);
			expect(result.message).toContain('Missing required parameters');
		});
	});

	describe('executeTool - unknown tool', () => {
		it('should return null for unknown tool name', async () => {
			const result = await service.executeTool({
				id: 'call-1',
				name: 'unknown_tool',
				arguments: {},
			});

			expect(result).toBeNull();
		});
	});
});
