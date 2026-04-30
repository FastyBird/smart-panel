import { Expose, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { DeviceCategory } from '../../../modules/devices/devices.constants';

@ApiSchema({ name: 'DevicesZigbee2mqttPluginReqWizardAdoptDevice' })
export class Z2mWizardAdoptDeviceDto {
	@ApiProperty({ description: 'Device IEEE address from the wizard session', example: '0x00158d0001a1b2c3' })
	@Expose()
	@IsString()
	ieeeAddress: string;

	@ApiProperty({ description: 'Display name override', example: 'Living Room Lamp' })
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({ description: 'Target device category', enum: DeviceCategory, example: DeviceCategory.LIGHTING })
	@Expose()
	@IsEnum(DeviceCategory)
	category: DeviceCategory;
}

@ApiSchema({ name: 'DevicesZigbee2mqttPluginReqWizardAdopt' })
export class Z2mWizardAdoptDto {
	@ApiProperty({
		description: 'Devices to adopt with display name and category overrides',
		type: 'array',
		items: { $ref: getSchemaPath(Z2mWizardAdoptDeviceDto) },
	})
	@Expose()
	@IsArray()
	@ArrayNotEmpty()
	@ValidateNested({ each: true })
	@Type(() => Z2mWizardAdoptDeviceDto)
	devices: Z2mWizardAdoptDeviceDto[];
}

@ApiSchema({ name: 'DevicesZigbee2mqttPluginReqWizardAdoptWrap' })
export class ReqZ2mWizardAdoptDto {
	@ApiProperty({ description: 'Wizard adoption payload', type: () => Z2mWizardAdoptDto })
	@Expose()
	@ValidateNested()
	@Type(() => Z2mWizardAdoptDto)
	data: Z2mWizardAdoptDto;
}
