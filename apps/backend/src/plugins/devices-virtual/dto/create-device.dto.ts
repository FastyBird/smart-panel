import { Expose } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { CreateDeviceDto } from '../../../modules/devices/dto/create-device.dto';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { ValidateCategoryAllowed } from '../validators/category-allowed-constraint.validator';

@ApiSchema({ name: 'DevicesVirtualPluginCreateDevice' })
export class CreateVirtualDeviceDto extends CreateDeviceDto {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_VIRTUAL_TYPE,
		example: DEVICES_VIRTUAL_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	readonly type: typeof DEVICES_VIRTUAL_TYPE;

	// Redeclared (not just decorated further): class-validator does not merge a subclass property's
	// decorators with its parent's for the same property name — it replaces them. Every validator
	// CreateDeviceDto.category carries (@IsNotEmpty, @IsEnum) is repeated here verbatim so that
	// contract survives, with @ValidateCategoryAllowed appended as the one virtual-specific addition.
	@ApiProperty({ description: 'Device category', enum: DeviceCategory, example: DeviceCategory.GENERIC })
	@Expose()
	@IsNotEmpty({
		message: '[{"field":"category","reason":"Category must be a valid device category."}]',
	})
	@IsEnum(DeviceCategory, {
		message: '[{"field":"category","reason":"Category must be a valid device category."}]',
	})
	@ValidateCategoryAllowed()
	category: DeviceCategory;
}
