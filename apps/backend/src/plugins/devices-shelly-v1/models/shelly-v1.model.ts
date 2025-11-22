import { Expose } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class ShellyV1SupportedDeviceModel {
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
	categories: string[];
}

export class ShellyV1DeviceInfoModel {
	@Expose()
	@IsBoolean()
	reachable: boolean;

	@Expose({ name: 'auth_required' })
	@IsBoolean()
	authRequired: boolean;

	@Expose({ name: 'auth_valid' })
	@IsOptional()
	@IsBoolean()
	authValid?: boolean;

	@Expose()
	@IsString()
	host: string;

	@Expose()
	@IsOptional()
	@IsString()
	ip?: string;

	@Expose()
	@IsOptional()
	@IsString()
	mac?: string;

	@Expose()
	@IsOptional()
	@IsString()
	model?: string;

	@Expose()
	@IsOptional()
	@IsString()
	firmware?: string;

	@Expose({ name: 'device_type' })
	@IsOptional()
	@IsString()
	deviceType?: string;

	@Expose()
	@IsOptional()
	@IsString()
	description?: string;
}
