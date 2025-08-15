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

import { toInstance } from '../../../common/utils/transform.utils';
import { DataSourceEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DeviceChannelDataSourceEntity } from '../entities/data-sources-device-channel.entity';

import { DataSourceRelationsLoaderService } from './data-source-relations-loader.service';

describe('DataSourceRelationsLoaderService', () => {
	let service: DataSourceRelationsLoaderService;
	let devicesService: DevicesService;
	let channelsService: ChannelsService;
	let propertiesService: ChannelsPropertiesService;

	const mockDevice = { id: uuid().toString() };
	const mockChannel = { id: uuid().toString() };
	const mockProperty = { id: uuid().toString() };

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				DataSourceRelationsLoaderService,
				{
					provide: DevicesService,
					useValue: {
						findOne: jest.fn().mockResolvedValue(toInstance(DeviceEntity, mockDevice)),
					},
				},
				{
					provide: ChannelsService,
					useValue: {
						findOne: jest.fn().mockResolvedValue(toInstance(ChannelEntity, mockChannel)),
					},
				},
				{
					provide: ChannelsPropertiesService,
					useValue: {
						findOne: jest.fn().mockResolvedValue(toInstance(ChannelPropertyEntity, mockProperty)),
					},
				},
			],
		}).compile();

		service = module.get(DataSourceRelationsLoaderService);
		devicesService = module.get(DevicesService);
		channelsService = module.get(ChannelsService);
		propertiesService = module.get(ChannelsPropertiesService);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('supports()', () => {
		it('should return true for DeviceChannelDataSourceEntity', () => {
			const entity = new DeviceChannelDataSourceEntity();
			expect(service.supports(entity)).toBe(true);
		});

		it('should return false for non-matching entity', () => {
			class DummyEntity extends DataSourceEntity {}
			const entity = new DummyEntity();
			expect(service.supports(entity)).toBe(false);
		});
	});

	describe('loadRelations()', () => {
		it('should load device, channel, and property when all IDs are valid', async () => {
			const entity = new DeviceChannelDataSourceEntity();
			entity.deviceId = mockDevice.id;
			entity.channelId = mockChannel.id;
			entity.propertyId = mockProperty.id;

			await service.loadRelations(entity);

			expect(devicesService.findOne).toHaveBeenCalledWith(mockDevice.id);
			expect(channelsService.findOne).toHaveBeenCalledWith(mockChannel.id, mockDevice.id);
			expect(propertiesService.findOne).toHaveBeenCalledWith(mockProperty.id, mockChannel.id);

			expect(entity.device).toEqual(toInstance(DeviceEntity, mockDevice));
			expect(entity.channel).toEqual(toInstance(ChannelEntity, mockChannel));
			expect(entity.property).toEqual(toInstance(ChannelPropertyEntity, mockProperty));
		});

		it('should skip loading when deviceId is invalid', async () => {
			const entity = new DeviceChannelDataSourceEntity();
			entity.deviceId = 'not-a-uuid';

			await service.loadRelations(entity);

			expect(devicesService.findOne).not.toHaveBeenCalled();
			expect(channelsService.findOne).not.toHaveBeenCalled();
			expect(propertiesService.findOne).not.toHaveBeenCalled();
		});
	});
});
