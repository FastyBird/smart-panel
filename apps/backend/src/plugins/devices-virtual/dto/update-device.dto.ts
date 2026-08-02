import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { UpdateDeviceDto } from '../../../modules/devices/dto/update-device.dto';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { ValidateCategoryAllowed } from '../validators/category-allowed-constraint.validator';

@ApiSchema({ name: 'DevicesVirtualPluginUpdateDevice' })
export class UpdateVirtualDeviceDto extends UpdateDeviceDto {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_VIRTUAL_TYPE,
		example: DEVICES_VIRTUAL_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	type: typeof DEVICES_VIRTUAL_TYPE;

	// Redeclared (not just decorated further): class-validator does not merge a subclass property's
	// decorators with its parent's for the same property name — it replaces them. Every validator
	// UpdateDeviceDto.category carries (@Transform, @IsOptional, @IsNotEmpty, @IsEnum) is repeated
	// here verbatim so that contract survives, with @ValidateCategoryAllowed appended as the one
	// virtual-specific addition.
	@ApiPropertyOptional({
		description: 'Device category',
		enum: DeviceCategory,
		example: DeviceCategory.GENERIC,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsNotEmpty({
		message: '[{"field":"category","reason":"Category must be a valid device category."}]',
	})
	@IsEnum(DeviceCategory, {
		message: '[{"field":"category","reason":"Category must be a valid device category."}]',
	})
	@ValidateCategoryAllowed()
	category?: DeviceCategory;
}
