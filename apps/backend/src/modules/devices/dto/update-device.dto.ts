import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { DeviceCategory } from '../devices.constants';

@ApiSchema({ name: 'DevicesModuleUpdateDevice' })
export class UpdateDeviceDto {
	@ApiProperty({ description: 'Device type', type: 'string', example: 'generic' })
	@Expose()
	@IsNotEmpty({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported device type."}]',
	})
	@IsString({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported device type."}]',
	})
	type: string;

	@ApiPropertyOptional({
		description: 'Device category',
		enum: DeviceCategory,
		example: DeviceCategory.GENERIC,
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({
		message: '[{"field":"category","reason":"Category must be a valid device category."}]',
	})
	@IsEnum(DeviceCategory, {
		message: '[{"field":"category","reason":"Category must be a valid device category."}]',
	})
	category?: DeviceCategory;

	@ApiPropertyOptional({
		description: 'Device identifier',
		type: 'string',
		nullable: true,
		example: 'device-001',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({
		message:
			'[{"field":"identifier","reason":"Identifier must be a valid string representing device unique identifier."}]',
	})
	@IsString({
		message:
			'[{"field":"identifier","reason":"Identifier must be a valid string representing device unique identifier."}]',
	})
	@ValidateIf((_, value) => value !== null)
	identifier?: string | null;

	@ApiPropertyOptional({ description: 'Device name', type: 'string', example: 'My Device' })
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a valid string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a valid string."}]' })
	name?: string;

	@ApiPropertyOptional({ description: 'Device description', type: 'string', example: 'Device description' })
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"description","reason":"Description must be a valid string."}]' })
	@IsString({ message: '[{"field":"description","reason":"Description must be a valid string."}]' })
	description?: string;

	@ApiPropertyOptional({ description: 'Device enabled status', type: 'boolean', example: true })
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled attribute must be a valid true or false."}]' })
	enabled?: boolean;
}

@ApiSchema({ name: 'DevicesModuleReqUpdateDevice' })
export class ReqUpdateDeviceDto {
	@ApiProperty({ description: 'Device data', type: () => UpdateDeviceDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdateDeviceDto)
	data: UpdateDeviceDto;
}
