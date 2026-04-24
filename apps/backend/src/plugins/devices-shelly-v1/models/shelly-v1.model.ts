import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { DeviceCategory } from '../../../modules/devices/devices.constants';

@ApiSchema({ name: 'DevicesShellyV1PluginDataSupportedDevice' })
export class ShellyV1SupportedDeviceModel {
	@Expose()
	@IsString()
	@ApiProperty({
		description: 'Device group',
		example: 'relay',
	})
	group: string;

	@Expose()
	@IsString()
	@ApiProperty({
		description: 'Device name',
		example: 'Shelly 1',
	})
	name: string;

	@Expose()
	@IsArray()
	@IsString({ each: true })
	@ApiProperty({
		description: 'Supported device models',
		type: 'array',
		items: { type: 'string' },
		example: ['SHSW-1', 'SHSW-L'],
	})
	models: string[];

	@Expose()
	@IsArray()
	@IsString({ each: true })
	@ApiProperty({
		description: 'Device categories',
		type: 'array',
		items: { type: 'string' },
		example: ['switch', 'light'],
	})
	categories: string[];
}

@ApiSchema({ name: 'DevicesShellyV1PluginDataDeviceInfo' })
export class ShellyV1DeviceInfoModel {
	@Expose()
	@IsBoolean()
	@ApiProperty({
		description: 'Whether the device is reachable',
		example: true,
	})
	reachable: boolean;

	@Expose({ name: 'auth_required' })
	@IsBoolean()
	@ApiProperty({
		name: 'auth_required',
		description: 'Whether authentication is required',
		example: false,
	})
	authRequired: boolean;

	@Expose({ name: 'auth_valid' })
	@IsOptional()
	@IsBoolean()
	@ApiPropertyOptional({
		name: 'auth_valid',
		description: 'Whether authentication is valid',
		example: true,
	})
	authValid?: boolean;

	@Expose()
	@IsString()
	@ApiProperty({
		description: 'Device host address',
		example: '192.168.1.100',
	})
	host: string;

	@Expose()
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description: 'Device IP address',
		example: '192.168.1.100',
	})
	ip?: string;

	@Expose()
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description: 'Device MAC address',
		example: 'AA:BB:CC:DD:EE:FF',
	})
	mac?: string;

	@Expose()
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description: 'Device model',
		example: 'SHSW-1',
	})
	model?: string;

	@Expose()
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description: 'Device firmware version',
		example: '1.11.0',
	})
	firmware?: string;

	@Expose({ name: 'device_type' })
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		name: 'device_type',
		description: 'Device type',
		example: 'SHSW-1',
	})
	deviceType?: string;

	@Expose()
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description: 'Device description',
		example: 'Living room light switch',
	})
	description?: string;
}

@ApiSchema({ name: 'DevicesShellyV1PluginDataDiscoveryDeviceAuthentication' })
export class ShellyV1DiscoveryDeviceAuthenticationModel {
	@ApiProperty({
		description: 'Whether authentication is enabled',
		example: false,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean;

	@ApiPropertyOptional({
		description: 'Whether authentication is valid (only set when a password was supplied)',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsBoolean()
	@IsOptional()
	valid: boolean | null;
}

@ApiSchema({ name: 'DevicesShellyV1PluginDataDiscoveryDevice' })
export class ShellyV1DiscoveryDeviceModel {
	@ApiPropertyOptional({
		description: 'Shelly device identifier',
		nullable: true,
		example: 'shelly1-A8032ABE5084',
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
		example: 'SHSW-1',
	})
	@Expose()
	@IsString()
	@IsOptional()
	model: string | null;

	@ApiPropertyOptional({
		name: 'display_name',
		description: 'Friendly supported-device name',
		nullable: true,
		example: 'Shelly 1',
	})
	@Expose({ name: 'display_name' })
	@IsString()
	@IsOptional()
	displayName: string | null;

	@ApiPropertyOptional({
		description: 'Firmware version',
		nullable: true,
		example: '20230913-001',
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
		example: [DeviceCategory.SWITCHER, DeviceCategory.LIGHTING],
	})
	@Expose()
	@IsArray()
	@IsString({ each: true })
	categories: DeviceCategory[];

	@ApiPropertyOptional({
		name: 'suggested_category',
		description: 'Suggested target device category when the plugin can infer one',
		nullable: true,
		enum: DeviceCategory,
		example: DeviceCategory.SWITCHER,
	})
	@Expose({ name: 'suggested_category' })
	@IsString()
	@IsOptional()
	suggestedCategory: DeviceCategory | null;

	@ApiProperty({
		description: 'Authentication configuration',
		type: () => ShellyV1DiscoveryDeviceAuthenticationModel,
	})
	@Expose()
	@ValidateNested()
	@Type(() => ShellyV1DiscoveryDeviceAuthenticationModel)
	authentication: ShellyV1DiscoveryDeviceAuthenticationModel;

	@ApiPropertyOptional({
		name: 'registered_device_id',
		description: 'Already registered device id',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'registered_device_id' })
	@IsString()
	@IsOptional()
	registeredDeviceId: string | null;

	@ApiPropertyOptional({
		name: 'registered_device_name',
		description: 'Already registered device name',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'registered_device_name' })
	@IsString()
	@IsOptional()
	registeredDeviceName: string | null;

	@ApiPropertyOptional({
		name: 'registered_device_category',
		description:
			'Already registered device category — used to pre-fill the wizard so adopted devices keep their existing category by default',
		enum: DeviceCategory,
		nullable: true,
		example: DeviceCategory.SWITCHER,
	})
	@Expose({ name: 'registered_device_category' })
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
		name: 'last_seen_at',
		description: 'Last time this candidate was observed or checked',
		example: '2026-04-29T12:00:00.000Z',
	})
	@Expose({ name: 'last_seen_at' })
	@IsString()
	lastSeenAt: string;
}

@ApiSchema({ name: 'DevicesShellyV1PluginDataDiscoverySession' })
export class ShellyV1DiscoverySessionModel {
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
		name: 'started_at',
		description: 'Discovery start timestamp',
		example: '2026-04-29T12:00:00.000Z',
	})
	@Expose({ name: 'started_at' })
	@IsString()
	startedAt: string;

	@ApiProperty({
		name: 'expires_at',
		description: 'Discovery expiry timestamp',
		example: '2026-04-29T12:00:30.000Z',
	})
	@Expose({ name: 'expires_at' })
	@IsString()
	expiresAt: string;

	@ApiProperty({
		name: 'remaining_seconds',
		description: 'Remaining discovery time in seconds',
		example: 30,
	})
	@Expose({ name: 'remaining_seconds' })
	@IsInt()
	remainingSeconds: number;

	@ApiProperty({
		description: 'Discovered Shelly V1 device candidates',
		type: 'array',
		items: { $ref: getSchemaPath(ShellyV1DiscoveryDeviceModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ShellyV1DiscoveryDeviceModel)
	devices: ShellyV1DiscoveryDeviceModel[];
}
