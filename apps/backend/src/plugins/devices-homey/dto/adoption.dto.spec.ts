import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';

import { HomeyAdoptDeviceDto, HomeyBatchAdoptDevicesDto } from './adoption.dto';
import { CreateHomeyDeviceChannelPropertyDto } from './create-device-channel-property.dto';
import { CreateHomeyDeviceDto } from './create-device.dto';

describe('Homey adoption DTOs', () => {
	it('transforms the single snake-case request contract', async () => {
		const dto = plainToInstance(
			HomeyAdoptDeviceDto,
			{ device_id: 'homey-light', device_category: DeviceCategory.LIGHTING, name: 'Desk light' },
			{ excludeExtraneousValues: true },
		);

		expect(dto).toMatchObject({
			deviceId: 'homey-light',
			deviceCategory: DeviceCategory.LIGHTING,
			name: 'Desk light',
		});
		await expect(validate(dto)).resolves.toStrictEqual([]);
	});

	it('validates every batch selection and bounds the batch', async () => {
		const valid = plainToInstance(
			HomeyBatchAdoptDevicesDto,
			{ devices: [{ device_id: 'first' }, { device_id: 'second' }] },
			{ excludeExtraneousValues: true },
		);
		await expect(validate(valid)).resolves.toStrictEqual([]);

		const empty = plainToInstance(HomeyBatchAdoptDevicesDto, { devices: [] }, { excludeExtraneousValues: true });
		await expect(validate(empty)).resolves.not.toStrictEqual([]);

		const invalid = plainToInstance(
			HomeyBatchAdoptDevicesDto,
			{ devices: [{ device_id: '' }] },
			{ excludeExtraneousValues: true },
		);
		await expect(validate(invalid)).resolves.not.toStrictEqual([]);
	});

	it('retains Homey capability identity through nested device creation DTOs', async () => {
		const dto = plainToInstance(
			CreateHomeyDeviceDto,
			{
				type: 'devices-homey',
				identifier: 'homey-light',
				name: 'Light',
				category: DeviceCategory.LIGHTING,
				channels: [
					{
						type: 'devices-homey',
						identifier: 'light',
						name: 'Light',
						category: ChannelCategory.LIGHT,
						properties: [
							{
								type: 'devices-homey',
								identifier: 'onoff::light-power',
								homey_capability_id: 'onoff',
								homey_mapping_name: 'light-power',
								category: PropertyCategory.ON,
								permissions: [PermissionType.READ_WRITE],
								data_type: DataTypeType.BOOL,
								value: false,
							},
						],
					},
				],
			},
			{ excludeExtraneousValues: true },
		);

		expect(dto.channels?.[0].properties?.[0]).toMatchObject({
			homeyCapabilityId: 'onoff',
			homeyMappingName: 'light-power',
			value: false,
		});
		await expect(validate(dto)).resolves.toStrictEqual([]);
	});

	it('allows provider infrastructure properties that are not Homey capability mappings', async () => {
		const dto = plainToInstance(
			CreateHomeyDeviceChannelPropertyDto,
			{
				type: 'devices-homey',
				identifier: 'connection_state',
				name: 'Connection state',
				category: PropertyCategory.STATUS,
				permissions: [PermissionType.READ_ONLY],
				data_type: DataTypeType.ENUM,
				format: ['connected', 'disconnected'],
			},
			{ excludeExtraneousValues: true },
		);

		expect(dto.homeyCapabilityId).toBeUndefined();
		expect(dto.homeyMappingName).toBeUndefined();
		await expect(validate(dto)).resolves.toStrictEqual([]);
	});
});
