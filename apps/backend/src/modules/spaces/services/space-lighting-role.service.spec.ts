/* eslint-disable @typescript-eslint/unbound-method */
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
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

	// Mock functions for transactional manager - configurable per test
	let transactionalFindOne: jest.Mock;
	let transactionalUpsert: jest.Mock;

	const mockSpace: SpaceEntity = {
		id: uuid(),
		name: 'Living Room',
		description: 'Main living area',
		type: SpaceType.ROOM,
		category: null,
		icon: 'mdi:sofa',
		displayOrder: 0,
		primaryThermostatId: null,
		primaryTemperatureSensorId: null,
		suggestionsEnabled: true,
		lastActivityAt: null,
		parentId: null,
		parent: null,
		children: [],
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
		roomId: mockSpace.id,
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

		// Initialize transactional manager mocks
		// Default: first findOne returns null (create case), second returns mockRole
		transactionalFindOne = jest.fn()
			.mockResolvedValueOnce(null) // First call: check if exists (returns null = create)
			.mockResolvedValue(mockRole); // Second call: fetch after upsert
		transactionalUpsert = jest.fn().mockResolvedValue(undefined);

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
						upsert: jest.fn().mockResolvedValue(undefined),
						remove: jest.fn().mockResolvedValue(undefined),
						manager: {
							transaction: jest.fn().mockImplementation(async (callback) => {
								const transactionalManager = {
									findOne: transactionalFindOne,
									upsert: transactionalUpsert,
								};
								return callback(transactionalManager);
							}),
						},
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
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(),
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
			// Default mocks: first findOne returns null (create), second returns mockRole
			// This is already set up in beforeEach

			const dto = {
				deviceId: mockDevice.id,
				channelId: mockChannel.id,
				role: LightingRole.MAIN,
				priority: 0,
			};

			const result = await service.setRole(mockSpace.id, dto);

			expect(result.role).toBe(LightingRole.MAIN);
			expect(transactionalUpsert).toHaveBeenCalledWith(
				SpaceLightingRoleEntity,
				{
					spaceId: mockSpace.id,
					deviceId: dto.deviceId,
					channelId: dto.channelId,
					role: dto.role,
					priority: dto.priority,
				},
				{
					conflictPaths: ['spaceId', 'deviceId', 'channelId'],
					skipUpdateIfNoValuesChanged: true,
				},
			);
		});

		it('should update an existing role assignment', async () => {
			const updatedRole = { ...mockRole, role: LightingRole.AMBIENT, priority: 1 };

			// Configure mocks for update case: first findOne returns existing role, second returns updated role
			transactionalFindOne
				.mockReset()
				.mockResolvedValueOnce(mockRole) // First call: exists (update case)
				.mockResolvedValue(updatedRole); // Second call: fetch after upsert

			const dto = {
				deviceId: mockDevice.id,
				channelId: mockChannel.id,
				role: LightingRole.AMBIENT,
				priority: 1,
			};

			const result = await service.setRole(mockSpace.id, dto);

			expect(result.role).toBe(LightingRole.AMBIENT);
			expect(transactionalUpsert).toHaveBeenCalled();
		});

		it('should handle update with no value changes', async () => {
			// Configure mocks: role exists with same values, upsert returns same role
			transactionalFindOne
				.mockReset()
				.mockResolvedValueOnce(mockRole) // First call: exists (update case)
				.mockResolvedValue(mockRole); // Second call: fetch after upsert (unchanged)

			const dto = {
				deviceId: mockDevice.id,
				channelId: mockChannel.id,
				role: mockRole.role, // Same role as existing
				priority: mockRole.priority, // Same priority as existing
			};

			const result = await service.setRole(mockSpace.id, dto);

			// Should succeed and return the existing role
			expect(result.role).toBe(mockRole.role);
			expect(result.priority).toBe(mockRole.priority);

			// Upsert should still be called with skipUpdateIfNoValuesChanged option
			expect(transactionalUpsert).toHaveBeenCalledWith(
				SpaceLightingRoleEntity,
				expect.objectContaining({
					role: mockRole.role,
					priority: mockRole.priority,
				}),
				expect.objectContaining({
					skipUpdateIfNoValuesChanged: true,
				}),
			);
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
			const otherDevice = { ...mockDevice, roomId: uuid() } as unknown as DeviceEntity;
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
			// Mock findOne to return the role after upsert
			roleRepository.findOne.mockResolvedValue(mockRole);

			const roles = [
				{
					deviceId: mockDevice.id,
					channelId: mockChannel.id,
					role: LightingRole.MAIN,
				},
			];

			const result = await service.bulkSetRoles(mockSpace.id, roles);

			expect(result.success).toBe(true);
			expect(result.totalCount).toBe(1);
			expect(result.successCount).toBe(1);
			expect(result.failureCount).toBe(0);
			expect(result.results).toHaveLength(1);
			expect(result.results[0].success).toBe(true);
			expect(result.results[0].deviceId).toBe(mockDevice.id);
			expect(result.results[0].channelId).toBe(mockChannel.id);
			expect(result.results[0].role).toBe(LightingRole.MAIN);
		});

		it('should continue on errors and return detailed results', async () => {
			// First call succeeds (device found, findOne returns role)
			// Second call fails (device not found)
			deviceRepository.findOne.mockResolvedValueOnce(mockDevice).mockResolvedValueOnce(null);
			roleRepository.findOne.mockResolvedValue(mockRole);

			const failingDeviceId = uuid();
			const failingChannelId = uuid();
			const roles = [
				{
					deviceId: mockDevice.id,
					channelId: mockChannel.id,
					role: LightingRole.MAIN,
				},
				{
					deviceId: failingDeviceId, // This one will fail
					channelId: failingChannelId,
					role: LightingRole.AMBIENT,
				},
			];

			const result = await service.bulkSetRoles(mockSpace.id, roles);

			expect(result.success).toBe(false);
			expect(result.totalCount).toBe(2);
			expect(result.successCount).toBe(1);
			expect(result.failureCount).toBe(1);
			expect(result.results).toHaveLength(2);
			expect(result.results[0].success).toBe(true);
			expect(result.results[0].role).toBe(LightingRole.MAIN);
			expect(result.results[1].success).toBe(false);
			expect(result.results[1].deviceId).toBe(failingDeviceId);
			expect(result.results[1].error).toBeDefined();
		});
	});

	describe('deleteRole', () => {
		it('should delete an existing role assignment', async () => {
			roleRepository.findOne.mockResolvedValue(mockRole);

			await service.deleteRole(mockSpace.id, mockDevice.id, mockChannel.id);

			expect(spacesService.getOneOrThrow).toHaveBeenCalledWith(mockSpace.id);
			expect(roleRepository.remove).toHaveBeenCalledWith(mockRole);
		});

		it('should not throw when role does not exist', async () => {
			roleRepository.findOne.mockResolvedValue(null);

			await expect(service.deleteRole(mockSpace.id, mockDevice.id, mockChannel.id)).resolves.not.toThrow();
			expect(spacesService.getOneOrThrow).toHaveBeenCalledWith(mockSpace.id);
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
				// Reset and configure transactional mock for each role
				const roleWithValue = { ...mockRole, role };
				transactionalFindOne
					.mockReset()
					.mockResolvedValueOnce(null) // First call: check if exists
					.mockResolvedValue(roleWithValue); // Second call: fetch after upsert

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
