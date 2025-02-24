import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class MemoryInfoEntity {
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

export class StorageInfoEntity {
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

export class TemperatureInfoEntity {
	@Expose()
	@IsOptional()
	@IsNumber()
	cpu?: number;

	@Expose()
	@IsOptional()
	@IsNumber()
	gpu?: number;
}

export class OperatingSystemInfoEntity {
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

export class DisplayInfoEntity {
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

export class NetworkStatsEntity {
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

export class DefaultNetwork {
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

export class SystemInfoEntity {
	@Expose({ name: 'cpu_load' })
	@IsNumber()
	cpuLoad: number;

	@Expose()
	@ValidateNested()
	@Type(() => MemoryInfoEntity)
	memory: MemoryInfoEntity;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => StorageInfoEntity)
	storage: StorageInfoEntity[];

	@Expose()
	@ValidateNested()
	@Type(() => TemperatureInfoEntity)
	temperature: TemperatureInfoEntity;

	@Expose()
	@ValidateNested()
	@Type(() => OperatingSystemInfoEntity)
	os: OperatingSystemInfoEntity;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => NetworkStatsEntity)
	network: NetworkStatsEntity[];

	@Expose({ name: 'default_network' })
	@ValidateNested()
	@Type(() => DefaultNetwork)
	defaultNetwork: DefaultNetwork;

	@Expose()
	@ValidateNested()
	@Type(() => DisplayInfoEntity)
	display: DisplayInfoEntity;
}

export class ThrottleStatusEntity {
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
