import { Expose, Type } from 'class-transformer';
import {
	IsBoolean,
	IsIn,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Matches,
	Max,
	Min,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import {
	DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	PROTECT_DEFAULT_POLL_INTERVAL_MS,
	PROTECT_DEFAULT_PORT,
	PROTECT_DEFAULT_SNAPSHOT_MIN_INTERVAL_MS,
	PROTECT_MAX_POLL_INTERVAL_MS,
	PROTECT_MAX_SNAPSHOT_MIN_INTERVAL_MS,
	PROTECT_MIN_POLL_INTERVAL_MS,
	PROTECT_MIN_SNAPSHOT_MIN_INTERVAL_MS,
	PROTECT_STREAM_QUALITIES,
	PROTECT_TLS_MODES,
	ProtectStreamQuality,
	ProtectTlsMode,
} from '../devices-unifi-protect.constants';
import { MAX_PROTECT_HOST_LENGTH } from '../validators/protect-config.validators';

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataConfigTls' })
export class ProtectTlsConfigModel {
	@ApiProperty({
		description: 'Certificate trust mode: verify the chain and name, or pin the leaf certificate fingerprint',
		enum: PROTECT_TLS_MODES,
		example: 'verify',
	})
	@Expose()
	@IsString()
	mode: ProtectTlsMode = 'verify';

	@ApiPropertyOptional({
		description: 'DNS name used for SNI and certificate name verification (the console direct-connect domain)',
		nullable: true,
		maxLength: MAX_PROTECT_HOST_LENGTH,
		name: 'server_name',
	})
	@Expose({ name: 'server_name' })
	@ValidateIf((tls: ProtectTlsConfigModel) => tls.serverName !== null)
	@IsString()
	serverName: string | null = null;

	@ApiPropertyOptional({
		description: 'SHA-256 fingerprint of the pinned leaf certificate (64 lowercase hex characters)',
		nullable: true,
		name: 'fingerprint_sha256',
	})
	@Expose({ name: 'fingerprint_sha256' })
	@ValidateIf((tls: ProtectTlsConfigModel) => tls.fingerprintSha256 !== null)
	@IsString()
	fingerprintSha256: string | null = null;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataConfig' })
export class ProtectConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = DEVICES_UNIFI_PROTECT_PLUGIN_NAME;

	@ApiPropertyOptional({
		description: 'UniFi Protect console host name or IP address',
		example: '192.168.1.1',
		nullable: true,
		maxLength: MAX_PROTECT_HOST_LENGTH,
	})
	@Expose()
	@ValidateIf((config: ProtectConfigModel) => config.host !== null)
	@IsString()
	host: string | null = null;

	@ApiProperty({ description: 'Console HTTPS port', example: PROTECT_DEFAULT_PORT, minimum: 1, maximum: 65535 })
	@Expose()
	@IsInt()
	@Min(1)
	@Max(65535)
	port: number = PROTECT_DEFAULT_PORT;

	@ApiPropertyOptional({
		description: 'UniFi Protect integration API key. This value is accepted on write and never returned.',
		writeOnly: true,
		nullable: true,
		name: 'api_key',
	})
	@Expose({ name: 'api_key' })
	@ValidateIf((config: ProtectConfigModel) => config.apiKey !== null)
	@IsNotEmpty()
	@IsString()
	@Matches(/\S/)
	apiKey: string | null = null;

	@ApiProperty({
		description: 'Whether a UniFi Protect API key is configured',
		name: 'api_key_configured',
	})
	@Expose({ name: 'api_key_configured' })
	@IsOptional()
	@IsBoolean()
	apiKeyConfigured?: boolean;

	@ApiProperty({ description: 'TLS trust configuration', type: () => ProtectTlsConfigModel })
	@Expose()
	@ValidateNested()
	@Type(() => ProtectTlsConfigModel)
	tls: ProtectTlsConfigModel = new ProtectTlsConfigModel();

	@ApiPropertyOptional({
		description: 'Host name or IP address clients use to reach the camera streams instead of the console host',
		nullable: true,
		maxLength: MAX_PROTECT_HOST_LENGTH,
		name: 'stream_host_override',
	})
	@Expose({ name: 'stream_host_override' })
	@ValidateIf((config: ProtectConfigModel) => config.streamHostOverride !== null)
	@IsString()
	streamHostOverride: string | null = null;

	@ApiProperty({
		description: 'Default stream quality',
		enum: PROTECT_STREAM_QUALITIES,
		example: 'medium',
		name: 'default_stream_quality',
	})
	@Expose({ name: 'default_stream_quality' })
	@IsIn(PROTECT_STREAM_QUALITIES)
	defaultStreamQuality: ProtectStreamQuality = 'medium';

	@ApiProperty({
		description: 'Minimum interval between snapshot requests per camera in milliseconds',
		example: PROTECT_DEFAULT_SNAPSHOT_MIN_INTERVAL_MS,
		minimum: PROTECT_MIN_SNAPSHOT_MIN_INTERVAL_MS,
		maximum: PROTECT_MAX_SNAPSHOT_MIN_INTERVAL_MS,
		name: 'snapshot_min_interval_ms',
	})
	@Expose({ name: 'snapshot_min_interval_ms' })
	@IsInt()
	@Min(PROTECT_MIN_SNAPSHOT_MIN_INTERVAL_MS)
	@Max(PROTECT_MAX_SNAPSHOT_MIN_INTERVAL_MS)
	snapshotMinIntervalMs: number = PROTECT_DEFAULT_SNAPSHOT_MIN_INTERVAL_MS;

	@ApiProperty({
		description: 'Interval between device state refreshes while real-time updates are unavailable, in milliseconds',
		example: PROTECT_DEFAULT_POLL_INTERVAL_MS,
		minimum: PROTECT_MIN_POLL_INTERVAL_MS,
		maximum: PROTECT_MAX_POLL_INTERVAL_MS,
		name: 'poll_interval_ms',
	})
	@Expose({ name: 'poll_interval_ms' })
	@IsInt()
	@Min(PROTECT_MIN_POLL_INTERVAL_MS)
	@Max(PROTECT_MAX_POLL_INTERVAL_MS)
	pollIntervalMs: number = PROTECT_DEFAULT_POLL_INTERVAL_MS;
}
