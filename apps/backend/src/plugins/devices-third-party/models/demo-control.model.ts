import { Expose, Type } from 'class-transformer';
import { IsArray, IsEnum, IsUUID, ValidateNested } from 'class-validator';

import { ThirdPartyPropertiesUpdateStatus } from '../devices-third-party.constants';

export class ThirdPartyDemoControlPropertyModel {
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

export class ThirdPartyDemoControlModel {
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ThirdPartyDemoControlPropertyModel)
	properties: ThirdPartyDemoControlPropertyModel[];
}
