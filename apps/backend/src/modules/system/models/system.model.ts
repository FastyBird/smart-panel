import { Expose, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	IsUrl,
	ValidateNested,
} from 'class-validator';

import {
	ExtensionKindType,
	ExtensionSourceType,
	ExtensionSurfaceType,
	LogEntrySource,
	LogEntryType,
} from '../system.constants';

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

export class SystemHealthModel {
	@Expose()
	@IsString()
	status: string;

	@Expose()
	@IsString()
	version: string;
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

export class LogEntryAcceptedModel {
	@Expose()
	@IsInt()
	accepted: number;

	@Expose()
	@IsInt()
	rejected: number;
}

export class LogEntryUserModel {
	@Expose()
	@IsOptional()
	@IsUUID('4')
	id?: string;
}

/**
 * Describes contextual data about the client environment at the time of logging.
 */
export class LogEntryContextModel {
	@Expose({ name: 'app_version' })
	@IsOptional()
	@IsString()
	appVersion?: string;

	@Expose()
	@IsOptional()
	@IsUrl()
	url?: string;

	@Expose({ name: 'user_agent' })
	@IsOptional()
	@IsString()
	userAgent?: string;

	@Expose()
	@IsOptional()
	@IsString()
	locale?: string;
}

export class LogEntryModel {
	@Expose()
	@IsString()
	id: string;

	@Expose()
	@IsString()
	ts: string;

	@Expose({ name: 'ingested_at' })
	@IsString()
	ingestedAt: string;

	@Expose()
	@IsInt()
	@IsOptional()
	seq?: number;

	@Expose()
	@IsOptional()
	@IsEnum(LogEntrySource)
	source?: LogEntrySource;

	@Expose()
	@IsInt()
	level: number;

	@Expose()
	@IsEnum(LogEntryType)
	type: LogEntryType;

	@Expose()
	@IsOptional()
	@IsString()
	tag?: string;

	@Expose()
	@IsOptional()
	@IsString()
	message?: string;

	@Expose()
	@IsOptional()
	@IsArray()
	args?: (string | number | boolean | Record<string, unknown> | (string | number | boolean | null)[] | null)[];

	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => LogEntryUserModel)
	user?: LogEntryUserModel;

	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => LogEntryContextModel)
	context?: LogEntryContextModel;
}

export abstract class ExtensionBaseModel {
	@Expose()
	@IsString()
	name: string;

	@Expose()
	@IsEnum(ExtensionKindType)
	kind: ExtensionKindType;

	@Expose()
	@IsEnum(ExtensionSurfaceType)
	surface: ExtensionSurfaceType;

	@Expose({ name: 'display_name' })
	@IsString()
	displayName: string;

	@Expose()
	@IsString()
	@IsOptional()
	description?: string;

	@Expose()
	@IsString()
	@IsOptional()
	version?: string;

	@Expose()
	@IsEnum(ExtensionSourceType)
	source: ExtensionSourceType;
}

export class ExtensionAdminModel extends ExtensionBaseModel {
	@Expose({ name: 'remote_url' })
	@IsString()
	remoteUrl: string;
}

export class ExtensionBackendModel extends ExtensionBaseModel {
	@Expose({ name: 'route_prefix' })
	@IsString()
	routePrefix: string;
}
