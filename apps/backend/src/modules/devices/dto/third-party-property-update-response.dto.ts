import { Expose, Type } from 'class-transformer';
import { IsArray, IsEnum, IsUUID, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';
import { ThirdPartyPropertiesUpdateStatusEnum } from '../devices.constants';

type ThirdPartyDevicePropertyUpdateResult = components['schemas']['DevicesThirdPartyDevicePropertyUpdateResult'];

export class PropertyUpdateResultDto {
	@Expose()
	@IsUUID()
	device: string;

	@Expose()
	@IsUUID()
	channel: string;

	@Expose()
	@IsUUID()
	property: string;

	@Expose()
	@IsEnum(ThirdPartyPropertiesUpdateStatusEnum)
	status: ThirdPartyPropertiesUpdateStatusEnum;
}

export class PropertiesUpdateResponseDto implements ThirdPartyDevicePropertyUpdateResult {
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PropertyUpdateResultDto)
	properties: PropertyUpdateResultDto[];
}
