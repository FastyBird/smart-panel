import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

import { DeviceCategory } from '../../../modules/devices/devices.constants';

export class ShellyNgSupportedDeviceComponentModel {
	@Expose()
	@IsString()
	type: string;

	@Expose()
	@IsString()
	cls: string;

	@Expose()
	@IsArray()
	@IsInt({ each: true })
	ids: number[];
}

export class ShellyNgSupportedDeviceSystemComponentModel {
	@Expose()
	@IsString()
	type: string;

	@Expose()
	@IsString()
	cls: string;
}

export class ShellyNgSupportedDeviceModel {
	@Expose()
	@IsString()
	group: string;

	@Expose()
	@IsString()
	name: string;

	@Expose()
	@IsArray()
	@IsString({ each: true })
	models: string[];

	@Expose()
	@IsArray()
	@IsString({ each: true })
	categories: DeviceCategory[];

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ShellyNgSupportedDeviceComponentModel)
	components: ShellyNgSupportedDeviceComponentModel[];

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ShellyNgSupportedDeviceSystemComponentModel)
	system: ShellyNgSupportedDeviceSystemComponentModel[];
}

export class ShellyNgDeviceInfoComponentModel {
	@Expose()
	@IsString()
	type: string;

	@Expose()
	@IsArray()
	@IsInt({ each: true })
	ids: number[];
}

export class ShellyNgDeviceInfoModel {
	@Expose()
	@IsString()
	id: string;

	@Expose()
	@IsString()
	mac: string;

	@Expose()
	@IsString()
	model: string;

	@Expose()
	@IsString()
	fw_id: string;

	@Expose()
	@IsString()
	ver: string;

	@Expose()
	@IsString()
	app: string;

	@Expose()
	@IsString()
	@IsOptional()
	profile?: string;

	@Expose()
	@IsBoolean()
	auth_en: boolean;

	@Expose()
	@IsString()
	@IsOptional()
	auth_domain: string | null;

	@Expose()
	@IsBoolean()
	discoverable: boolean;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ShellyNgDeviceInfoComponentModel)
	components: ShellyNgDeviceInfoComponentModel[];
}
