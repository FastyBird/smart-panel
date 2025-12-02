import { Expose, Type } from 'class-transformer';
import { IsArray, IsEnum, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { ThirdPartyPropertiesUpdateStatus } from '../devices-third-party.constants';

@ApiSchema({ name: 'DevicesThirdPartyPluginDataPropertyUpdateResult' })
export class PropertyUpdateResultModel {
	@ApiProperty({
		description: 'Device UUID',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
		type: 'string',
	})
	@Expose()
	@IsUUID()
	device: string;

	@ApiProperty({
		description: 'Channel UUID',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174001',
		type: 'string',
	})
	@Expose()
	@IsUUID()
	channel: string;

	@ApiProperty({
		description: 'Property UUID',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174002',
		type: 'string',
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

@ApiSchema({ name: 'DevicesThirdPartyPluginDataPropertiesUpdateResult' })
export class PropertiesUpdateResultModel {
	@ApiProperty({
		description: 'Array of property update results',
		type: 'array',
		items: { $ref: getSchemaPath(PropertyUpdateResultModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PropertyUpdateResultModel)
	properties: PropertyUpdateResultModel[];
}
