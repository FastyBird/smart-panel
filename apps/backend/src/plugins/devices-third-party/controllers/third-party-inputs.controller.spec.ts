/* eslint-disable @typescript-eslint/unbound-method */
import { v4 as uuid } from 'uuid';

import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelInputOccurrencePayload } from '../../../modules/devices/models/channel-input-occurrence.model';
import { ChannelInputOccurrencesService } from '../../../modules/devices/services/channel-input-occurrences.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_THIRD_PARTY_TYPE } from '../devices-third-party.constants';
import { ThirdPartyDeviceEntity } from '../entities/devices-third-party.entity';

import { ThirdPartyInputsController } from './third-party-inputs.controller';

describe('ThirdPartyInputsController', () => {
	let controller: ThirdPartyInputsController;
	let devicesService: jest.Mocked<DevicesService>;
	let channelsService: jest.Mocked<ChannelsService>;
	let channelsPropertiesService: jest.Mocked<ChannelsPropertiesService>;
	let occurrencesService: jest.Mocked<ChannelInputOccurrencesService>;

	const mockDevice = {
		id: uuid(),
		type: DEVICES_THIRD_PARTY_TYPE,
		category: DeviceCategory.GENERIC,
	} as ThirdPartyDeviceEntity;

	const mockChannel = {
		id: uuid(),
		category: ChannelCategory.BUTTON,
		device: { id: mockDevice.id },
	} as unknown as ChannelEntity;

	const mockProperty = {
		id: uuid(),
		category: PropertyCategory.EVENT,
		identifier: 'event',
		channel: { id: mockChannel.id },
		permissions: [PermissionType.READ_ONLY, PermissionType.EVENT_ONLY],
		dataType: DataTypeType.ENUM,
		format: ['press', 'double_press', 'long_press'],
	} as unknown as ChannelPropertyEntity;

	beforeEach(() => {
		devicesService = {
			findOne: jest.fn().mockImplementation((id: string) => {
				if (id === mockDevice.id) return Promise.resolve(mockDevice);
				return Promise.resolve(null);
			}),
		} as unknown as jest.Mocked<DevicesService>;

		channelsService = {
			findOne: jest.fn().mockImplementation((id: string) => {
				if (id === mockChannel.id) return Promise.resolve(mockChannel);
				return Promise.resolve(null);
			}),
		} as unknown as jest.Mocked<ChannelsService>;

		channelsPropertiesService = {
			findOne: jest.fn().mockImplementation((id: string) => {
				if (id === mockProperty.id) return Promise.resolve(mockProperty);
				return Promise.resolve(null);
			}),
			findOneBy: jest.fn().mockImplementation((field: string, val: string) => {
				if (field === 'identifier' && val === 'event') return Promise.resolve(mockProperty);
				return Promise.resolve(null);
			}),
			findAll: jest.fn().mockResolvedValue([mockProperty]),
		} as unknown as jest.Mocked<ChannelsPropertiesService>;

		occurrencesService = {
			publishOccurrence: jest
				.fn()
				.mockImplementation(
					(dto: {
						deviceId: string;
						channelId: string;
						propertyId: string;
						event: string;
						sourceOccurrenceId?: string;
						sourceTimestamp?: string;
					}): Promise<ChannelInputOccurrencePayload> => {
						return Promise.resolve({
							id: uuid(),
							deviceId: dto.deviceId,
							channelId: dto.channelId,
							propertyId: dto.propertyId,
							event: dto.event,
							timestamp: new Date().toISOString(),
							sourceOccurrenceId: dto.sourceOccurrenceId,
							sourceTimestamp: dto.sourceTimestamp,
							channelCategory: ChannelCategory.BUTTON,
							propertyCategory: PropertyCategory.EVENT,
						});
					},
				),
		} as unknown as jest.Mocked<ChannelInputOccurrencesService>;

		controller = new ThirdPartyInputsController(
			devicesService,
			channelsService,
			channelsPropertiesService,
			occurrencesService,
		);
	});

	it('delivers two consecutive identical occurrences successfully', async () => {
		const res1 = await controller.reportOccurrence(mockDevice.id, mockChannel.id, {
			event: 'press',
			sourceOccurrenceId: 'ext-1',
		});

		expect(res1.data.event).toBe('press');
		expect(res1.data.id).toBeDefined();

		const res2 = await controller.reportOccurrence(mockDevice.id, mockChannel.id, {
			event: 'press',
			sourceOccurrenceId: 'ext-2',
		});

		expect(res2.data.event).toBe('press');
		expect(res2.data.id).toBeDefined();
		expect(occurrencesService.publishOccurrence).toHaveBeenCalledTimes(2);
	});

	it('rejects an undeclared/unsupported event with UnprocessableEntityException', async () => {
		await expect(
			controller.reportOccurrence(mockDevice.id, mockChannel.id, {
				event: 'triple_press', // Not in ['press', 'double_press', 'long_press']
			}),
		).rejects.toThrow(UnprocessableEntityException);

		expect(occurrencesService.publishOccurrence).not.toHaveBeenCalled();
	});

	it('throws NotFoundException if device does not exist', async () => {
		await expect(
			controller.reportOccurrence(uuid(), mockChannel.id, {
				event: 'press',
			}),
		).rejects.toThrow(NotFoundException);
	});

	it('throws BadRequestException if device is not third-party', async () => {
		const otherDevice = { id: uuid(), type: 'other_plugin' } as unknown as DeviceEntity;
		devicesService.findOne.mockResolvedValueOnce(otherDevice);

		await expect(
			controller.reportOccurrence(otherDevice.id, mockChannel.id, {
				event: 'press',
			}),
		).rejects.toThrow(BadRequestException);
	});

	it('throws NotFoundException if channel does not belong to device', async () => {
		const otherChannel = { id: uuid(), device: { id: uuid() } } as unknown as ChannelEntity;
		channelsService.findOne.mockResolvedValueOnce(otherChannel);

		await expect(
			controller.reportOccurrence(mockDevice.id, otherChannel.id, {
				event: 'press',
			}),
		).rejects.toThrow(NotFoundException);
	});
});
