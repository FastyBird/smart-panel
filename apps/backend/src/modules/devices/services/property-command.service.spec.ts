import { Expose, Transform } from 'class-transformer';
import { IsString, useContainer } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { TokenOwnerType } from '../../auth/auth.constants';
import { DEFAULT_TTL_DEVICE_COMMAND, INTENT_CLEANUP_INTERVAL } from '../../intents/intents.constants';
import { IntentsService } from '../../intents/services/intents.service';
import { UserRole } from '../../users/users.constants';
import { ClientUserDto } from '../../websocket/dto/client-user.dto';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../devices.constants';
import { PropertyCommandDto } from '../dto/property-command.dto';
import { UpdateChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { PropertyValueState } from '../models/property-value-state.model';
import { IDevicePlatform } from '../platforms/device.platform';
import { ChannelExistsConstraintValidator } from '../validators/channel-exists-constraint.validator';
import { ChannelPropertyExistsConstraintValidator } from '../validators/channel-property-exists-constraint.validator';
import { DeviceExistsConstraintValidator } from '../validators/device-exists-constraint.validator';

import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { CommandLatencyTraceCollectorService } from './command-latency-trace-collector.service';
import { DeviceStructureLockService } from './device-structure-lock.service';
import { DevicesService } from './devices.service';
import { PlatformRegistryService } from './platform.registry.service';
import { PropertyCommandDispatchService } from './property-command-dispatch.service';
import { PropertyCommandWindowService } from './property-command-window.service';
import { PropertyCommandService } from './property-command.service';
import { PropertyMetadataService } from './property-metadata.service';
import { PropertyStateCoordinatorService } from './property-state-coordinator.service';
import { PropertyValueSourceRegistryService } from './property-value-source.registry.service';
import { PropertyValueService } from './property-value.service';

class MockDevice extends DeviceEntity {
	@Expose({ name: 'mock_value' })
	@IsString()
	@Transform(({ obj }: { obj: { mock_value?: string; mockValue?: string } }) => obj.mock_value || obj.mockValue, {
		toClassOnly: true,
	})
	mockValue: string;

	@Expose()
	get type(): string {
		return 'mock';
	}
}

class MockChannel extends ChannelEntity {
	@Expose({ name: 'mock_value' })
	@IsString()
	@Transform(({ obj }: { obj: { mock_value?: string; mockValue?: string } }) => obj.mock_value || obj.mockValue, {
		toClassOnly: true,
	})
	mockValue: string;

	@Expose()
	get type(): string {
		return 'mock';
	}
}

class MockChannelProperty extends ChannelPropertyEntity {
	@Expose({ name: 'mock_value' })
	@IsString()
	@Transform(({ obj }: { obj: { mock_value?: string; mockValue?: string } }) => obj.mock_value || obj.mockValue, {
		toClassOnly: true,
	})
	mockValue: string;

	@Expose()
	get type(): string {
		return 'mock';
	}
}

describe('PropertyCommandService', () => {
	let service: PropertyCommandService;
	let devicesService: DevicesService;
	let channelsService: ChannelsService;
	let channelsPropertiesService: ChannelsPropertiesService;
	let platformRegistryService: PlatformRegistryService;
	let propertyCommandDispatchService: PropertyCommandDispatchService;
	let intentsService: IntentsService;
	let propertyCommandWindowService: PropertyCommandWindowService;
	let mockPlatform: IDevicePlatform;
	let loggerErrorSpy: jest.SpiedFunction<any>;
	let loggerWarnSpy: jest.SpiedFunction<any>;
	let loggerLogSpy: jest.SpiedFunction<any>;
	let traceCollector: { observeCommand: jest.Mock; bindWindow: jest.Mock };

	const mockDevice = {
		id: uuid().toString(),
		type: 'mock',
		category: DeviceCategory.GENERIC,
		identifier: null,
		name: 'Test Device',
		description: null,
		enabled: true,
		roomId: null,
		room: null,
		deviceZones: [],
		status: {
			online: true,
			status: ConnectionState.CONNECTED,
		},
		createdAt: new Date(),
		updatedAt: new Date(),
		controls: [],
		channels: [],
		mockValue: 'Some value',
	};

	const mockChannel: MockChannel = {
		id: uuid().toString(),
		type: 'mock',
		category: ChannelCategory.GENERIC,
		identifier: null,
		name: 'Test Channel',
		description: 'Test description',
		createdAt: new Date(),
		updatedAt: new Date(),
		device: mockDevice.id,
		parentId: null,
		parent: null,
		children: [],
		controls: [],
		properties: [],
		mockValue: 'Some value',
	};

	const mockChannelProperty: MockChannelProperty = {
		id: uuid().toString(),
		type: 'mock',
		name: 'Test Property',
		category: PropertyCategory.GENERIC,
		identifier: null,
		permissions: [PermissionType.READ_WRITE],
		dataType: DataTypeType.BOOL,
		unit: null,
		format: null,
		invalid: null,
		step: null,
		value: new PropertyValueState(false),
		channel: mockChannel.id,
		createdAt: new Date(),
		updatedAt: new Date(),
		mockValue: 'Some value',
	};

	const deviceWithProperties = (
		properties: ChannelPropertyEntity[] = [toInstance(MockChannelProperty, mockChannelProperty)],
	): MockDevice => {
		const device = toInstance(MockDevice, mockDevice);
		const channel = toInstance(MockChannel, mockChannel);
		channel.device = device;
		channel.properties = properties;
		device.channels = [channel];

		return device;
	};

	const mockWsUser: ClientUserDto = {
		id: null,
		role: UserRole.USER,
		type: 'token',
		ownerType: TokenOwnerType.DISPLAY,
		tokenId: 'mock-token-id',
	};

	beforeEach(async () => {
		traceCollector = { observeCommand: jest.fn(), bindWindow: jest.fn() };
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				PropertyCommandService,
				PropertyCommandDispatchService,
				// Preparation and admission read the same fixture catalog; SQLite cache behavior has integration coverage.
				{ provide: PropertyMetadataService, useExisting: ChannelsPropertiesService },
				{
					provide: PropertyValueService,
					useValue: {
						readLatest: jest.fn((property: ChannelPropertyEntity) => Promise.resolve(property.value ?? null)),
					},
				},
				PropertyCommandWindowService,
				PropertyValueSourceRegistryService,
				DeviceStructureLockService,
				PropertyStateCoordinatorService,
				{ provide: CommandLatencyTraceCollectorService, useValue: traceCollector },
				DeviceExistsConstraintValidator,
				ChannelExistsConstraintValidator,
				ChannelPropertyExistsConstraintValidator,
				{
					provide: DevicesService,
					useValue: {
						exists: jest.fn().mockResolvedValue(true),
						findOne: jest.fn(() => {}),
						findIdentity: jest.fn().mockResolvedValue({ id: mockDevice.id, type: mockDevice.type }),
					},
				},
				{
					provide: ChannelsService,
					useValue: {
						exists: jest.fn().mockResolvedValue(true),
						findOne: jest.fn(() => {}),
					},
				},
				{
					provide: ChannelsPropertiesService,
					useValue: {
						exists: jest.fn().mockResolvedValue(true),
						findOne: jest.fn(() => {}),
					},
				},
				{
					provide: PlatformRegistryService,
					useValue: {
						get: jest.fn(),
						getCommandTtlMs: jest.fn().mockReturnValue(DEFAULT_TTL_DEVICE_COMMAND),
						usesAuthoritativePropertyReadback: jest.fn().mockReturnValue(false),
					},
				},
				{
					provide: IntentsService,
					useValue: {
						createIntent: jest.fn().mockReturnValue({ id: 'mock-intent-id' }),
						completeIntent: jest.fn(),
					},
				},
			],
		}).compile();

		useContainer(module, { fallbackOnErrors: true });

		service = module.get<PropertyCommandService>(PropertyCommandService);
		devicesService = module.get<DevicesService>(DevicesService);
		channelsService = module.get<ChannelsService>(ChannelsService);
		channelsPropertiesService = module.get<ChannelsPropertiesService>(ChannelsPropertiesService);
		platformRegistryService = module.get<PlatformRegistryService>(PlatformRegistryService);
		propertyCommandDispatchService = module.get<PropertyCommandDispatchService>(PropertyCommandDispatchService);
		intentsService = module.get<IntentsService>(IntentsService);
		propertyCommandWindowService = module.get<PropertyCommandWindowService>(PropertyCommandWindowService);

		mockPlatform = {
			getType: jest.fn().mockReturnValue('mock'),
			process: jest.fn(),
			processBatch: jest.fn(),
		};

		loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
		loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
		loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	const validPayload: PropertyCommandDto = {
		request_id: '550e8400-e29b-41d4-a716-446655440000',
		properties: [
			{
				device: mockDevice.id,
				channel: mockChannel.id,
				property: mockChannelProperty.id,
				value: true,
			},
		],
	};

	it('evaluates authoritative readback against the merged property update', async () => {
		const device = deviceWithProperties();
		const property = toInstance(MockChannelProperty, { ...mockChannelProperty, mockValue: 'readable' });
		const update = {
			type: 'mock',
			value: true,
			mockValue: 'write-only',
		} as UpdateChannelPropertyDto & { mockValue: string };
		const readbackSpy = jest
			.spyOn(platformRegistryService, 'usesAuthoritativePropertyReadback')
			.mockImplementation((_device, effectiveProperty) => {
				expect(effectiveProperty).toBeInstanceOf(MockChannelProperty);
				expect((effectiveProperty as MockChannelProperty).mockValue).toBe('write-only');
				expect(property.mockValue).toBe('readable');

				return false;
			});

		await expect(service.usesAuthoritativePropertyReadback(device, property, update)).resolves.toBe(false);
		expect(readbackSpy).toHaveBeenCalledWith(device, expect.objectContaining({ value: true }));
	});

	it('treats API receipt preparation exceptions as command-only dispatches', async () => {
		const device = deviceWithProperties();
		const channel = toInstance(MockChannel, mockChannel);
		const property = toInstance(MockChannelProperty, mockChannelProperty);
		jest.spyOn(devicesService, 'findOne').mockResolvedValue(device);
		jest
			.spyOn(propertyCommandDispatchService, 'prepareApiCommand')
			.mockRejectedValue(new Error('admission unavailable'));

		await expect(service.prepareApiPropertyCommand(device, channel, property, true)).resolves.toBeNull();
		expect(loggerWarnSpy).toHaveBeenCalledWith(
			expect.stringContaining('Could not prepare optimistic receipt'),
			expect.objectContaining({ tag: 'devices-module' }),
		);
	});

	it('should validate and process a valid command', async () => {
		const device = deviceWithProperties();
		const channel = toInstance(MockChannel, mockChannel);
		channel.device = device;
		const property = toInstance(MockChannelProperty, mockChannelProperty);
		property.channel = channel;
		channel.properties = [property];
		device.channels = [channel];
		jest.spyOn(devicesService, 'findOne').mockResolvedValue(device);
		jest.spyOn(channelsService, 'findOne').mockResolvedValue(channel);
		jest.spyOn(channelsPropertiesService, 'findOne').mockResolvedValue(property);
		jest.spyOn(platformRegistryService, 'get').mockReturnValue(mockPlatform);
		jest.spyOn(mockPlatform, 'processBatch').mockResolvedValue(true);
		const ttlSpy = jest
			.spyOn(platformRegistryService, 'getCommandTtlMs')
			.mockReturnValue(12000 + DEFAULT_TTL_DEVICE_COMMAND + INTENT_CLEANUP_INTERVAL);

		const result = await service.handleInternal(mockWsUser, validPayload);

		expect(result.success).toBe(true);
		expect(result.results).toEqual([{ device: mockDevice.id, success: true }]);
		// The timeout budget must not hydrate the same device graph before actual execution.
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(devicesService.findOne).toHaveBeenCalledTimes(1);
		const [budgets, defaultTtlMs] = ttlSpy.mock.calls[0];
		expect(budgets).toHaveLength(1);
		expect(budgets[0]?.device).toEqual({ id: mockDevice.id, type: mockDevice.type });
		expect(budgets[0]?.commandCount).toBe(1);
		expect(defaultTtlMs).toBe(DEFAULT_TTL_DEVICE_COMMAND);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(intentsService.createIntent).toHaveBeenCalledWith(
			expect.objectContaining({
				ttlMs: 12000 + DEFAULT_TTL_DEVICE_COMMAND + INTENT_CLEANUP_INTERVAL,
			}),
		);
		expect(loggerLogSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				`[PropertyCommandService] Successfully executed batch command for deviceId=${mockDevice.id}`,
			),
			expect.objectContaining({ tag: 'devices-module' }),
		);
		expect(traceCollector.observeCommand).toHaveBeenCalledWith({
			requestId: validPayload.request_id,
			intentId: 'mock-intent-id',
			properties: validPayload.properties,
		});
	});

	it.each(['missing', 'read failure'] as const)(
		'keeps execution validation when budget metadata has a %s',
		async (mode) => {
			const metadata = jest.spyOn(channelsPropertiesService, 'findOne');
			if (mode === 'missing') {
				metadata.mockResolvedValue(null);
			} else {
				metadata.mockRejectedValue(new Error('metadata unavailable'));
			}
			jest.spyOn(devicesService, 'findOne').mockResolvedValue(null);

			const result = await service.handleInternal(mockWsUser, validPayload);

			expect(result).toEqual({
				success: false,
				results: [{ device: mockDevice.id, success: false, reason: 'Device not found' }],
			});
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(intentsService.createIntent).toHaveBeenCalledWith(
				expect.objectContaining({ ttlMs: DEFAULT_TTL_DEVICE_COMMAND }),
			);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(devicesService.findOne).toHaveBeenCalledWith(mockDevice.id);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockPlatform.processBatch).not.toHaveBeenCalled();
		},
	);

	it.each(['device', 'channel'] as const)('ignores budget metadata with a different %s parent', async (parent) => {
		const device = toInstance(MockDevice, { ...mockDevice, id: parent === 'device' ? uuid() : mockDevice.id });
		const channel = toInstance(MockChannel, { ...mockChannel, id: parent === 'channel' ? uuid() : mockChannel.id });
		channel.device = device;
		const property = toInstance(MockChannelProperty, mockChannelProperty);
		property.channel = channel;
		jest.spyOn(channelsPropertiesService, 'findOne').mockResolvedValue(property);
		jest.spyOn(devicesService, 'findOne').mockResolvedValue(null);
		const budget = jest.spyOn(platformRegistryService, 'getCommandTtlMs');

		await service.handleInternal(mockWsUser, validPayload);

		expect(budget).toHaveBeenCalledWith([], DEFAULT_TTL_DEVICE_COMMAND);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockPlatform.processBatch).not.toHaveBeenCalled();
	});

	it('should return an error if validation fails', async () => {
		const invalidPayload = { properties: [{ device: 'invalid-id' }] };

		const result = await service.handleInternal(mockWsUser, invalidPayload);

		expect(result.success).toBe(false);
		expect(result.results).toBe('Invalid payload');
		expect(loggerErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining('[PropertyCommandService] Command validation failed'),
			undefined,
			expect.objectContaining({ tag: 'devices-module' }),
		);
		expect(propertyCommandWindowService.get(mockChannelProperty.id)).toBeNull();
	});

	it('should return an error if device is not found', async () => {
		jest.spyOn(devicesService, 'exists').mockResolvedValue(false);
		jest.spyOn(devicesService, 'findOne').mockResolvedValue(null);

		const result = await service.handleInternal(mockWsUser, validPayload);

		expect(result.success).toBe(false);
		expect(result.results).toEqual('Invalid payload');
	});

	it('should return an error if channel is not found', async () => {
		jest.spyOn(devicesService, 'findOne').mockResolvedValue(deviceWithProperties());
		jest.spyOn(channelsService, 'exists').mockResolvedValue(false);
		jest.spyOn(channelsService, 'findOne').mockResolvedValue(null);

		const result = await service.handleInternal(mockWsUser, validPayload);

		expect(result.success).toBe(false);
		expect(result.results).toEqual('Invalid payload');
	});

	it('should return an error if property is not found', async () => {
		jest.spyOn(devicesService, 'findOne').mockResolvedValue(deviceWithProperties());
		jest.spyOn(channelsService, 'findOne').mockResolvedValue(toInstance(MockChannel, mockChannel));
		jest.spyOn(channelsPropertiesService, 'exists').mockResolvedValue(false);
		jest.spyOn(channelsPropertiesService, 'findOne').mockResolvedValue(null);

		const result = await service.handleInternal(mockWsUser, validPayload);

		expect(result.success).toBe(false);
		expect(result.results).toEqual('Invalid payload');
	});

	it.each(['channel', 'property'] as const)(
		'rejects a %s removed or reparented after existence validation',
		async (target) => {
			const device = deviceWithProperties();
			if (target === 'channel') {
				device.channels = [];
			} else {
				device.channels[0].properties = [];
				jest.spyOn(channelsPropertiesService, 'findOne').mockResolvedValue(null);
			}
			jest.spyOn(devicesService, 'findOne').mockResolvedValue(device);
			jest.spyOn(platformRegistryService, 'get').mockReturnValue(mockPlatform);

			const result = await service.handleInternal(mockWsUser, validPayload);

			expect(result).toEqual({
				success: false,
				results: [
					{ device: device.id, success: false, reason: `${target === 'channel' ? 'Channel' : 'Property'} not found` },
				],
			});
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockPlatform.processBatch).not.toHaveBeenCalled();
		},
	);

	it('rejects an invalid value after selecting the channel from the fresh device graph', async () => {
		jest.spyOn(devicesService, 'findOne').mockResolvedValue(deviceWithProperties());
		jest.spyOn(platformRegistryService, 'get').mockReturnValue(mockPlatform);

		jest
			.spyOn(channelsPropertiesService, 'findOne')
			.mockResolvedValue(toInstance(MockChannelProperty, mockChannelProperty));

		const result = await service.handleInternal(mockWsUser, {
			...validPayload,
			properties: [{ ...validPayload.properties[0], value: 'not-a-boolean' }],
		});

		expect(result.success).toBe(false);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockPlatform.processBatch).not.toHaveBeenCalled();
	});

	it('should return an error if platform is not registered', async () => {
		jest.spyOn(devicesService, 'findOne').mockResolvedValue(deviceWithProperties());
		jest.spyOn(channelsService, 'findOne').mockResolvedValue(toInstance(MockChannel, mockChannel));
		jest
			.spyOn(channelsPropertiesService, 'findOne')
			.mockResolvedValue(toInstance(MockChannelProperty, mockChannelProperty));
		jest.spyOn(platformRegistryService, 'get').mockReturnValue(null);

		const result = await service.handleInternal(mockWsUser, validPayload);

		expect(result.success).toBe(false);
		expect(result.results).toEqual([{ device: mockDevice.id, success: false, reason: 'Unsupported device type' }]);
		expect(loggerWarnSpy).toHaveBeenCalledWith(
			`[PropertyCommandService] No platform registered for device id=${mockDevice.id} type=mock`,
			expect.objectContaining({ tag: 'devices-module' }),
		);
	});

	it('should return an error if batch execution fails', async () => {
		jest.spyOn(devicesService, 'findOne').mockResolvedValue(deviceWithProperties());
		jest.spyOn(channelsService, 'findOne').mockResolvedValue(toInstance(MockChannel, mockChannel));
		jest
			.spyOn(channelsPropertiesService, 'findOne')
			.mockResolvedValue(toInstance(MockChannelProperty, mockChannelProperty));
		jest.spyOn(platformRegistryService, 'get').mockReturnValue(mockPlatform);
		jest.spyOn(mockPlatform, 'processBatch').mockResolvedValue(false);

		const result = await service.handleInternal(mockWsUser, validPayload);

		expect(result.success).toBe(false);
		expect(result.results).toEqual([{ device: mockDevice.id, success: false, reason: 'Execution failed' }]);
		expect(loggerErrorSpy).toHaveBeenCalledWith(
			`[PropertyCommandService] Batch command execution failed for deviceId=${mockDevice.id}`,
			undefined,
			expect.objectContaining({ tag: 'devices-module' }),
		);
		expect(propertyCommandWindowService.get(mockChannelProperty.id)).toBeNull();
	});

	it('executes a property-id command through validation, intent tracking, and batch dispatch', async () => {
		const device = { ...mockDevice } as unknown as MockDevice;
		const channel = { ...mockChannel, device } as unknown as MockChannel;
		const property = { ...mockChannelProperty, channel } as unknown as MockChannelProperty;
		channel.properties = [property];
		device.channels = [channel];

		jest.spyOn(devicesService, 'findOne').mockResolvedValue(device);
		jest.spyOn(channelsService, 'findOne').mockResolvedValue(channel);
		jest.spyOn(channelsPropertiesService, 'findOne').mockResolvedValue(property);
		jest.spyOn(platformRegistryService, 'get').mockReturnValue(mockPlatform);
		jest.spyOn(mockPlatform, 'processBatch').mockResolvedValue(true);

		const result = await service.executePropertyCommandById(property.id, 'true', {
			requestId: 'request-1',
			context: { origin: 'api', extra: { source: 'mcp' } },
		});

		expect(result).toEqual(
			expect.objectContaining({
				device: device.id,
				channel: channel.id,
				property: property.id,
				value: true,
				success: true,
			}),
		);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockPlatform.processBatch).toHaveBeenCalledWith([
			expect.objectContaining({ device, channel, property, value: true }),
		]);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(intentsService.createIntent).toHaveBeenCalledWith(
			expect.objectContaining({
				requestId: 'request-1',
				context: { origin: 'api', extra: { source: 'mcp' } },
			}),
		);
		const window = propertyCommandWindowService.get(property.id);
		expect(window?.commandedValue).toBe(true);
		expect(window?.canonicalTarget.propertyId).toBe(property.id);
	});

	it('should reject writes to read-only properties before platform dispatch', async () => {
		const readOnlyProperty = { ...mockChannelProperty, permissions: [PermissionType.READ_ONLY] };

		jest
			.spyOn(devicesService, 'findOne')
			.mockResolvedValue(deviceWithProperties([toInstance(MockChannelProperty, readOnlyProperty)]));
		jest.spyOn(channelsService, 'findOne').mockResolvedValue(toInstance(MockChannel, mockChannel));
		jest
			.spyOn(channelsPropertiesService, 'findOne')
			.mockResolvedValue(toInstance(MockChannelProperty, readOnlyProperty));
		jest.spyOn(platformRegistryService, 'get').mockReturnValue(mockPlatform);

		const result = await service.handleInternal(mockWsUser, validPayload);

		expect(result).toEqual({
			success: false,
			results: [{ device: mockDevice.id, success: false, reason: 'Property is not writable' }],
		});
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockPlatform.processBatch).not.toHaveBeenCalled();
	});

	describe('ACL permissions', () => {
		beforeEach(() => {
			jest.spyOn(devicesService, 'findOne').mockResolvedValue(deviceWithProperties());
			jest.spyOn(channelsService, 'findOne').mockResolvedValue(toInstance(MockChannel, mockChannel));
			jest
				.spyOn(channelsPropertiesService, 'findOne')
				.mockResolvedValue(toInstance(MockChannelProperty, mockChannelProperty));
			jest.spyOn(platformRegistryService, 'get').mockReturnValue(mockPlatform);
			jest.spyOn(mockPlatform, 'processBatch').mockResolvedValue(true);
		});

		it('should allow admin users to execute commands', async () => {
			const adminUser: ClientUserDto = {
				id: uuid().toString(),
				role: UserRole.ADMIN,
				type: 'user',
			};

			const result = await service.handleInternal(adminUser, validPayload);

			expect(result.success).toBe(true);
		});

		it('should allow owner users to execute commands', async () => {
			const ownerUser: ClientUserDto = {
				id: uuid().toString(),
				role: UserRole.OWNER,
				type: 'user',
			};

			const result = await service.handleInternal(ownerUser, validPayload);

			expect(result.success).toBe(true);
		});

		it('should reject regular users', async () => {
			const regularUser: ClientUserDto = {
				id: uuid().toString(),
				role: UserRole.USER,
				type: 'user',
			};

			await expect(service.handleInternal(regularUser, validPayload)).rejects.toThrow(
				'This action is not allowed for this user',
			);
		});

		it('should reject third-party tokens', async () => {
			const thirdPartyToken: ClientUserDto = {
				id: uuid().toString(),
				role: UserRole.USER,
				type: 'token',
				ownerType: TokenOwnerType.THIRD_PARTY,
				tokenId: 'third-party-token-id',
			};

			await expect(service.handleInternal(thirdPartyToken, validPayload)).rejects.toThrow(
				'This action is not allowed for this user',
			);
		});
	});

	describe('offline device handling', () => {
		it('should reject commands to offline devices', async () => {
			const offlineDevice = {
				...mockDevice,
				id: uuid().toString(),
				status: {
					online: false,
					status: ConnectionState.DISCONNECTED,
				},
			};

			jest.spyOn(devicesService, 'findOne').mockResolvedValue(toInstance(MockDevice, offlineDevice));
			jest.spyOn(channelsService, 'findOne').mockResolvedValue(toInstance(MockChannel, mockChannel));
			jest
				.spyOn(channelsPropertiesService, 'findOne')
				.mockResolvedValue(toInstance(MockChannelProperty, mockChannelProperty));

			const offlinePayload: PropertyCommandDto = {
				request_id: '550e8400-e29b-41d4-a716-446655440000',
				properties: [
					{
						device: offlineDevice.id,
						channel: mockChannel.id,
						property: mockChannelProperty.id,
						value: true,
					},
				],
			};

			const result = await service.handleInternal(mockWsUser, offlinePayload);

			expect(result.success).toBe(false);
			expect(result.results).toEqual([{ device: offlineDevice.id, success: false, reason: 'Device is offline' }]);
			expect(loggerWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Device is offline'),
				expect.objectContaining({ tag: 'devices-module' }),
			);
		});

		it('should process commands to online devices normally', async () => {
			jest.spyOn(devicesService, 'findOne').mockResolvedValue(deviceWithProperties());
			jest.spyOn(channelsService, 'findOne').mockResolvedValue(toInstance(MockChannel, mockChannel));
			jest
				.spyOn(channelsPropertiesService, 'findOne')
				.mockResolvedValue(toInstance(MockChannelProperty, mockChannelProperty));
			jest.spyOn(platformRegistryService, 'get').mockReturnValue(mockPlatform);
			jest.spyOn(mockPlatform, 'processBatch').mockResolvedValue(true);

			const result = await service.handleInternal(mockWsUser, validPayload);

			expect(result.success).toBe(true);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockPlatform.processBatch).toHaveBeenCalled();
		});
	});

	describe('executePropertyCommands', () => {
		it('should reject batch commands across multiple devices', async () => {
			const deviceA = toInstance(MockDevice, { ...mockDevice, id: 'dev-a' });
			const deviceB = toInstance(MockDevice, { ...mockDevice, id: 'dev-b' });

			const channelA = toInstance(MockChannel, { ...mockChannel, id: 'chan-a', device: deviceA.id });
			const channelB = toInstance(MockChannel, { ...mockChannel, id: 'chan-b', device: deviceB.id });

			const propA = toInstance(MockChannelProperty, {
				...mockChannelProperty,
				id: 'prop-a',
				channel: channelA.id,
				permissions: [PermissionType.READ_WRITE],
			});
			const propB = toInstance(MockChannelProperty, {
				...mockChannelProperty,
				id: 'prop-b',
				channel: channelB.id,
				permissions: [PermissionType.READ_WRITE],
			});

			jest.spyOn(channelsPropertiesService, 'findOne').mockImplementation((id) => {
				if (id === 'prop-a') return Promise.resolve(propA);
				if (id === 'prop-b') return Promise.resolve(propB);
				return Promise.resolve(null);
			});

			jest.spyOn(channelsService, 'findOne').mockImplementation((id) => {
				if (id === 'chan-a') return Promise.resolve(channelA);
				if (id === 'chan-b') return Promise.resolve(channelB);
				return Promise.resolve(null);
			});

			jest.spyOn(devicesService, 'findOne').mockImplementation((id) => {
				if (id === 'dev-a') return Promise.resolve(deviceA);
				if (id === 'dev-b') return Promise.resolve(deviceB);
				return Promise.resolve(null);
			});

			const result = await service.executePropertyCommands([
				{ propertyId: 'prop-a', value: true },
				{ propertyId: 'prop-b', value: false },
			]);

			expect(result.success).toBe(false);
			expect(result.results[0].reason).toContain('Single-device batch execution violation');
		});

		it('should reject non-writable properties in batch', async () => {
			const readOnlyProp = toInstance(MockChannelProperty, {
				...mockChannelProperty,
				id: 'prop-ro',
				channel: mockChannel.id,
				permissions: [PermissionType.READ_ONLY],
			});

			jest.spyOn(channelsPropertiesService, 'findOne').mockResolvedValue(readOnlyProp);
			jest.spyOn(channelsService, 'findOne').mockResolvedValue(toInstance(MockChannel, mockChannel));
			jest.spyOn(devicesService, 'findOne').mockResolvedValue(deviceWithProperties());

			const result = await service.executePropertyCommands([{ propertyId: 'prop-ro', value: true }]);

			expect(result.success).toBe(false);
			expect(result.results[0].reason).toContain('Property is not writable');
		});

		it('should reject unknown property in batch', async () => {
			jest.spyOn(channelsPropertiesService, 'findOne').mockResolvedValue(null);

			const result = await service.executePropertyCommands([{ propertyId: 'prop-unknown', value: true }]);

			expect(result.success).toBe(false);
			expect(result.results[0].reason).toContain('Property not found');
		});

		it('should successfully execute batch commands on same device', async () => {
			const propA = toInstance(MockChannelProperty, {
				...mockChannelProperty,
				id: 'prop-1',
				channel: mockChannel.id,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			});
			const propB = toInstance(MockChannelProperty, {
				...mockChannelProperty,
				id: 'prop-2',
				channel: mockChannel.id,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			});

			jest.spyOn(channelsPropertiesService, 'findOne').mockImplementation((id) => {
				if (id === 'prop-1') return Promise.resolve(propA);
				if (id === 'prop-2') return Promise.resolve(propB);
				return Promise.resolve(null);
			});

			jest.spyOn(channelsService, 'findOne').mockResolvedValue(toInstance(MockChannel, mockChannel));
			jest.spyOn(devicesService, 'findOne').mockResolvedValue(deviceWithProperties([propA, propB]));
			jest.spyOn(platformRegistryService, 'get').mockReturnValue(mockPlatform);
			jest.spyOn(mockPlatform, 'processBatch').mockResolvedValue(true);

			const result = await service.executePropertyCommands([
				{ propertyId: 'prop-1', value: true },
				{ propertyId: 'prop-2', value: false },
			]);

			expect(result.success).toBe(true);
			expect(result.results).toHaveLength(2);
			expect(result.results[0].success).toBe(true);
			expect(result.results[1].success).toBe(true);
		});
	});
});
