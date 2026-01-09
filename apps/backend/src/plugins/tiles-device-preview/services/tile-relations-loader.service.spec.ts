/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DevicePreviewTileEntity } from '../entities/tiles-device-preview.entity';

import { TileRelationsLoaderService } from './tile-relations-loader.service';

describe('TileRelationsLoaderService', () => {
	let service: TileRelationsLoaderService;
	let devicesService: DevicesService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TileRelationsLoaderService,
				{
					provide: DevicesService,
					useValue: {
						findOne: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get(TileRelationsLoaderService);
		devicesService = module.get(DevicesService);

	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
		expect(devicesService).toBeDefined();
	});

	it('should return true for supported entity type', () => {
		const tile = new DevicePreviewTileEntity();
		expect(service.supports(tile)).toBe(true);
	});

	it('should return false for unsupported entity type', () => {
		const tile = {} as TileEntity;
		expect(service.supports(tile)).toBe(false);
	});

	it('should load and assign device when deviceId is valid UUID', async () => {
		const tile = new DevicePreviewTileEntity();
		const deviceId = uuid();

		tile.deviceId = deviceId;

		const mockDevice = { id: deviceId };
		jest.spyOn(devicesService, 'findOne').mockResolvedValueOnce(mockDevice as DeviceEntity);

		await service.loadRelations(tile);

		expect(devicesService.findOne).toHaveBeenCalledWith(deviceId);
		expect(tile.device).toEqual(mockDevice);
	});

	it('should not load device if deviceId is invalid', async () => {
		const tile = new DevicePreviewTileEntity();
		tile.deviceId = 'invalid-uuid';

		await service.loadRelations(tile);

		expect(devicesService.findOne).not.toHaveBeenCalled();
		expect(tile.device).toBeUndefined();
	});
});
