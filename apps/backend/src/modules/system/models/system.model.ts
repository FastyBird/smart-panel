import { Expose, Transform, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsDate,
	IsEnum,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	IsUrl,
	Min,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { toInstance } from '../../../common/utils/transform.utils';
import {
	ExtensionKindType,
	ExtensionSourceType,
	ExtensionSurfaceType,
	LogEntrySource,
	LogEntryType,
} from '../system.constants';

type LogArgPrimitive = string | number | boolean | null;
type EntryLogArg = LogArgPrimitive | Record<string, unknown> | LogArgPrimitive[];

@ApiSchema({ name: 'SystemModuleDataMemoryInfo' })
export class MemoryInfoModel {
	@ApiProperty({ description: 'Total memory in bytes', type: 'number', example: 8589934592 })
	@Expose()
	@IsNumber()
	total: number;

	@ApiProperty({ description: 'Used memory in bytes', type: 'number', example: 4294967296 })
	@Expose()
	@IsNumber()
	used: number;

	@ApiProperty({ description: 'Free memory in bytes', type: 'number', example: 4294967296 })
	@Expose()
	@IsNumber()
	free: number;
}

@ApiSchema({ name: 'SystemModuleDataStorageInfo' })
export class StorageInfoModel {
	@ApiProperty({ description: 'Filesystem', type: 'string', example: '/dev/sda1' })
	@Expose()
	@IsString()
	fs: string;

	@ApiProperty({ description: 'Used storage in bytes', type: 'number', example: 42949672960 })
	@Expose()
	@IsNumber()
	used: number;

	@ApiProperty({ description: 'Total storage size in bytes', type: 'number', example: 107374182400 })
	@Expose()
	@IsNumber()
	size: number;

	@ApiProperty({ description: 'Available storage in bytes', type: 'number', example: 64424509440 })
	@Expose()
	@IsNumber()
	available: number;
}

@ApiSchema({ name: 'SystemModuleDataTemperatureInfo' })
export class TemperatureInfoModel {
	@ApiPropertyOptional({ description: 'CPU temperature in Celsius', type: 'number', nullable: true, example: 45.5 })
	@Expose()
	@IsOptional()
	@IsNumber()
	cpu?: number | null;

	@ApiPropertyOptional({ description: 'GPU temperature in Celsius', type: 'number', nullable: true, example: 52.3 })
	@Expose()
	@IsOptional()
	@IsNumber()
	gpu?: number | null;
}

@ApiSchema({ name: 'SystemModuleDataOperatingSystemInfo' })
export class OperatingSystemInfoModel {
	@ApiProperty({ description: 'Operating system platform', type: 'string', example: 'linux' })
	@Expose()
	@IsString()
	platform: string;

	@ApiProperty({ description: 'OS distribution', type: 'string', example: 'Ubuntu' })
	@Expose()
	@IsString()
	distro: string;

	@ApiProperty({ description: 'OS release version', type: 'string', example: '20.04' })
	@Expose()
	@IsString()
	release: string;

	@ApiProperty({ description: 'System uptime in seconds', type: 'number', example: 86400 })
	@Expose()
	@IsNumber()
	uptime: number;

	@ApiProperty({ description: 'Node.js version', type: 'string', example: 'v18.17.0' })
	@Expose()
	@IsString()
	node: string;

	@ApiPropertyOptional({ description: 'npm version', type: 'string', nullable: true, example: '9.6.7' })
	@Expose()
	@IsOptional()
	@IsString()
	npm: string | null;

	@ApiProperty({ description: 'System timezone', type: 'string', example: 'UTC' })
	@Expose()
	@IsString()
	timezone: string;
}

@ApiSchema({ name: 'SystemModuleDataDisplayInfo' })
export class DisplayInfoModel {
	@ApiProperty({ name: 'resolution_x', description: 'Display resolution X', type: 'number', example: 1920 })
	@Expose({ name: 'resolution_x' })
	@IsNumber()
	resolutionX: number;

	@ApiProperty({ name: 'resolution_y', description: 'Display resolution Y', type: 'number', example: 1080 })
	@Expose({ name: 'resolution_y' })
	@IsNumber()
	resolutionY: number;

	@ApiProperty({ name: 'current_res_x', description: 'Current resolution X', type: 'number', example: 1920 })
	@Expose({ name: 'current_res_x' })
	@IsNumber()
	currentResX: number;

	@ApiProperty({ name: 'current_res_y', description: 'Current resolution Y', type: 'number', example: 1080 })
	@Expose({ name: 'current_res_y' })
	@IsNumber()
	currentResY: number;
}

@ApiSchema({ name: 'SystemModuleDataProcessInfo' })
export class ProcessInfoModel {
	@ApiProperty({ description: 'Process ID', type: 'number', example: 12345 })
	@Expose()
	@IsNumber()
	pid: number;

	@ApiProperty({ description: 'Process uptime in seconds', type: 'number', example: 3600 })
	@Expose()
	@IsNumber()
	uptime: number;
}

@ApiSchema({ name: 'SystemModuleDataNetworkStats' })
export class NetworkStatsModel {
	@ApiProperty({ description: 'Network interface name', type: 'string', example: 'eth0' })
	@Expose()
	@IsString()
	interface: string;

	@ApiProperty({ name: 'rx_bytes', description: 'Received bytes', type: 'number', example: 1073741824 })
	@Expose({ name: 'rx_bytes' })
	@IsNumber()
	rxBytes: number;

	@ApiProperty({ name: 'tx_bytes', description: 'Transmitted bytes', type: 'number', example: 536870912 })
	@Expose({ name: 'tx_bytes' })
	@IsNumber()
	txBytes: number;
}

@ApiSchema({ name: 'SystemModuleDataDefaultNetwork' })
export class DefaultNetworkModel {
	@ApiProperty({ description: 'Network interface name', type: 'string', example: 'eth0' })
	@Expose()
	@IsString()
	interface: string;

	@ApiProperty({ description: 'IPv4 address', type: 'string', example: '192.168.1.100' })
	@Expose()
	@IsString()
	ip4: string;

	@ApiProperty({ description: 'IPv6 address', type: 'string', example: 'fe80::1' })
	@Expose()
	@IsString()
	ip6: string;

	@ApiProperty({ description: 'MAC address', type: 'string', example: '00:1A:2B:3C:4D:5E' })
	@Expose()
	@IsString()
	mac: string;

	@ApiProperty({ description: 'Hostname', type: 'string', example: 'smart-panel' })
	@Expose()
	@IsString()
	hostname: string;
}

@ApiSchema({ name: 'SystemModuleDataSystemHealth' })
export class SystemHealthModel {
	@ApiProperty({ description: 'Health status', type: 'string', example: 'healthy' })
	@Expose()
	@IsString()
	status: string;

	@ApiProperty({ description: 'Application version', type: 'string', example: '1.0.0' })
	@Expose()
	@IsString()
	version: string;
}

@ApiSchema({ name: 'SystemModuleDataSystemInfo' })
export class SystemInfoModel {
	@ApiProperty({ name: 'cpu_load', description: 'CPU load percentage', type: 'number', example: 45.5 })
	@Expose({ name: 'cpu_load' })
	@IsNumber()
	cpuLoad: number;

	@ApiProperty({ description: 'Memory information', type: MemoryInfoModel })
	@Expose()
	@ValidateNested()
	@Type(() => MemoryInfoModel)
	memory: MemoryInfoModel;

	@ApiProperty({ description: 'Storage information', type: [StorageInfoModel] })
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => StorageInfoModel)
	storage: StorageInfoModel[];

	@ApiProperty({ name: 'primary_storage', description: 'Primary storage information', type: StorageInfoModel })
	@Expose({ name: 'primary_storage' })
	@ValidateNested()
	@Type(() => StorageInfoModel)
	primaryStorage: StorageInfoModel;

	@ApiProperty({ description: 'Temperature information', type: TemperatureInfoModel })
	@Expose()
	@ValidateNested()
	@Type(() => TemperatureInfoModel)
	temperature: TemperatureInfoModel;

	@ApiProperty({ description: 'Operating system information', type: OperatingSystemInfoModel })
	@Expose()
	@ValidateNested()
	@Type(() => OperatingSystemInfoModel)
	os: OperatingSystemInfoModel;

	@ApiProperty({ description: 'Network statistics', type: [NetworkStatsModel] })
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => NetworkStatsModel)
	network: NetworkStatsModel[];

	@ApiProperty({ name: 'default_network', description: 'Default network information', type: DefaultNetworkModel })
	@Expose({ name: 'default_network' })
	@ValidateNested()
	@Type(() => DefaultNetworkModel)
	defaultNetwork: DefaultNetworkModel;

	@ApiProperty({ description: 'Display information', type: DisplayInfoModel })
	@Expose()
	@ValidateNested()
	@Type(() => DisplayInfoModel)
	display: DisplayInfoModel;

	@ApiProperty({ description: 'Process information', type: ProcessInfoModel })
	@Expose()
	@ValidateNested()
	@Type(() => ProcessInfoModel)
	process: ProcessInfoModel;
}

@ApiSchema({ name: 'SystemModuleDataThrottleStatus' })
export class ThrottleStatusModel {
	@ApiProperty({ description: 'Undervoltage detected', type: 'boolean', example: false })
	@Expose()
	@IsBoolean()
	undervoltage: boolean;

	@ApiProperty({ name: 'frequency_capping', description: 'Frequency capping active', type: 'boolean', example: false })
	@Expose({ name: 'frequency_capping' })
	@IsBoolean()
	frequencyCapping: boolean;

	@ApiProperty({ description: 'Throttling active', type: 'boolean', example: false })
	@Expose()
	@IsBoolean()
	throttling: boolean;

	@ApiProperty({
		name: 'soft_temp_limit',
		description: 'Soft temperature limit reached',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'soft_temp_limit' })
	@IsBoolean()
	softTempLimit: boolean;
}

@ApiSchema({ name: 'SystemModuleDataLogEntryError' })
export class LogEntryErrorModel {
	@ApiProperty({
		description: 'Zero-based index of the log event within the submitted `data` array that caused an error.',
		type: 'integer',
		minimum: 0,
		example: 0,
	})
	@Expose()
	@IsInt()
	@Min(0)
	index: number;

	@ApiProperty({
		description: 'Short, human-readable reason describing why the log event was rejected.',
		type: 'string',
		example: 'Invalid log level value.',
	})
	@Expose()
	@IsString()
	reason: string;

	@ApiPropertyOptional({
		description: 'Optional object with additional error details, such as schema validation paths or expected types.',
		type: 'object',
		additionalProperties: true,
	})
	@Expose()
	@IsOptional()
	details?: Record<string, unknown>;
}

@ApiSchema({ name: 'SystemModuleDataLogEntryAccepted' })
export class LogEntryAcceptedModel {
	@ApiProperty({ description: 'Number of accepted log entries', type: 'integer', example: 150 })
	@Expose()
	@IsInt()
	accepted: number;

	@ApiProperty({ description: 'Number of rejected log entries', type: 'integer', example: 2 })
	@Expose()
	@IsInt()
	rejected: number;

	@ApiPropertyOptional({
		description:
			'Optional list of validation or processing errors for rejected items. Each entry references the index of the rejected log event in the original request batch.',
		type: 'array',
		items: { $ref: getSchemaPath(LogEntryErrorModel) },
	})
	@Expose()
	@IsOptional()
	@IsArray()
	errors?: LogEntryErrorModel[];
}

@ApiSchema({ name: 'SystemModuleDataLogEntryUser' })
export class LogEntryUserModel {
	@ApiPropertyOptional({ description: 'User ID', format: 'uuid', example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6' })
	@Expose()
	@IsOptional()
	@IsUUID('4')
	id?: string;
}

@ApiSchema({ name: 'SystemModuleDataLogEntryContext' })
export class LogEntryContextModel {
	@ApiPropertyOptional({ name: 'app_version', description: 'Application version', type: 'string', example: '1.0.0' })
	@Expose({ name: 'app_version' })
	@IsOptional()
	@IsString()
	appVersion?: string;

	@ApiPropertyOptional({ description: 'Request URL', type: 'string', format: 'uri', example: 'https://example.com' })
	@Expose()
	@IsOptional()
	@IsUrl()
	url?: string;

	@ApiPropertyOptional({ name: 'user_agent', description: 'User agent string', type: 'string' })
	@Expose({ name: 'user_agent' })
	@IsOptional()
	@IsString()
	userAgent?: string;

	@ApiPropertyOptional({ description: 'User locale', type: 'string', example: 'en-US' })
	@Expose()
	@IsOptional()
	@IsString()
	locale?: string;
}

@ApiSchema({ name: 'SystemModuleDataLogEntry' })
export class LogEntryModel {
	@ApiProperty({ description: 'Log entry ID', type: 'string', example: 'log-12345' })
	@Expose()
	@IsString()
	id: string;

	@ApiProperty({ description: 'Timestamp', type: 'string', format: 'date-time', example: '2024-01-24T10:30:00.000Z' })
	@Expose()
	@IsString()
	ts: string;

	@ApiProperty({ name: 'ingested_at', description: 'Ingestion timestamp', type: 'string', format: 'date-time' })
	@Expose({ name: 'ingested_at' })
	@IsString()
	ingestedAt: string;

	@ApiPropertyOptional({ description: 'Sequence number', type: 'integer', example: 1 })
	@Expose()
	@IsInt()
	@IsOptional()
	seq?: number;

	@ApiPropertyOptional({ description: 'Log entry source', enum: LogEntrySource })
	@Expose()
	@IsOptional()
	@IsString()
	@IsEnum(LogEntrySource)
	source?: LogEntrySource;

	@ApiProperty({ description: 'Log level', type: 'integer', minimum: 0, maximum: 6, example: 3 })
	@Expose()
	@IsInt()
	level: number;

	@ApiProperty({ description: 'Log entry type', enum: LogEntryType })
	@Expose()
	@IsEnum(LogEntryType)
	type: LogEntryType;

	@ApiPropertyOptional({ description: 'Log tag', type: 'string', example: 'user-action' })
	@Expose()
	@IsOptional()
	@IsString()
	tag?: string;

	@ApiPropertyOptional({ description: 'Log message', type: 'string', example: 'User performed an action' })
	@Expose()
	@IsOptional()
	@IsString()
	message?: string;

	@ApiPropertyOptional({
		description:
			'Optional array of structured arguments providing additional context, parameters, or error details associated with the log event. The values are JSON-safe, and the server should sanitize them before storage.',
		type: 'array',
		maxItems: 20,
		items: {
			description:
				'Arbitrary JSON value used as a supplementary argument to the log message. Can include nested objects or arrays.',
			anyOf: [
				{ type: 'string' },
				{ type: 'number' },
				{ type: 'boolean' },
				{ type: 'object', additionalProperties: true },
				{
					type: 'array',
					items: {
						anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'null' }],
					},
				},
				{ type: 'null' },
			],
		},
	})
	@Expose()
	@IsOptional()
	@IsArray()
	args?: EntryLogArg[];

	@ApiPropertyOptional({ description: 'User information', type: LogEntryUserModel })
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => LogEntryUserModel)
	user?: LogEntryUserModel;

	@ApiPropertyOptional({ description: 'Context information', type: LogEntryContextModel })
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => LogEntryContextModel)
	context?: LogEntryContextModel;
}

@ApiSchema({ name: 'SystemModuleDataExtensionBase' })
export abstract class ExtensionBaseModel {
	@ApiProperty({ description: 'Extension name', type: 'string', example: 'my-extension' })
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({ description: 'Extension kind', enum: ExtensionKindType })
	@Expose()
	@IsEnum(ExtensionKindType)
	kind: ExtensionKindType;

	@ApiProperty({ description: 'Extension surface', enum: ExtensionSurfaceType })
	@Expose()
	@IsEnum(ExtensionSurfaceType)
	surface: ExtensionSurfaceType;

	@ApiProperty({ name: 'display_name', description: 'Display name', type: 'string', example: 'My Extension' })
	@Expose({ name: 'display_name' })
	@IsString()
	displayName: string;

	@ApiPropertyOptional({
		description: 'Extension description',
		type: 'string',
		nullable: true,
		example: 'A useful extension',
	})
	@Expose()
	@IsString()
	@IsOptional()
	description?: string | null = null;

	@ApiPropertyOptional({ description: 'Extension version', type: 'string', nullable: true, example: '1.0.0' })
	@Expose()
	@IsString()
	@IsOptional()
	version?: string | null = null;

	@ApiProperty({ description: 'Extension source', enum: ExtensionSourceType })
	@Expose()
	@IsEnum(ExtensionSourceType)
	source: ExtensionSourceType;
}

@ApiSchema({ name: 'SystemModuleDataExtensionAdmin' })
export class ExtensionAdminModel extends ExtensionBaseModel {
	@ApiProperty({ name: 'remote_url', description: 'Remote URL', type: 'string', format: 'uri' })
	@Expose({ name: 'remote_url' })
	@IsString()
	remoteUrl: string;
}

@ApiSchema({ name: 'SystemModuleDataExtensionBackend' })
export class ExtensionBackendModel extends ExtensionBaseModel {
	@ApiProperty({ name: 'route_prefix', description: 'Route prefix', type: 'string', example: '/api' })
	@Expose({ name: 'route_prefix' })
	@IsString()
	routePrefix: string;
}

@ApiSchema({ name: 'SystemModuleDataCpuLoad1m' })
export class CpuLoad1mModel {
	@ApiProperty({ description: 'CPU load 1 minute', type: 'number', example: 0.45 })
	@Expose()
	@IsNumber()
	value: number;

	@ApiProperty({ name: 'last_updated', description: 'Last updated timestamp', type: 'string', format: 'date-time' })
	@Expose({ name: 'last_updated' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { last_updated?: string | Date; lastUpdated?: string | Date } }) => {
			const value: string | Date = obj.last_updated || obj.lastUpdated;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastUpdated: Date;
}

@ApiSchema({ name: 'SystemModuleDataMemUsedPct' })
export class MemUsedPctModel {
	@ApiProperty({ description: 'Memory used percentage', type: 'number', example: 65.5 })
	@Expose()
	@IsNumber()
	value: number;

	@ApiProperty({ name: 'last_updated', description: 'Last updated timestamp', type: 'string', format: 'date-time' })
	@Expose({ name: 'last_updated' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { last_updated?: string | Date; lastUpdated?: string | Date } }) => {
			const value: string | Date = obj.last_updated || obj.lastUpdated;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastUpdated: Date;
}

@ApiSchema({ name: 'SystemModuleDataDiskUsedPct' })
export class DiskUsedPctModel {
	@ApiProperty({ description: 'Disk used percentage', type: 'number', example: 42.3 })
	@Expose()
	@IsNumber()
	value: number;

	@ApiProperty({ name: 'last_updated', description: 'Last updated timestamp', type: 'string', format: 'date-time' })
	@Expose({ name: 'last_updated' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { last_updated?: string | Date; lastUpdated?: string | Date } }) => {
			const value: string | Date = obj.last_updated || obj.lastUpdated;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastUpdated: Date;
}

@ApiSchema({ name: 'SystemModuleDataSystemUptimeSec' })
export class SystemUptimeSecModel {
	@ApiProperty({ description: 'System uptime in seconds', type: 'number', example: 86400 })
	@Expose()
	@IsNumber()
	value: number;

	@ApiProperty({ name: 'last_updated', description: 'Last updated timestamp', type: 'string', format: 'date-time' })
	@Expose({ name: 'last_updated' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { last_updated?: string | Date; lastUpdated?: string | Date } }) => {
			const value: string | Date = obj.last_updated || obj.lastUpdated;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastUpdated: Date;
}

@ApiSchema({ name: 'SystemModuleDataProcessUptimeSec' })
export class ProcessUptimeSecModel {
	@ApiProperty({ description: 'Process uptime in seconds', type: 'number', example: 3600 })
	@Expose()
	@IsNumber()
	value: number;

	@ApiProperty({ name: 'last_updated', description: 'Last updated timestamp', type: 'string', format: 'date-time' })
	@Expose({ name: 'last_updated' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { last_updated?: string | Date; lastUpdated?: string | Date } }) => {
			const value: string | Date = obj.last_updated || obj.lastUpdated;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastUpdated: Date;
}

@ApiSchema({ name: 'SystemModuleDataTemperatureCpu' })
export class TemperatureCpuModel {
	@ApiProperty({ description: 'CPU temperature in Celsius', type: 'number', nullable: true, example: 45.5 })
	@Expose()
	@IsNumber()
	value: number | null;

	@ApiProperty({ name: 'last_updated', description: 'Last updated timestamp', type: 'string', format: 'date-time' })
	@Expose({ name: 'last_updated' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { last_updated?: string | Date; lastUpdated?: string | Date } }) => {
			const value: string | Date = obj.last_updated || obj.lastUpdated;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastUpdated: Date;
}

@ApiSchema({ name: 'SystemModuleDataTemperatureGpu' })
export class TemperatureGpuModel {
	@ApiProperty({ description: 'GPU temperature in Celsius', type: 'number', nullable: true, example: 52.3 })
	@Expose()
	@IsNumber()
	value: number | null;

	@ApiProperty({ name: 'last_updated', description: 'Last updated timestamp', type: 'string', format: 'date-time' })
	@Expose({ name: 'last_updated' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { last_updated?: string | Date; lastUpdated?: string | Date } }) => {
			const value: string | Date = obj.last_updated || obj.lastUpdated;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastUpdated: Date;
}

@ApiSchema({ name: 'SystemModuleDataModuleStats' })
export class ModuleStatsModel {
	@ApiProperty({ name: 'cpu_load_1m', description: 'CPU load (1 minute average)', type: CpuLoad1mModel })
	@Expose({ name: 'cpu_load_1m' })
	@Transform(
		({ obj }: { obj: { cpuLoad1m?: unknown; cpu_load_1m?: unknown; cpu_load1m?: unknown } }) => {
			const value: { value?: number; lastUpdated?: Date | string; last_updated?: Date | string } =
				obj.cpuLoad1m ?? obj.cpu_load_1m ?? obj.cpu_load1m ?? undefined;

			return toInstance(CpuLoad1mModel, {
				value: 'value' in value ? value['value'] : undefined,
				lastUpdated:
					'lastUpdated' in value ? value['lastUpdated'] : 'last_updated' in value ? value['last_updated'] : undefined,
			});
		},
		{
			toClassOnly: true,
		},
	)
	@ValidateNested()
	@Type(() => CpuLoad1mModel)
	cpuLoad1m: CpuLoad1mModel;

	@ApiProperty({ name: 'mem_used_pct', description: 'Memory used percentage', type: MemUsedPctModel })
	@Expose({ name: 'mem_used_pct' })
	@ValidateNested()
	@Type(() => MemUsedPctModel)
	memUsedPct: MemUsedPctModel;

	@ApiProperty({ name: 'disk_used_pct', description: 'Disk used percentage', type: DiskUsedPctModel })
	@Expose({ name: 'disk_used_pct' })
	@ValidateNested()
	@Type(() => DiskUsedPctModel)
	diskUsedPct: DiskUsedPctModel;

	@ApiProperty({ name: 'system_uptime_sec', description: 'System uptime', type: SystemUptimeSecModel })
	@Expose({ name: 'system_uptime_sec' })
	@ValidateNested()
	@Type(() => SystemUptimeSecModel)
	systemUptimeSec: SystemUptimeSecModel;

	@ApiProperty({ name: 'process_uptime_sec', description: 'Process uptime', type: ProcessUptimeSecModel })
	@Expose({ name: 'process_uptime_sec' })
	@ValidateNested()
	@Type(() => ProcessUptimeSecModel)
	processUptimeSec: ProcessUptimeSecModel;

	@ApiProperty({ name: 'temperature_cpu', description: 'CPU temperature', type: TemperatureCpuModel })
	@Expose({ name: 'temperature_cpu' })
	@ValidateNested()
	@Type(() => TemperatureCpuModel)
	temperatureCpu: TemperatureCpuModel;

	@ApiProperty({ name: 'temperature_gpu', description: 'GPU temperature', type: TemperatureGpuModel })
	@Expose({ name: 'temperature_gpu' })
	@ValidateNested()
	@Type(() => TemperatureGpuModel)
	temperatureGpu: TemperatureGpuModel;
}
