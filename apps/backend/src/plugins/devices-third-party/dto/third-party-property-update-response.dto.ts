import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsArray, IsEnum, IsUUID, ValidateNested } from 'class-validator';

import { ThirdPartyPropertiesUpdateStatus } from '../devices-third-party.constants';

@ApiSchema({ name: 'DevicesThirdPartyPluginPropertyUpdateResult' })
export class PropertyUpdateResultDto {
	@ApiProperty({
		description: 'Device UUID',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsUUID()
	device: string;

	@ApiProperty({
		description: 'Channel UUID',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174001',
	})
	@Expose()
	@IsUUID()
	channel: string;

	@ApiProperty({
		description: 'Property UUID',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174002',
	})
	@Expose()
	@IsUUID()
	property: string;

	@ApiProperty({
		description: 'Update operation status',
		enum: ThirdPartyPropertiesUpdateStatus,
		example: ThirdPartyPropertiesUpdateStatus.SUCCESS,
	})
	@Expose()
	@IsEnum(ThirdPartyPropertiesUpdateStatus)
	status: ThirdPartyPropertiesUpdateStatus;
}

@ApiSchema({ name: 'DevicesThirdPartyPluginPropertiesUpdateResult' })
export class PropertiesUpdateResponseDto {
	@ApiProperty({
		description: 'Array of property update results',
		type: [PropertyUpdateResultDto],
		isArray: true,
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PropertyUpdateResultDto)
	properties: PropertyUpdateResultDto[];
}
