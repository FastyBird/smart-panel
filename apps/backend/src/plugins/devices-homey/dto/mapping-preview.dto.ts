import { Expose } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { DeviceCategory } from '../../../modules/devices/devices.constants';

@ApiSchema({ name: 'DevicesHomeyPluginMappingPreviewRequest' })
export class HomeyMappingPreviewRequestDto {
	@ApiProperty({
		name: 'device_id',
		description: 'Authoritative Homey device identifier to read and preview',
		type: 'string',
	})
	@Expose({ name: 'device_id' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	deviceId: string;

	@ApiPropertyOptional({
		name: 'device_category',
		description: 'Optional Smart Panel category to validate instead of the inferred category',
		enum: DeviceCategory,
	})
	@Expose({ name: 'device_category' })
	@IsOptional()
	@IsEnum(DeviceCategory)
	deviceCategory?: DeviceCategory;
}
