import { Expose, Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsString, Matches, Max, Min, ValidateIf, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
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
import {
	IsProtectHost,
	IsProtectServerName,
	MAX_PROTECT_HOST_LENGTH,
	normalizeProtectFingerprint,
} from '../validators/protect-config.validators';

// Nullable fields: an explicit null clears the stored value, an omitted field leaves it untouched.
// Neither carries a null -> undefined transform; validation is skipped for both null and undefined.
const isPresent = (value: unknown): boolean => value !== undefined && value !== null;
// Non-nullable fields: only an omitted field skips validation, so an explicit null is rejected.
const isSubmitted = (value: unknown): boolean => value !== undefined;

@ApiSchema({ name: 'DevicesUnifiProtectPluginUpdateConfigTls' })
export class ProtectUpdateTlsConfigDto {
	@ApiPropertyOptional({
		description: 'Certificate trust mode: verify the chain and name, or pin the leaf certificate fingerprint',
		enum: PROTECT_TLS_MODES,
		example: 'verify',
	})
	@Expose()
	@ValidateIf((o: ProtectUpdateTlsConfigDto) => isSubmitted(o.mode))
	@IsIn(PROTECT_TLS_MODES, {
		message: '[{"field":"mode","reason":"TLS mode must be one of: verify, pinned."}]',
	})
	mode?: ProtectTlsMode;

	@ApiPropertyOptional({
		description: 'DNS name used for SNI and certificate name verification. Send null to clear it.',
		nullable: true,
		maxLength: MAX_PROTECT_HOST_LENGTH,
		name: 'server_name',
	})
	@Expose({ name: 'server_name' })
	@ValidateIf((o: ProtectUpdateTlsConfigDto) => isPresent(o.serverName))
	@IsProtectServerName({
		message: '[{"field":"server_name","reason":"TLS server name must be a DNS name, not an IP address."}]',
	})
	serverName?: string | null;

	@ApiPropertyOptional({
		description: 'SHA-256 fingerprint of the pinned leaf certificate, with or without colons. Send null to clear it.',
		nullable: true,
		name: 'fingerprint_sha256',
	})
	@Expose({ name: 'fingerprint_sha256' })
	@Transform(({ value }: { value: unknown }) =>
		typeof value === 'string' ? (normalizeProtectFingerprint(value) ?? value) : value,
	)
	@ValidateIf((o: ProtectUpdateTlsConfigDto) => isPresent(o.fingerprintSha256))
	@IsString({ message: '[{"field":"fingerprint_sha256","reason":"Fingerprint must be a valid string."}]' })
	@Matches(/^[0-9a-f]{64}$/, {
		message: '[{"field":"fingerprint_sha256","reason":"Fingerprint must be 64 hexadecimal characters."}]',
	})
	fingerprintSha256?: string | null;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginUpdateConfig' })
export class ProtectUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof DEVICES_UNIFI_PROTECT_PLUGIN_NAME;

	@ApiPropertyOptional({
		description: 'UniFi Protect console host name or IP address. Send null to clear it.',
		example: '192.168.1.1',
		nullable: true,
		maxLength: MAX_PROTECT_HOST_LENGTH,
	})
	@Expose()
	@ValidateIf((o: ProtectUpdatePluginConfigDto) => isPresent(o.host))
	@IsProtectHost({
		message:
			'[{"field":"host","reason":"Host must be a host name or IP address without scheme, port, path or credentials."}]',
	})
	host?: string | null;

	@ApiPropertyOptional({ description: 'Console HTTPS port', example: PROTECT_DEFAULT_PORT, minimum: 1, maximum: 65535 })
	@Expose()
	@ValidateIf((o: ProtectUpdatePluginConfigDto) => isSubmitted(o.port))
	@IsInt({ message: '[{"field":"port","reason":"Port must be a whole number."}]' })
	@Min(1, { message: '[{"field":"port","reason":"Port must be between 1 and 65535."}]' })
	@Max(65535, { message: '[{"field":"port","reason":"Port must be between 1 and 65535."}]' })
	port?: number;

	@ApiPropertyOptional({
		description: 'Replacement UniFi Protect API key. Omit to preserve the stored key or send null to clear it.',
		writeOnly: true,
		nullable: true,
		name: 'api_key',
	})
	@Expose({ name: 'api_key' })
	@ValidateIf((o: ProtectUpdatePluginConfigDto) => isPresent(o.apiKey))
	@IsString({ message: '[{"field":"api_key","reason":"API key must be a valid string."}]' })
	@Matches(/\S/, { message: '[{"field":"api_key","reason":"API key must contain a non-whitespace character."}]' })
	apiKey?: string | null;

	@ApiPropertyOptional({ description: 'TLS trust configuration', type: () => ProtectUpdateTlsConfigDto })
	@Expose()
	@ValidateIf((o: ProtectUpdatePluginConfigDto) => isSubmitted(o.tls))
	@IsObject({ message: '[{"field":"tls","reason":"TLS configuration must be an object."}]' })
	@ValidateNested()
	@Type(() => ProtectUpdateTlsConfigDto)
	tls?: ProtectUpdateTlsConfigDto;

	@ApiPropertyOptional({
		description:
			"Host name or IP address Smart Panel connects to for the console's camera streams instead of the console host. Send null to clear it.",
		nullable: true,
		maxLength: MAX_PROTECT_HOST_LENGTH,
		name: 'stream_host_override',
	})
	@Expose({ name: 'stream_host_override' })
	@ValidateIf((o: ProtectUpdatePluginConfigDto) => isPresent(o.streamHostOverride))
	@IsProtectHost({
		message:
			'[{"field":"stream_host_override","reason":"Stream host must be a host name or IP address without scheme, port, path or credentials."}]',
	})
	streamHostOverride?: string | null;

	@ApiPropertyOptional({
		description: 'Default stream quality',
		enum: PROTECT_STREAM_QUALITIES,
		example: 'medium',
		name: 'default_stream_quality',
	})
	@Expose({ name: 'default_stream_quality' })
	@ValidateIf((o: ProtectUpdatePluginConfigDto) => isSubmitted(o.defaultStreamQuality))
	@IsIn(PROTECT_STREAM_QUALITIES, {
		message:
			'[{"field":"default_stream_quality","reason":"Default stream quality must be one of: high, medium, low."}]',
	})
	defaultStreamQuality?: ProtectStreamQuality;

	@ApiPropertyOptional({
		description: 'Minimum interval between snapshot requests per camera in milliseconds',
		example: PROTECT_DEFAULT_SNAPSHOT_MIN_INTERVAL_MS,
		minimum: PROTECT_MIN_SNAPSHOT_MIN_INTERVAL_MS,
		maximum: PROTECT_MAX_SNAPSHOT_MIN_INTERVAL_MS,
		name: 'snapshot_min_interval_ms',
	})
	@Expose({ name: 'snapshot_min_interval_ms' })
	@ValidateIf((o: ProtectUpdatePluginConfigDto) => isSubmitted(o.snapshotMinIntervalMs))
	@IsInt({ message: '[{"field":"snapshot_min_interval_ms","reason":"Snapshot interval must be a whole number."}]' })
	@Min(PROTECT_MIN_SNAPSHOT_MIN_INTERVAL_MS, {
		message: `[{"field":"snapshot_min_interval_ms","reason":"Snapshot interval must be at least ${PROTECT_MIN_SNAPSHOT_MIN_INTERVAL_MS}ms."}]`,
	})
	@Max(PROTECT_MAX_SNAPSHOT_MIN_INTERVAL_MS, {
		message: `[{"field":"snapshot_min_interval_ms","reason":"Snapshot interval must be at most ${PROTECT_MAX_SNAPSHOT_MIN_INTERVAL_MS}ms."}]`,
	})
	snapshotMinIntervalMs?: number;

	@ApiPropertyOptional({
		description: 'Inventory poll interval in milliseconds',
		example: PROTECT_DEFAULT_POLL_INTERVAL_MS,
		minimum: PROTECT_MIN_POLL_INTERVAL_MS,
		maximum: PROTECT_MAX_POLL_INTERVAL_MS,
		name: 'poll_interval_ms',
	})
	@Expose({ name: 'poll_interval_ms' })
	@ValidateIf((o: ProtectUpdatePluginConfigDto) => isSubmitted(o.pollIntervalMs))
	@IsInt({ message: '[{"field":"poll_interval_ms","reason":"Poll interval must be a whole number."}]' })
	@Min(PROTECT_MIN_POLL_INTERVAL_MS, {
		message: `[{"field":"poll_interval_ms","reason":"Poll interval must be at least ${PROTECT_MIN_POLL_INTERVAL_MS}ms."}]`,
	})
	@Max(PROTECT_MAX_POLL_INTERVAL_MS, {
		message: `[{"field":"poll_interval_ms","reason":"Poll interval must be at most ${PROTECT_MAX_POLL_INTERVAL_MS}ms."}]`,
	})
	pollIntervalMs?: number;
}
