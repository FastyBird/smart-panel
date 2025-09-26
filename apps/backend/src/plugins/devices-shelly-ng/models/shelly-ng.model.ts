import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

import { DeviceCategory } from '../../../modules/devices/devices.constants';

export class ShellyNgSupportedDeviceComponentModel {
	@Expose()
	@IsString()
	type: string;

	@Expose()
	@IsArray()
	@IsInt({ each: true })
	ids: number[];
}

export class ShellyNgSupportedDeviceSystemComponentModel {
	@Expose()
	@IsString()
	type: string;
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

export class ShellyNgDeviceInfoAuthenticationModel {
	@Expose()
	@IsString()
	@IsOptional()
	domain: string | null;

	@Expose()
	@IsBoolean()
	@IsOptional()
	enabled: boolean = false;
}

export class ShellyNgDeviceInfoModel {
	@Expose()
	@IsString()
	id: string;

	@Expose()
	@IsOptional()
	@IsString()
	name: string | null = null;

	@Expose()
	@IsString()
	mac: string;

	@Expose()
	@IsString()
	model: string;

	@Expose()
	@IsString()
	firmware: string;

	@Expose()
	@IsString()
	app: string;

	@Expose()
	@IsString()
	@IsOptional()
	profile?: string;

	@Expose()
	@ValidateNested({ each: true })
	@Type(() => ShellyNgDeviceInfoAuthenticationModel)
	authentication: ShellyNgDeviceInfoAuthenticationModel;

	@Expose()
	@IsOptional()
	@IsBoolean()
	discoverable: boolean = true;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ShellyNgDeviceInfoComponentModel)
	components: ShellyNgDeviceInfoComponentModel[];
}
