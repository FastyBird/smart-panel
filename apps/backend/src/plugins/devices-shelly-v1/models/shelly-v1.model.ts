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
	@Expose({ name: 'reachable' })
	@IsBoolean()
	reachable: boolean;

	@Expose({ name: 'auth_required' })
	@IsBoolean()
	authRequired: boolean;

	@Expose({ name: 'auth_valid' })
	@IsOptional()
	@IsBoolean()
	authValid?: boolean;

	@Expose({ name: 'host' })
	@IsString()
	host: string;

	@Expose({ name: 'ip' })
	@IsOptional()
	@IsString()
	ip?: string;

	@Expose({ name: 'mac' })
	@IsOptional()
	@IsString()
	mac?: string;

	@Expose({ name: 'model' })
	@IsOptional()
	@IsString()
	model?: string;

	@Expose({ name: 'firmware' })
	@IsOptional()
	@IsString()
	firmware?: string;

	@Expose({ name: 'device_type' })
	@IsOptional()
	@IsString()
	deviceType?: string;

	@Expose({ name: 'descriptor_key' })
	@IsOptional()
	@IsString()
	descriptorKey?: string;

	@Expose({ name: 'description' })
	@IsOptional()
	@IsString()
	description?: string;
}
