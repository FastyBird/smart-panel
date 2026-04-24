import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { DeviceCategory } from '../../../modules/devices/devices.constants';

@ApiSchema({ name: 'DevicesShellyNgPluginDataSupportedDeviceComponent' })
export class ShellyNgSupportedDeviceComponentModel {
	@ApiProperty({
		description: 'Component type',
		example: 'switch',
	})
	@Expose()
	@IsString()
	type: string;

	@ApiProperty({
		description: 'Component IDs',
		type: 'array',
		items: { type: 'number' },
		example: [0, 1],
	})
	@Expose()
	@IsArray()
	@IsInt({ each: true })
	ids: number[];
}

@ApiSchema({ name: 'DevicesShellyNgPluginDataSupportedDeviceSystemComponent' })
export class ShellyNgSupportedDeviceSystemComponentModel {
	@ApiProperty({
		description: 'System component type',
		example: 'wifi',
	})
	@Expose()
	@IsString()
	type: string;
}

@ApiSchema({ name: 'DevicesShellyNgPluginDataSupportedDevice' })
export class ShellyNgSupportedDeviceModel {
	@ApiProperty({
		description: 'Device group',
		example: 'gen2',
	})
	@Expose()
	@IsString()
	group: string;

	@ApiProperty({
		description: 'Device name',
		example: 'Shelly Plus 1',
	})
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({
		description: 'Supported device models',
		type: 'array',
		items: { type: 'string' },
		example: ['SNSW-001P16EU', 'SNSW-001P16UK'],
	})
	@Expose()
	@IsArray()
	@IsString({ each: true })
	models: string[];

	@ApiProperty({
		description: 'Device categories',
		type: 'array',
		items: { type: 'string', enum: Object.values(DeviceCategory) },
		example: [DeviceCategory.GENERIC],
	})
	@Expose()
	@IsArray()
	@IsString({ each: true })
	categories: DeviceCategory[];

	@ApiProperty({
		description: 'Device components',
		type: 'array',
		items: { $ref: getSchemaPath(ShellyNgSupportedDeviceComponentModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ShellyNgSupportedDeviceComponentModel)
	components: ShellyNgSupportedDeviceComponentModel[];

	@ApiProperty({
		description: 'System components',
		type: 'array',
		items: { $ref: getSchemaPath(ShellyNgSupportedDeviceSystemComponentModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ShellyNgSupportedDeviceSystemComponentModel)
	system: ShellyNgSupportedDeviceSystemComponentModel[];
}

@ApiSchema({ name: 'DevicesShellyNgPluginDataDeviceInfoComponent' })
export class ShellyNgDeviceInfoComponentModel {
	@ApiProperty({
		description: 'Component type',
		example: 'switch',
	})
	@Expose()
	@IsString()
	type: string;

	@ApiProperty({
		description: 'Component IDs',
		type: 'array',
		items: { type: 'number' },
		example: [0, 1],
	})
	@Expose()
	@IsArray()
	@IsInt({ each: true })
	ids: number[];
}

@ApiSchema({ name: 'DevicesShellyNgPluginDataDeviceInfoAuthentication' })
export class ShellyNgDeviceInfoAuthenticationModel {
	@ApiPropertyOptional({
		description: 'Authentication domain',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsString()
	@IsOptional()
	domain: string | null;

	@ApiPropertyOptional({
		description: 'Whether authentication is enabled',
		example: false,
	})
	@Expose()
	@IsBoolean()
	@IsOptional()
	enabled: boolean = false;
}

@ApiSchema({ name: 'DevicesShellyNgPluginDataDeviceInfo' })
export class ShellyNgDeviceInfoModel {
	@ApiProperty({
		description: 'Device identifier',
		example: 'shellyplus1-a8032abe5084',
	})
	@Expose()
	@IsString()
	id: string;

	@ApiPropertyOptional({
		description: 'Device name',
		nullable: true,
		example: 'My Shelly Device',
	})
	@Expose()
	@IsOptional()
	@IsString()
	name: string | null = null;

	@ApiProperty({
		description: 'Device MAC address',
		example: 'A8032ABE5084',
	})
	@Expose()
	@IsString()
	mac: string;

	@ApiProperty({
		description: 'Device model',
		example: 'SNSW-001P16EU',
	})
	@Expose()
	@IsString()
	model: string;

	@ApiProperty({
		description: 'Firmware version',
		example: '1.0.0',
	})
	@Expose()
	@IsString()
	firmware: string;

	@ApiProperty({
		description: 'Application name',
		example: 'Plus1',
	})
	@Expose()
	@IsString()
	app: string;

	@ApiPropertyOptional({
		description: 'Device profile',
		example: 'switch',
	})
	@Expose()
	@IsString()
	@IsOptional()
	profile?: string;

	@ApiProperty({
		description: 'Authentication configuration',
		type: () => ShellyNgDeviceInfoAuthenticationModel,
	})
	@Expose()
	@ValidateNested({ each: true })
	@Type(() => ShellyNgDeviceInfoAuthenticationModel)
	authentication: ShellyNgDeviceInfoAuthenticationModel;

	@ApiPropertyOptional({
		description: 'Whether device is discoverable',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean()
	discoverable: boolean = true;

	@ApiProperty({
		description: 'Device components',
		type: 'array',
		items: { $ref: getSchemaPath(ShellyNgDeviceInfoComponentModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ShellyNgDeviceInfoComponentModel)
	components: ShellyNgDeviceInfoComponentModel[];
}

@ApiSchema({ name: 'DevicesShellyNgPluginDataDiscoveryDeviceAuthentication' })
export class ShellyNgDiscoveryDeviceAuthenticationModel {
	@ApiProperty({
		description: 'Whether authentication is enabled',
		example: false,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean;

	@ApiPropertyOptional({
		description: 'Authentication domain',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsString()
	@IsOptional()
	domain: string | null;
}

@ApiSchema({ name: 'DevicesShellyNgPluginDataDiscoveryDevice' })
export class ShellyNgDiscoveryDeviceModel {
	@ApiPropertyOptional({
		description: 'Shelly device identifier',
		nullable: true,
		example: 'shellyplus1-a8032abe5084',
	})
	@Expose()
	@IsString()
	@IsOptional()
	identifier: string | null;

	@ApiProperty({
		description: 'Discovered hostname or IP address',
		example: '192.168.1.100',
	})
	@Expose()
	@IsString()
	hostname: string;

	@ApiPropertyOptional({
		description: 'Device name',
		nullable: true,
		example: 'Kitchen relay',
	})
	@Expose()
	@IsString()
	@IsOptional()
	name: string | null;

	@ApiPropertyOptional({
		description: 'Device model',
		nullable: true,
		example: 'SNSW-001P16EU',
	})
	@Expose()
	@IsString()
	@IsOptional()
	model: string | null;

	@ApiPropertyOptional({
		description: 'Friendly supported-device name',
		nullable: true,
		example: 'Shelly Plus 1',
	})
	@Expose()
	@IsString()
	@IsOptional()
	displayName: string | null;

	@ApiPropertyOptional({
		description: 'Firmware version',
		nullable: true,
		example: '1.0.0',
	})
	@Expose()
	@IsString()
	@IsOptional()
	firmware: string | null;

	@ApiProperty({
		description: 'Discovery candidate status',
		enum: ['checking', 'ready', 'needs_password', 'already_registered', 'unsupported', 'failed'],
		example: 'ready',
	})
	@Expose()
	@IsIn(['checking', 'ready', 'needs_password', 'already_registered', 'unsupported', 'failed'])
	status: string;

	@ApiProperty({
		description: 'How the candidate was found',
		enum: ['mdns', 'manual'],
		example: 'mdns',
	})
	@Expose()
	@IsIn(['mdns', 'manual'])
	source: string;

	@ApiProperty({
		description: 'Available target device categories',
		type: 'array',
		items: { type: 'string', enum: Object.values(DeviceCategory) },
		example: [DeviceCategory.LIGHTING, DeviceCategory.SWITCHER],
	})
	@Expose()
	@IsArray()
	@IsString({ each: true })
	categories: DeviceCategory[];

	@ApiPropertyOptional({
		description: 'Suggested target device category when the plugin can infer one',
		nullable: true,
		enum: DeviceCategory,
		example: DeviceCategory.LIGHTING,
	})
	@Expose()
	@IsString()
	@IsOptional()
	suggestedCategory: DeviceCategory | null;

	@ApiProperty({
		description: 'Authentication configuration',
		type: () => ShellyNgDiscoveryDeviceAuthenticationModel,
	})
	@Expose()
	@ValidateNested({ each: true })
	@Type(() => ShellyNgDiscoveryDeviceAuthenticationModel)
	authentication: ShellyNgDiscoveryDeviceAuthenticationModel;

	@ApiPropertyOptional({
		description: 'Already registered device id',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsString()
	@IsOptional()
	registeredDeviceId: string | null;

	@ApiPropertyOptional({
		description: 'Already registered device name',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsString()
	@IsOptional()
	registeredDeviceName: string | null;

	@ApiPropertyOptional({
		description:
			'Already registered device category — used to pre-fill the wizard so adopted devices keep their existing category by default',
		enum: DeviceCategory,
		nullable: true,
		example: DeviceCategory.LIGHTING,
	})
	@Expose()
	@IsIn(Object.values(DeviceCategory))
	@IsOptional()
	registeredDeviceCategory: DeviceCategory | null;

	@ApiPropertyOptional({
		description: 'Error message from the last lookup attempt',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsString()
	@IsOptional()
	error: string | null;

	@ApiProperty({
		description: 'Last time this candidate was observed or checked',
		example: '2026-04-29T12:00:00.000Z',
	})
	@Expose()
	@IsString()
	lastSeenAt: string;
}

@ApiSchema({ name: 'DevicesShellyNgPluginDataDiscoverySession' })
export class ShellyNgDiscoverySessionModel {
	@ApiProperty({
		description: 'Discovery session id',
		example: 'c66808d8-0af1-4b93-bd61-4131cf62f20f',
	})
	@Expose()
	@IsString()
	id: string;

	@ApiProperty({
		description: 'Discovery session status',
		enum: ['running', 'finished', 'failed'],
		example: 'running',
	})
	@Expose()
	@IsIn(['running', 'finished', 'failed'])
	status: string;

	@ApiProperty({
		description: 'Discovery start timestamp',
		example: '2026-04-29T12:00:00.000Z',
	})
	@Expose()
	@IsString()
	startedAt: string;

	@ApiProperty({
		description: 'Discovery expiry timestamp',
		example: '2026-04-29T12:00:30.000Z',
	})
	@Expose()
	@IsString()
	expiresAt: string;

	@ApiProperty({
		description: 'Remaining discovery time in seconds',
		example: 30,
	})
	@Expose()
	@IsInt()
	remainingSeconds: number;

	@ApiProperty({
		description: 'Discovered Shelly NG device candidates',
		type: 'array',
		items: { $ref: getSchemaPath(ShellyNgDiscoveryDeviceModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ShellyNgDiscoveryDeviceModel)
	devices: ShellyNgDiscoveryDeviceModel[];
}

@ApiSchema({ name: 'DevicesShellyNgPluginDataMappingReloadCacheStats' })
export class ShellyNgMappingReloadCacheStatsModel {
	@ApiProperty({
		description: 'Number of cached mapping lookups',
		example: 42,
	})
	@Expose()
	@IsInt()
	size: number;

	@ApiProperty({
		description: 'Number of mappings loaded',
		example: 15,
	})
	@Expose()
	@IsInt()
	mappingsLoaded: number;
}

@ApiSchema({ name: 'DevicesShellyNgPluginDataMappingReloadStats' })
export class ShellyNgMappingReloadStatsModel {
	@ApiProperty({
		description: 'Number of mappings loaded after reload',
		example: 15,
	})
	@Expose()
	@IsInt()
	mappingsLoaded: number;

	@ApiProperty({
		description: 'Number of files successfully loaded',
		example: 8,
	})
	@Expose()
	@IsInt()
	filesLoaded: number;

	@ApiProperty({
		description: 'Number of files that failed to load',
		example: 0,
	})
	@Expose()
	@IsInt()
	filesFailed: number;

	@ApiProperty({
		description: 'Total number of errors encountered',
		example: 0,
	})
	@Expose()
	@IsInt()
	errors: number;

	@ApiProperty({
		description: 'Total number of warnings encountered',
		example: 2,
	})
	@Expose()
	@IsInt()
	warnings: number;

	@ApiPropertyOptional({
		description: 'Detailed error messages (if any)',
		type: 'array',
		items: { type: 'string' },
		example: ['mapping.yaml: Invalid schema at /mappings/0'],
	})
	@Expose()
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	errorDetails?: string[];

	@ApiPropertyOptional({
		description: 'Detailed warning messages (if any)',
		type: 'array',
		items: { type: 'string' },
		example: ['mapping.yaml: Unknown transformer "custom_transform"'],
	})
	@Expose()
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	warningDetails?: string[];
}

@ApiSchema({ name: 'DevicesShellyNgPluginDataMappingReload' })
export class ShellyNgMappingReloadModel {
	@ApiProperty({
		description: 'Whether the reload was successful (no errors)',
		example: true,
	})
	@Expose()
	@IsBoolean()
	success: boolean;

	@ApiProperty({
		description: 'Cache statistics after reload',
		type: () => ShellyNgMappingReloadCacheStatsModel,
	})
	@Expose()
	@ValidateNested()
	@Type(() => ShellyNgMappingReloadCacheStatsModel)
	cacheStats: ShellyNgMappingReloadCacheStatsModel;

	@ApiProperty({
		description: 'Reload operation statistics and validation results',
		type: () => ShellyNgMappingReloadStatsModel,
	})
	@Expose()
	@ValidateNested()
	@Type(() => ShellyNgMappingReloadStatsModel)
	reloadStats: ShellyNgMappingReloadStatsModel;
}
