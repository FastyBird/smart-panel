import { Expose, Transform } from 'class-transformer';
import { IsString, useContainer } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { TokenOwnerType } from '../../auth/auth.constants';
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
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { IDevicePlatform } from '../platforms/device.platform';
import { ChannelExistsConstraintValidator } from '../validators/channel-exists-constraint.validator';
import { ChannelPropertyExistsConstraintValidator } from '../validators/channel-property-exists-constraint.validator';
import { DeviceExistsConstraintValidator } from '../validators/device-exists-constraint.validator';

import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { DevicesService } from './devices.service';
import { PlatformRegistryService } from './platform.registry.service';
import { PropertyCommandService } from './property-command.service';

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
	let mockPlatform: IDevicePlatform;
	let loggerErrorSpy: jest.SpyInstance;
	let loggerWarnSpy: jest.SpyInstance;
	let loggerLogSpy: jest.SpyInstance;

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
		value: false,
		channel: mockChannel.id,
		createdAt: new Date(),
		updatedAt: new Date(),
		mockValue: 'Some value',
	};

	const mockWsUser: ClientUserDto = {
		id: null,
		role: UserRole.USER,
		type: 'token',
		ownerType: TokenOwnerType.DISPLAY,
		tokenId: 'mock-token-id',
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				PropertyCommandService,
				DeviceExistsConstraintValidator,
				ChannelExistsConstraintValidator,
				ChannelPropertyExistsConstraintValidator,
				{
					provide: DevicesService,
					useValue: {
						findOne: jest.fn(() => {}),
					},
				},
				{
					provide: ChannelsService,
					useValue: {
						findOne: jest.fn(() => {}),
					},
				},
				{
					provide: ChannelsPropertiesService,
					useValue: {
						findOne: jest.fn(() => {}),
					},
				},
				{
					provide: PlatformRegistryService,
					useValue: { get: jest.fn() },
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

	it('should validate and process a valid command', async () => {
		jest.spyOn(devicesService, 'findOne').mockResolvedValue(toInstance(MockDevice, mockDevice));
		jest.spyOn(channelsService, 'findOne').mockResolvedValue(toInstance(MockChannel, mockChannel));
		jest
			.spyOn(channelsPropertiesService, 'findOne')
			.mockResolvedValue(toInstance(MockChannelProperty, mockChannelProperty));
		jest.spyOn(platformRegistryService, 'get').mockReturnValue(mockPlatform);
		jest.spyOn(mockPlatform, 'processBatch').mockResolvedValue(true);

		const result = await service.handleInternal(mockWsUser, validPayload);

		expect(result.success).toBe(true);
		expect(result.results).toEqual([{ device: mockDevice.id, success: true }]);
		expect(loggerLogSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				`[PropertyCommandService] Successfully executed batch command for deviceId=${mockDevice.id}`,
			),
			expect.objectContaining({ tag: 'devices-module' }),
		);
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
	});

	it('should return an error if device is not found', async () => {
		jest.spyOn(devicesService, 'findOne').mockResolvedValue(null);

		const result = await service.handleInternal(mockWsUser, validPayload);

		expect(result.success).toBe(false);
		expect(result.results).toEqual('Invalid payload');
	});

	it('should return an error if channel is not found', async () => {
		jest.spyOn(devicesService, 'findOne').mockResolvedValue(toInstance(MockDevice, mockDevice));
		jest.spyOn(channelsService, 'findOne').mockResolvedValue(null);

		const result = await service.handleInternal(mockWsUser, validPayload);

		expect(result.success).toBe(false);
		expect(result.results).toEqual('Invalid payload');
	});

	it('should return an error if property is not found', async () => {
		jest.spyOn(devicesService, 'findOne').mockResolvedValue(toInstance(MockDevice, mockDevice));
		jest.spyOn(channelsService, 'findOne').mockResolvedValue(toInstance(MockChannel, mockChannel));
		jest.spyOn(channelsPropertiesService, 'findOne').mockResolvedValue(null);

		const result = await service.handleInternal(mockWsUser, validPayload);

		expect(result.success).toBe(false);
		expect(result.results).toEqual('Invalid payload');
	});

	it('should return an error if platform is not registered', async () => {
		jest.spyOn(devicesService, 'findOne').mockResolvedValue(toInstance(MockDevice, mockDevice));
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
		jest.spyOn(devicesService, 'findOne').mockResolvedValue(toInstance(MockDevice, mockDevice));
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
	});

	describe('ACL permissions', () => {
		beforeEach(() => {
			jest.spyOn(devicesService, 'findOne').mockResolvedValue(toInstance(MockDevice, mockDevice));
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
			jest.spyOn(devicesService, 'findOne').mockResolvedValue(toInstance(MockDevice, mockDevice));
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
});
