import { Expose, Type } from 'class-transformer';
import { IsNumber, IsString, ValidateNested } from 'class-validator';

import { NetworkStatsDto } from './network-stats.dto';
import { TemperatureDto } from './temperature.dto';

export class MemoryDto {
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

export class StorageDto {
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

export class OperatingSystemDto {
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

export class DefaultNetworkDto {
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

export class DisplayDto {
	@Expose()
	@IsNumber()
	resolution_x: number;

	@Expose()
	@IsNumber()
	resolution_y: number;

	@Expose()
	@IsNumber()
	current_res_x: number;

	@Expose()
	@IsNumber()
	current_res_y: number;
}

export class SystemInfoDto {
	@Expose()
	@IsNumber()
	cpu_load: number;

	@Expose()
	@ValidateNested()
	@Type(() => MemoryDto)
	memory: MemoryDto;

	@Expose()
	@ValidateNested({ each: true })
	@Type(() => StorageDto)
	storage: StorageDto[];

	@Expose()
	@ValidateNested()
	@Type(() => OperatingSystemDto)
	os: OperatingSystemDto;

	@Expose()
	@ValidateNested()
	@Type(() => TemperatureDto)
	temperature: TemperatureDto;

	@Expose()
	@ValidateNested({ each: true })
	@Type(() => NetworkStatsDto)
	network: NetworkStatsDto[];

	@Expose()
	@ValidateNested()
	@Type(() => DefaultNetworkDto)
	default_network: DefaultNetworkDto;

	@Expose()
	@ValidateNested()
	@Type(() => DisplayDto)
	display: DisplayDto;
}
