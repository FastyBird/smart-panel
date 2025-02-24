import { Type } from 'class-transformer';
import { IsNumber, IsString, ValidateNested } from 'class-validator';

import { NetworkStatsDto } from './network-stats.dto';
import { TemperatureDto } from './temperature.dto';

export class MemoryDto {
	@IsNumber()
	total: number;

	@IsNumber()
	used: number;

	@IsNumber()
	free: number;
}

export class StorageDto {
	@IsString()
	fs: string;

	@IsNumber()
	used: number;

	@IsNumber()
	size: number;

	@IsNumber()
	available: number;
}

export class OperatingSystemDto {
	@IsString()
	platform: string;

	@IsString()
	distro: string;

	@IsString()
	release: string;

	@IsNumber()
	uptime: number;
}

export class DefaultNetworkDto {
	@IsString()
	interface: string;

	@IsString()
	ip4: string;

	@IsString()
	ip6: string;

	@IsString()
	mac: string;
}

export class DisplayDto {
	@IsNumber()
	resolutionX: number;

	@IsNumber()
	resolutionY: number;

	@IsNumber()
	currentResX: number;

	@IsNumber()
	currentResY: number;
}

export class SystemInfoDto {
	@IsNumber()
	cpuLoad: number;

	@ValidateNested()
	@Type(() => MemoryDto)
	memory: MemoryDto;

	@ValidateNested({ each: true })
	@Type(() => StorageDto)
	storage: StorageDto[];

	@ValidateNested()
	@Type(() => OperatingSystemDto)
	os: OperatingSystemDto;

	@ValidateNested()
	@Type(() => TemperatureDto)
	temperature: TemperatureDto;

	@ValidateNested({ each: true })
	@Type(() => NetworkStatsDto)
	network: NetworkStatsDto[];

	@ValidateNested()
	@Type(() => DefaultNetworkDto)
	defaultNetwork: DefaultNetworkDto;

	@ValidateNested()
	@Type(() => DisplayDto)
	display: DisplayDto;
}
