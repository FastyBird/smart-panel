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

import { PageEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DeviceDetailPageEntity } from '../entities/pages-device-detail.entity';

import { PageRelationsLoaderService } from './page-relations-loader.service';

class MockPageEntity extends PageEntity {}

describe('PageRelationsLoaderService', () => {
	let service: PageRelationsLoaderService;
	let devicesService: DevicesService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				PageRelationsLoaderService,
				{
					provide: DevicesService,
					useValue: {
						findOne: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get(PageRelationsLoaderService);
		devicesService = module.get(DevicesService);

	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('supports()', () => {
		it('should return true for DeviceDetailPageEntity', () => {
			const entity = new DeviceDetailPageEntity();
			expect(service.supports(entity)).toBe(true);
		});

		it('should return false for other PageEntity types', () => {
			const entity = new MockPageEntity();
			expect(service.supports(entity)).toBe(false);
		});
	});

	describe('loadRelations()', () => {
		it('should call devicesService.findOne with valid UUID', async () => {
			const deviceId = uuid();
			const mockDevice = { id: deviceId, name: 'Device X' };
			(devicesService.findOne as jest.Mock).mockResolvedValue(mockDevice);

			const entity = new DeviceDetailPageEntity();
			entity.deviceId = deviceId;

			await service.loadRelations(entity);

			expect(devicesService.findOne).toHaveBeenCalledWith(deviceId);
			expect(entity.device).toEqual(mockDevice);
		});

		it('should not call findOne if deviceId is missing or invalid', async () => {
			const entity = new DeviceDetailPageEntity();
			entity.deviceId = 'invalid-uuid';

			await service.loadRelations(entity);

			expect(devicesService.findOne).not.toHaveBeenCalled();
			expect(entity.device).toBeUndefined();
		});
	});
});
