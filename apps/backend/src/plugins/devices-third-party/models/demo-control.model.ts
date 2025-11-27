import { Expose, Type } from 'class-transformer';
import { IsArray, IsEnum, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ThirdPartyPropertiesUpdateStatus } from '../devices-third-party.constants';

/**
 * This is an enum schema that matches ThirdPartyPropertiesUpdateStatus
 */
@ApiSchema({ name: 'DevicesThirdPartyPluginErrorCode' })
export class DevicesThirdPartyPluginErrorCode {
	@ApiProperty({
		description: 'Error code',
		enum: ThirdPartyPropertiesUpdateStatus,
		example: ThirdPartyPropertiesUpdateStatus.SUCCESS,
	})
	code: ThirdPartyPropertiesUpdateStatus;
}

@ApiSchema({ name: 'DevicesThirdPartyPluginThirdPartyDemoControlProperty' })
export class ThirdPartyDemoControlPropertyModel {
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
		description: 'Property update status',
		enum: ThirdPartyPropertiesUpdateStatus,
		example: ThirdPartyPropertiesUpdateStatus.SUCCESS,
	})
	@Expose()
	@IsEnum(ThirdPartyPropertiesUpdateStatus)
	status: ThirdPartyPropertiesUpdateStatus;
}

@ApiSchema({ name: 'DevicesThirdPartyPluginThirdPartyDemoControl' })
export class ThirdPartyDemoControlModel {
	@ApiProperty({
		description: 'Array of properties to control',
		isArray: true,
		type: () => ThirdPartyDemoControlPropertyModel,
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ThirdPartyDemoControlPropertyModel)
	properties: ThirdPartyDemoControlPropertyModel[];
}
