import { Expose, Type } from 'class-transformer';
import { IsArray, IsEnum, IsUUID, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';
import { ThirdPartyPropertiesUpdateStatus } from '../devices-third-party.constants';

type ThirdPartyDevicePropertyUpdateResult = components['schemas']['DevicesThirdPartyPluginPropertyUpdateResult'];
type ThirdPartyDevicePropertiesUpdateResult = components['schemas']['DevicesThirdPartyPluginPropertiesUpdateResult'];

export class PropertyUpdateResultDto implements ThirdPartyDevicePropertyUpdateResult {
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
	@IsEnum(ThirdPartyPropertiesUpdateStatus)
	status: ThirdPartyPropertiesUpdateStatus;
}

export class PropertiesUpdateResponseDto implements ThirdPartyDevicePropertiesUpdateResult {
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PropertyUpdateResultDto)
	properties: PropertyUpdateResultDto[];
}
