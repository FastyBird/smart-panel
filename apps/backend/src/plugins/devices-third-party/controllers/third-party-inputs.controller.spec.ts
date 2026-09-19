/* eslint-disable @typescript-eslint/unbound-method */
import { FastifyReply } from 'fastify';
import { v4 as uuid } from 'uuid';

import { BadRequestException, HttpStatus, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import {
	ChannelInputOccurrencePayload,
	ChannelInputOccurrenceResponseModel,
} from '../../../modules/devices/models/channel-input-occurrence.model';
import { ChannelInputOccurrencesService } from '../../../modules/devices/services/channel-input-occurrences.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_THIRD_PARTY_TYPE } from '../devices-third-party.constants';

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
		name: 'Test Third Party Device',
	} as unknown as DeviceEntity;

	const mockChannel = {
		id: uuid(),
		category: ChannelCategory.BUTTON,
		name: 'Action Button',
		device: mockDevice,
	} as unknown as ChannelEntity;

	const mockProperty = {
		id: uuid(),
		category: PropertyCategory.EVENT,
		identifier: 'event',
		name: 'Event',
		dataType: DataTypeType.ENUM,
		permissions: [PermissionType.READ_ONLY, PermissionType.EVENT_ONLY],
		format: ['press', 'double_press', 'long_press'],
		channel: mockChannel,
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
			findOneBy: jest.fn().mockImplementation((field: string, value: string, channelId: string) => {
				if (field === 'identifier' && value === 'event' && channelId === mockChannel.id) {
					return Promise.resolve(mockProperty);
				}
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
						nativeEventType?: string;
						data?: Record<string, unknown>;
					}): Promise<ChannelInputOccurrencePayload | null> => {
						const payload: ChannelInputOccurrencePayload = {
							id: uuid(),
							deviceId: dto.deviceId,
							channelId: dto.channelId,
							propertyId: dto.propertyId,
							channelCategory: ChannelCategory.BUTTON,
							propertyCategory: PropertyCategory.EVENT,
							event: dto.event,
							timestamp: new Date().toISOString(),
							sourceOccurrenceId: dto.sourceOccurrenceId,
							sourceTimestamp: dto.sourceTimestamp,
							nativeEventType: dto.nativeEventType,
							data: dto.data,
						};
						return Promise.resolve(payload);
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

	it('ingests and publishes physical button press successfully', async () => {
		const res = (await controller.reportOccurrence(mockDevice.id, mockChannel.id, {
			event: 'press',
		})) as ChannelInputOccurrenceResponseModel;

		expect(res).toBeDefined();
		expect(res.data.event).toBe('press');
		expect(res.data.deviceId).toBe(mockDevice.id);
		expect(res.data.channelId).toBe(mockChannel.id);
		expect(res.data.propertyId).toBe(mockProperty.id);
		expect(occurrencesService.publishOccurrence).toHaveBeenCalledWith(
			expect.objectContaining({
				deviceId: mockDevice.id,
				channelId: mockChannel.id,
				propertyId: mockProperty.id,
				event: 'press',
			}),
		);
	});

	it('delivers two consecutive identical occurrences successfully', async () => {
		const res1 = (await controller.reportOccurrence(mockDevice.id, mockChannel.id, {
			event: 'press',
			sourceOccurrenceId: 'ext-1',
		})) as ChannelInputOccurrenceResponseModel;

		expect(res1.data.event).toBe('press');
		expect(res1.data.id).toBeDefined();

		const res2 = (await controller.reportOccurrence(mockDevice.id, mockChannel.id, {
			event: 'press',
			sourceOccurrenceId: 'ext-2',
		})) as ChannelInputOccurrenceResponseModel;

		expect(res2.data.event).toBe('press');
		expect(res2.data.id).toBeDefined();
		expect(occurrencesService.publishOccurrence).toHaveBeenCalledTimes(2);
	});

	it('resolves explicit property by string identifier', async () => {
		const res = (await controller.reportOccurrence(mockDevice.id, mockChannel.id, {
			property: 'event',
			event: 'press',
		})) as ChannelInputOccurrenceResponseModel;

		expect(res.data.event).toBe('press');
		expect(res.data.propertyId).toBe(mockProperty.id);
		expect(channelsPropertiesService.findOneBy).toHaveBeenCalledWith('identifier', 'event', mockChannel.id);
	});

	it('resolves explicit property by UUID', async () => {
		const res = (await controller.reportOccurrence(mockDevice.id, mockChannel.id, {
			property: mockProperty.id,
			event: 'press',
		})) as ChannelInputOccurrenceResponseModel;

		expect(res.data.event).toBe('press');
		expect(res.data.propertyId).toBe(mockProperty.id);
		expect(channelsPropertiesService.findOne).toHaveBeenCalledWith(mockProperty.id);
	});

	it('returns 204 No Content without payload when occurrence is deduplicated/dropped', async () => {
		occurrencesService.publishOccurrence.mockResolvedValueOnce(null);

		const mockRes = {
			status: jest.fn(),
		} as unknown as FastifyReply;

		const res = await controller.reportOccurrence(
			mockDevice.id,
			mockChannel.id,
			{
				event: 'press',
				sourceOccurrenceId: 'duplicate-1',
			},
			mockRes,
		);

		expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.NO_CONTENT);
		expect(res).toBeUndefined();
	});

	it('rejects an undeclared/unsupported event with UnprocessableEntityException', async () => {
		await expect(
			controller.reportOccurrence(mockDevice.id, mockChannel.id, {
				event: 'triple_click',
			}),
		).rejects.toThrow(UnprocessableEntityException);
	});

	it('rejects an unmapped property with NotFoundException', async () => {
		await expect(
			controller.reportOccurrence(mockDevice.id, mockChannel.id, {
				property: 'non_existent_prop',
				event: 'press',
			}),
		).rejects.toThrow(NotFoundException);
	});

	it('rejects request for non-existent device', async () => {
		await expect(
			controller.reportOccurrence(uuid(), mockChannel.id, {
				event: 'press',
			}),
		).rejects.toThrow(NotFoundException);
	});

	it('rejects request for non-third-party device', async () => {
		const otherDevice = { ...mockDevice, type: 'other' } as unknown as DeviceEntity;
		devicesService.findOne.mockResolvedValueOnce(otherDevice);

		await expect(
			controller.reportOccurrence(mockDevice.id, mockChannel.id, {
				event: 'press',
			}),
		).rejects.toThrow(BadRequestException);
	});

	it('rejects request for channel on different device', async () => {
		const otherDeviceChannel = {
			...mockChannel,
			device: { id: uuid() } as unknown as DeviceEntity,
		} as unknown as ChannelEntity;
		channelsService.findOne.mockResolvedValueOnce(otherDeviceChannel);

		await expect(
			controller.reportOccurrence(mockDevice.id, mockChannel.id, {
				event: 'press',
			}),
		).rejects.toThrow(NotFoundException);
	});
});
