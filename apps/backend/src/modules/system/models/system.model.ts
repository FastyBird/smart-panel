import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class MemoryInfoModel {
	@Expose()
	@IsNumber()
	total: number;

	@Expose()
	@IsNumber()
	used: number;

	@Expose()
	@IsNumber()
	free: number;
}

export class StorageInfoModel {
	@Expose()
	@IsString()
	fs: string;

	@Expose()
	@IsNumber()
	used: number;

	@Expose()
	@IsNumber()
	size: number;

	@Expose()
	@IsNumber()
	available: number;
}

export class TemperatureInfoModel {
	@Expose()
	@IsOptional()
	@IsNumber()
	cpu?: number;

	@Expose()
	@IsOptional()
	@IsNumber()
	gpu?: number;
}

export class OperatingSystemInfoModel {
	@Expose()
	@IsString()
	platform: string;

	@Expose()
	@IsString()
	distro: string;

	@Expose()
	@IsString()
	release: string;

	@Expose()
	@IsNumber()
	uptime: number;
}

export class DisplayInfoModel {
	@Expose({ name: 'resolution_x' })
	@IsNumber()
	resolutionX: number;

	@Expose({ name: 'resolution_y' })
	@IsNumber()
	resolutionY: number;

	@Expose({ name: 'current_res_x' })
	@IsNumber()
	currentResX: number;

	@Expose({ name: 'current_res_y' })
	@IsNumber()
	currentResY: number;
}

export class NetworkStatsModel {
	@Expose()
	@IsString()
	interface: string;

	@Expose({ name: 'rx_bytes' })
	@IsNumber()
	rxBytes: number;

	@Expose({ name: 'tx_bytes' })
	@IsNumber()
	txBytes: number;
}

export class DefaultNetworkModel {
	@Expose()
	@IsString()
	interface: string;

	@Expose()
	@IsString()
	ip4: string;

	@Expose()
	@IsString()
	ip6: string;

	@Expose()
	@IsString()
	mac: string;
}

export class SystemInfoModel {
	@Expose({ name: 'cpu_load' })
	@IsNumber()
	cpuLoad: number;

	@Expose()
	@ValidateNested()
	@Type(() => MemoryInfoModel)
	memory: MemoryInfoModel;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => StorageInfoModel)
	storage: StorageInfoModel[];

	@Expose()
	@ValidateNested()
	@Type(() => TemperatureInfoModel)
	temperature: TemperatureInfoModel;

	@Expose()
	@ValidateNested()
	@Type(() => OperatingSystemInfoModel)
	os: OperatingSystemInfoModel;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => NetworkStatsModel)
	network: NetworkStatsModel[];

	@Expose({ name: 'default_network' })
	@ValidateNested()
	@Type(() => DefaultNetworkModel)
	defaultNetwork: DefaultNetworkModel;

	@Expose()
	@ValidateNested()
	@Type(() => DisplayInfoModel)
	display: DisplayInfoModel;
}

export class ThrottleStatusModel {
	@Expose()
	@IsBoolean()
	undervoltage: boolean;

	@Expose({ name: 'frequency_capping' })
	@IsBoolean()
	frequencyCapping: boolean;

	@Expose()
	@IsBoolean()
	throttling: boolean;

	@Expose({ name: 'soft_temp_limit' })
	@IsBoolean()
	softTempLimit: boolean;
}
