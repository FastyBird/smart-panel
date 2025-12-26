/* eslint-disable @typescript-eslint/unbound-method */
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { SpaceLightingRoleEntity } from '../entities/space-lighting-role.entity';
import { SpaceEntity } from '../entities/space.entity';
import { LightingRole, SpaceType } from '../spaces.constants';
import { SpacesValidationException } from '../spaces.exceptions';

import { SpaceLightingRoleService } from './space-lighting-role.service';
import { SpacesService } from './spaces.service';

describe('SpaceLightingRoleService', () => {
	let service: SpaceLightingRoleService;
	let roleRepository: jest.Mocked<Repository<SpaceLightingRoleEntity>>;
	let deviceRepository: jest.Mocked<Repository<DeviceEntity>>;
	let spacesService: jest.Mocked<SpacesService>;

	const mockSpace: SpaceEntity = {
		id: uuid(),
		name: 'Living Room',
		description: 'Main living area',
		type: SpaceType.ROOM,
		icon: 'mdi:sofa',
		displayOrder: 0,
		primaryThermostatId: null,
		primaryTemperatureSensorId: null,
		createdAt: new Date(),
		updatedAt: null,
	};

	const mockChannel = {
		id: uuid(),
		name: 'Light',
		category: ChannelCategory.LIGHT,
		deviceId: '',
		device: undefined,
		properties: [],
		createdAt: new Date(),
		updatedAt: null,
	} as unknown as ChannelEntity;

	const mockOnProperty = {
		id: uuid(),
		name: 'On',
		category: PropertyCategory.ON,
		channelId: mockChannel.id,
		channel: undefined,
		value: true,
		dataType: 'boolean',
		format: null,
		unit: null,
		invalid: null,
		settable: true,
		queryable: true,
		createdAt: new Date(),
		updatedAt: null,
	} as unknown as ChannelPropertyEntity;

	const mockBrightnessProperty = {
		id: uuid(),
		name: 'Brightness',
		category: PropertyCategory.BRIGHTNESS,
		channelId: mockChannel.id,
		channel: undefined,
		value: 100,
		dataType: 'number',
		format: [0, 100],
		unit: '%',
		invalid: null,
		settable: true,
		queryable: true,
		createdAt: new Date(),
		updatedAt: null,
	} as unknown as ChannelPropertyEntity;

	const mockDevice = {
		id: uuid(),
		name: 'Ceiling Light',
		category: DeviceCategory.LIGHTING,
		type: 'shelly-ng',
		spaceId: mockSpace.id,
		space: mockSpace,
		channels: [{ ...mockChannel, properties: [mockOnProperty, mockBrightnessProperty] }],
		createdAt: new Date(),
		updatedAt: null,
	} as unknown as DeviceEntity;

	const mockRole: SpaceLightingRoleEntity = {
		id: uuid(),
		spaceId: mockSpace.id,
		space: mockSpace,
		deviceId: mockDevice.id,
		device: mockDevice,
		channelId: mockChannel.id,
		channel: mockChannel,
		role: LightingRole.MAIN,
		priority: 0,
		createdAt: new Date(),
		updatedAt: null,
	};

	beforeEach(async () => {
		// Reset mockRole to initial state before each test
		mockRole.role = LightingRole.MAIN;
		mockRole.priority = 0;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SpaceLightingRoleService,
				{
					provide: getRepositoryToken(SpaceLightingRoleEntity),
					useValue: {
						find: jest.fn().mockResolvedValue([mockRole]),
						findOne: jest.fn().mockResolvedValue(null),
						create: jest.fn().mockImplementation((data: Partial<SpaceLightingRoleEntity>) => ({ ...data, id: uuid() })),
						save: jest.fn().mockImplementation((entity: SpaceLightingRoleEntity) => entity),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: getRepositoryToken(DeviceEntity),
					useValue: {
						findOne: jest.fn().mockResolvedValue(mockDevice),
					},
				},
				{
					provide: SpacesService,
					useValue: {
						getOneOrThrow: jest.fn().mockResolvedValue(mockSpace),
						findDevicesBySpace: jest.fn().mockResolvedValue([mockDevice]),
					},
				},
			],
		}).compile();

		service = module.get<SpaceLightingRoleService>(SpaceLightingRoleService);
		roleRepository = module.get(getRepositoryToken(SpaceLightingRoleEntity));
		deviceRepository = module.get(getRepositoryToken(DeviceEntity));
		spacesService = module.get(SpacesService);
	});

	describe('findBySpace', () => {
		it('should return all lighting role assignments for a space', async () => {
			const result = await service.findBySpace(mockSpace.id);

			expect(result).toEqual([mockRole]);
			expect(spacesService.getOneOrThrow).toHaveBeenCalledWith(mockSpace.id);
			expect(roleRepository.find).toHaveBeenCalledWith({
				where: { spaceId: mockSpace.id },
				order: { role: 'ASC', priority: 'ASC' },
			});
		});
	});

	describe('setRole', () => {
		it('should create a new role assignment', async () => {
			const dto = {
				deviceId: mockDevice.id,
				channelId: mockChannel.id,
				role: LightingRole.MAIN,
				priority: 0,
			};

			const result = await service.setRole(mockSpace.id, dto);

			expect(result.role).toBe(LightingRole.MAIN);
			expect(roleRepository.create).toHaveBeenCalled();
			expect(roleRepository.save).toHaveBeenCalled();
		});

		it('should update an existing role assignment', async () => {
			roleRepository.findOne.mockResolvedValue(mockRole);

			const dto = {
				deviceId: mockDevice.id,
				channelId: mockChannel.id,
				role: LightingRole.AMBIENT,
				priority: 1,
			};

			const result = await service.setRole(mockSpace.id, dto);

			expect(result.role).toBe(LightingRole.AMBIENT);
			expect(roleRepository.save).toHaveBeenCalled();
		});

		it('should throw validation exception when device not found', async () => {
			deviceRepository.findOne.mockResolvedValue(null);

			const dto = {
				deviceId: uuid(),
				channelId: mockChannel.id,
				role: LightingRole.MAIN,
			};

			await expect(service.setRole(mockSpace.id, dto)).rejects.toThrow(SpacesValidationException);
		});

		it('should throw validation exception when device does not belong to space', async () => {
			const otherDevice = { ...mockDevice, spaceId: uuid() } as unknown as DeviceEntity;
			deviceRepository.findOne.mockResolvedValue(otherDevice);

			const dto = {
				deviceId: otherDevice.id,
				channelId: mockChannel.id,
				role: LightingRole.MAIN,
			};

			await expect(service.setRole(mockSpace.id, dto)).rejects.toThrow(SpacesValidationException);
		});

		it('should throw validation exception when channel not found on device', async () => {
			const deviceWithoutChannel = { ...mockDevice, channels: [] } as unknown as DeviceEntity;
			deviceRepository.findOne.mockResolvedValue(deviceWithoutChannel);

			const dto = {
				deviceId: mockDevice.id,
				channelId: uuid(),
				role: LightingRole.MAIN,
			};

			await expect(service.setRole(mockSpace.id, dto)).rejects.toThrow(SpacesValidationException);
		});
	});

	describe('bulkSetRoles', () => {
		it('should set multiple roles at once', async () => {
			const roles = [
				{
					deviceId: mockDevice.id,
					channelId: mockChannel.id,
					role: LightingRole.MAIN,
				},
			];

			const result = await service.bulkSetRoles(mockSpace.id, roles);

			expect(result).toBe(1);
		});

		it('should continue on errors and return count of successful updates', async () => {
			deviceRepository.findOne.mockResolvedValueOnce(mockDevice).mockResolvedValueOnce(null);

			const roles = [
				{
					deviceId: mockDevice.id,
					channelId: mockChannel.id,
					role: LightingRole.MAIN,
				},
				{
					deviceId: uuid(), // This one will fail
					channelId: uuid(),
					role: LightingRole.AMBIENT,
				},
			];

			const result = await service.bulkSetRoles(mockSpace.id, roles);

			expect(result).toBe(1);
		});
	});

	describe('deleteRole', () => {
		it('should delete an existing role assignment', async () => {
			roleRepository.findOne.mockResolvedValue(mockRole);

			await service.deleteRole(mockSpace.id, mockDevice.id, mockChannel.id);

			expect(roleRepository.remove).toHaveBeenCalledWith(mockRole);
		});

		it('should not throw when role does not exist', async () => {
			roleRepository.findOne.mockResolvedValue(null);

			await expect(service.deleteRole(mockSpace.id, mockDevice.id, mockChannel.id)).resolves.not.toThrow();
		});
	});

	describe('getLightTargetsInSpace', () => {
		it('should return light targets with their role assignments', async () => {
			const deviceWithLightChannel = {
				...mockDevice,
				channels: [
					{
						...mockChannel,
						deviceId: mockDevice.id,
						properties: [mockOnProperty, mockBrightnessProperty],
					} as unknown as ChannelEntity,
				],
			} as unknown as DeviceEntity;
			spacesService.findDevicesBySpace.mockResolvedValue([deviceWithLightChannel]);
			roleRepository.find.mockResolvedValue([mockRole]);

			const result = await service.getLightTargetsInSpace(mockSpace.id);

			expect(result).toHaveLength(1);
			expect(result[0].deviceId).toBe(mockDevice.id);
			expect(result[0].channelId).toBe(mockChannel.id);
			expect(result[0].hasBrightness).toBe(true);
			expect(result[0].role).toBe(LightingRole.MAIN);
		});

		it('should return null role for lights without assignments', async () => {
			const deviceWithLightChannel = {
				...mockDevice,
				channels: [
					{
						...mockChannel,
						deviceId: mockDevice.id,
						properties: [mockOnProperty],
					} as unknown as ChannelEntity,
				],
			} as unknown as DeviceEntity;
			spacesService.findDevicesBySpace.mockResolvedValue([deviceWithLightChannel]);
			roleRepository.find.mockResolvedValue([]); // No role assignments

			const result = await service.getLightTargetsInSpace(mockSpace.id);

			expect(result).toHaveLength(1);
			expect(result[0].role).toBeNull();
		});

		it('should skip non-lighting devices', async () => {
			const thermostatDevice = {
				...mockDevice,
				category: DeviceCategory.THERMOSTAT,
			} as unknown as DeviceEntity;
			spacesService.findDevicesBySpace.mockResolvedValue([thermostatDevice]);

			const result = await service.getLightTargetsInSpace(mockSpace.id);

			expect(result).toHaveLength(0);
		});

		it('should skip channels without ON property', async () => {
			const deviceWithoutOnProperty = {
				...mockDevice,
				channels: [
					{
						...mockChannel,
						properties: [mockBrightnessProperty], // No ON property
					} as unknown as ChannelEntity,
				],
			} as unknown as DeviceEntity;
			spacesService.findDevicesBySpace.mockResolvedValue([deviceWithoutOnProperty]);

			const result = await service.getLightTargetsInSpace(mockSpace.id);

			expect(result).toHaveLength(0);
		});
	});

	describe('inferDefaultLightingRoles', () => {
		it('should set first light as MAIN and rest as AMBIENT', async () => {
			const device1 = {
				...mockDevice,
				id: uuid(),
				name: 'Light 1',
				channels: [
					{
						...mockChannel,
						id: uuid(),
						properties: [mockOnProperty],
					} as unknown as ChannelEntity,
				],
			} as unknown as DeviceEntity;
			const device2 = {
				...mockDevice,
				id: uuid(),
				name: 'Light 2',
				channels: [
					{
						...mockChannel,
						id: uuid(),
						properties: [mockOnProperty],
					} as unknown as ChannelEntity,
				],
			} as unknown as DeviceEntity;
			spacesService.findDevicesBySpace.mockResolvedValue([device1, device2]);
			roleRepository.find.mockResolvedValue([]);

			const result = await service.inferDefaultLightingRoles(mockSpace.id);

			expect(result).toHaveLength(2);
			expect(result[0].role).toBe(LightingRole.MAIN);
			expect(result[1].role).toBe(LightingRole.AMBIENT);
		});

		it('should return empty array when no lights exist', async () => {
			spacesService.findDevicesBySpace.mockResolvedValue([]);
			roleRepository.find.mockResolvedValue([]);

			const result = await service.inferDefaultLightingRoles(mockSpace.id);

			expect(result).toHaveLength(0);
		});
	});

	describe('getRoleMap', () => {
		it('should return a map of device:channel to role entity', async () => {
			const result = await service.getRoleMap(mockSpace.id);

			expect(result).toBeInstanceOf(Map);
			expect(result.get(`${mockRole.deviceId}:${mockRole.channelId}`)).toBe(mockRole);
		});
	});

	describe('LightingRole enum validation', () => {
		it('should accept all valid lighting roles', async () => {
			const validRoles = [
				LightingRole.MAIN,
				LightingRole.TASK,
				LightingRole.AMBIENT,
				LightingRole.ACCENT,
				LightingRole.NIGHT,
				LightingRole.OTHER,
			];

			for (const role of validRoles) {
				const dto = {
					deviceId: mockDevice.id,
					channelId: mockChannel.id,
					role,
				};

				const result = await service.setRole(mockSpace.id, dto);
				expect(result.role).toBe(role);
			}
		});
	});

	describe('fallback behavior when roles are missing', () => {
		it('should return null role when no assignment exists', async () => {
			const deviceWithLightChannel = {
				...mockDevice,
				channels: [
					{
						...mockChannel,
						deviceId: mockDevice.id,
						properties: [mockOnProperty],
					} as unknown as ChannelEntity,
				],
			} as unknown as DeviceEntity;
			spacesService.findDevicesBySpace.mockResolvedValue([deviceWithLightChannel]);
			roleRepository.find.mockResolvedValue([]); // No role assignments

			const result = await service.getLightTargetsInSpace(mockSpace.id);

			expect(result[0].role).toBeNull();
			expect(result[0].priority).toBe(0); // Default priority
		});
	});
});
