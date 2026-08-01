import { useContainer, validate } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualDevicesService } from '../services/virtual-devices.service';
import { VirtualPropertyIndexService } from '../services/virtual-property-index.service';
import { SourceNotVirtualConstraintValidator } from '../validators/source-not-virtual-constraint.validator';

import { CreateVirtualChannelPropertyDto } from './create-channel-property.dto';
import { UpdateVirtualChannelPropertyDto } from './update-channel-property.dto';

/**
 * End-to-end coverage (real DTO classes, real class-validator, DI-resolved constraint — not mocks of
 * the wiring itself) that `@ValidateSourceNotVirtual()` actually fires on `source_property` for both
 * the create and update DTOs, and that it sits alongside — not instead of — the existing `@IsUUID`
 * check on the same field. This is the guard VirtualProjectionListener's termination argument and
 * VirtualDevicePlatform's own backstop check both assume exists; this test is what proves it does.
 */
describe('source_property field validation on CreateVirtualChannelPropertyDto / UpdateVirtualChannelPropertyDto', () => {
	let channelsPropertiesService: { findOne: jest.Mock };
	let channelsService: { findOne: jest.Mock };
	let devicesService: { findOne: jest.Mock };

	beforeAll(() => {
		channelsPropertiesService = { findOne: jest.fn() };
		channelsService = { findOne: jest.fn() };
		devicesService = { findOne: jest.fn() };

		const virtualDevicesService = new VirtualDevicesService(
			channelsPropertiesService as unknown as ChannelsPropertiesService,
			channelsService as unknown as ChannelsService,
			devicesService as unknown as DevicesService,
			undefined as unknown as VirtualPropertyIndexService,
		);
		const sourceNotVirtualValidator = new SourceNotVirtualConstraintValidator(virtualDevicesService);

		// Minimal stand-in for Nest's DI container (see main.ts's real `useContainer(app.select(...))`):
		// resolves the one constraint class exercised here to a real, working instance.
		useContainer(
			{
				get: <T>(someClass: new () => T): T =>
					(someClass === SourceNotVirtualConstraintValidator ? sourceNotVirtualValidator : new someClass()) as T,
			},
			{ fallbackOnErrors: true },
		);
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	const basePropertyFields = {
		type: DEVICES_VIRTUAL_TYPE,
		category: 'generic',
		permissions: ['ro'],
		data_type: 'string',
	};

	it('CreateVirtualChannelPropertyDto still rejects a malformed uuid (inherited @IsUUID was not dropped)', async () => {
		const dto = toInstance(CreateVirtualChannelPropertyDto, { ...basePropertyFields, source_property: 'not-a-uuid' });

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'source_property' && !!error.constraints?.isUuid)).toBe(true);
	});

	it('CreateVirtualChannelPropertyDto rejects a source_property belonging to a virtual device', async () => {
		const virtualDevice = { id: 'virtual-device-1', type: DEVICES_VIRTUAL_TYPE } as DeviceEntity;
		const channel = Object.assign(new ChannelEntity(), { id: 'chan-1', device: virtualDevice });

		channelsPropertiesService.findOne.mockResolvedValue(
			Object.assign(new ChannelPropertyEntity(), { id: 'nested-source', channel }),
		);
		channelsService.findOne.mockResolvedValue(channel);
		devicesService.findOne.mockResolvedValue(virtualDevice);

		const dto = toInstance(CreateVirtualChannelPropertyDto, {
			...basePropertyFields,
			source_property: '550e8400-e29b-41d4-a716-446655440000',
		});

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'source_property' && !!error.constraints?.SourceNotVirtual)).toBe(
			true,
		);
	});

	it('CreateVirtualChannelPropertyDto accepts a source_property belonging to a physical device', async () => {
		const physicalDevice = { id: 'physical-device-1', type: 'simulator' } as DeviceEntity;
		const channel = Object.assign(new ChannelEntity(), { id: 'chan-2', device: physicalDevice });

		channelsPropertiesService.findOne.mockResolvedValue(
			Object.assign(new ChannelPropertyEntity(), { id: 'phys-source', channel }),
		);
		channelsService.findOne.mockResolvedValue(channel);
		devicesService.findOne.mockResolvedValue(physicalDevice);

		const dto = toInstance(CreateVirtualChannelPropertyDto, {
			...basePropertyFields,
			source_property: '550e8400-e29b-41d4-a716-446655440001',
		});

		const errors = await validate(dto);

		expect(errors.filter((error) => error.property === 'source_property')).toHaveLength(0);
	});

	it('UpdateVirtualChannelPropertyDto rejects a source_property belonging to a virtual device', async () => {
		const virtualDevice = { id: 'virtual-device-2', type: DEVICES_VIRTUAL_TYPE } as DeviceEntity;
		const channel = Object.assign(new ChannelEntity(), { id: 'chan-3', device: virtualDevice });

		channelsPropertiesService.findOne.mockResolvedValue(
			Object.assign(new ChannelPropertyEntity(), { id: 'nested-source-2', channel }),
		);
		channelsService.findOne.mockResolvedValue(channel);
		devicesService.findOne.mockResolvedValue(virtualDevice);

		const dto = toInstance(UpdateVirtualChannelPropertyDto, {
			type: DEVICES_VIRTUAL_TYPE,
			source_property: '550e8400-e29b-41d4-a716-446655440002',
		});

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'source_property' && !!error.constraints?.SourceNotVirtual)).toBe(
			true,
		);
	});

	it('UpdateVirtualChannelPropertyDto still allows omitting source_property entirely (inherited @IsOptional was not dropped)', async () => {
		const dto = toInstance(UpdateVirtualChannelPropertyDto, { type: DEVICES_VIRTUAL_TYPE });

		const errors = await validate(dto);

		expect(errors.filter((error) => error.property === 'source_property')).toHaveLength(0);
		expect(channelsPropertiesService.findOne).not.toHaveBeenCalled();
	});
});
