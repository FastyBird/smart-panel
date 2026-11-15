import { Expose, Transform, Type } from 'class-transformer';
import {
	IsDefined,
	IsEnum,
	IsIn,
	IsInt,
	IsNotEmpty,
	IsObject,
	IsString,
	Matches,
	Max,
	Min,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { PROTECT_DEFAULT_PORT, PROTECT_TLS_MODES, ProtectTlsMode } from '../devices-unifi-protect.constants';
import {
	IsProtectHost,
	IsProtectServerName,
	MAX_PROTECT_HOST_LENGTH,
	normalizeProtectFingerprint,
} from '../validators/protect-config.validators';

export enum ProtectTestConnectionMode {
	SAVED = 'saved',
	CANDIDATE = 'candidate',
}

// An explicit null clears nothing here (a candidate has no stored value), so null and undefined both skip validation.
const isPresent = (value: unknown): boolean => value !== undefined && value !== null;

@ApiSchema({ name: 'DevicesUnifiProtectPluginTestConnection' })
export class ProtectTestConnectionDto {
	@ApiProperty({
		description: 'Selects whether to test the saved configuration or a complete unsaved candidate',
		enum: ProtectTestConnectionMode,
	})
	@Expose()
	@IsEnum(ProtectTestConnectionMode, {
		message: '[{"field":"mode","reason":"Mode must be either saved or candidate."}]',
	})
	mode: ProtectTestConnectionMode;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginTestSavedConnection' })
export class ProtectTestSavedConnectionDto {
	@ApiProperty({
		description: 'Tests the persisted host, port, API key and certificate trust without accepting overrides',
		enum: [ProtectTestConnectionMode.SAVED],
		example: ProtectTestConnectionMode.SAVED,
	})
	@Expose()
	@IsIn([ProtectTestConnectionMode.SAVED], {
		message: '[{"field":"mode","reason":"Saved connection mode is required."}]',
	})
	mode: ProtectTestConnectionMode.SAVED;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginTestCandidateConnectionTls' })
export class ProtectTestTlsDto {
	@ApiProperty({
		description: 'Certificate trust mode: verify the chain and name, or pin the leaf certificate fingerprint',
		enum: PROTECT_TLS_MODES,
		example: 'verify',
	})
	@Expose()
	@IsIn(PROTECT_TLS_MODES, {
		message: '[{"field":"mode","reason":"TLS mode must be one of: verify, pinned."}]',
	})
	mode: ProtectTlsMode;

	@ApiPropertyOptional({
		description: 'DNS name used for SNI and certificate name verification',
		nullable: true,
		maxLength: MAX_PROTECT_HOST_LENGTH,
		name: 'server_name',
	})
	@Expose({ name: 'server_name' })
	@ValidateIf((o: ProtectTestTlsDto) => isPresent(o.serverName))
	@IsProtectServerName({
		message: '[{"field":"server_name","reason":"TLS server name must be a DNS name, not an IP address."}]',
	})
	serverName?: string | null;

	@ApiPropertyOptional({
		description: 'SHA-256 fingerprint of the pinned leaf certificate, with or without colons',
		nullable: true,
		name: 'fingerprint_sha256',
	})
	@Expose({ name: 'fingerprint_sha256' })
	@Transform(({ value }: { value: unknown }) =>
		typeof value === 'string' ? (normalizeProtectFingerprint(value) ?? value) : value,
	)
	@ValidateIf((o: ProtectTestTlsDto) => isPresent(o.fingerprintSha256))
	@IsString({ message: '[{"field":"fingerprint_sha256","reason":"Fingerprint must be a valid string."}]' })
	@Matches(/^[0-9a-f]{64}$/, {
		message: '[{"field":"fingerprint_sha256","reason":"Fingerprint must be 64 hexadecimal characters."}]',
	})
	fingerprintSha256?: string | null;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginTestCandidateConnection' })
export class ProtectTestCandidateConnectionDto {
	@ApiProperty({
		description: 'Tests only the supplied unsaved host, port, new API key and certificate trust',
		enum: [ProtectTestConnectionMode.CANDIDATE],
		example: ProtectTestConnectionMode.CANDIDATE,
	})
	@Expose()
	@IsIn([ProtectTestConnectionMode.CANDIDATE], {
		message: '[{"field":"mode","reason":"Candidate connection mode is required."}]',
	})
	mode: ProtectTestConnectionMode.CANDIDATE;

	@ApiProperty({
		description: 'Console host name or IP address',
		example: '192.168.1.1',
		maxLength: MAX_PROTECT_HOST_LENGTH,
	})
	@Expose()
	@IsDefined({ message: '[{"field":"host","reason":"Candidate host is required."}]' })
	@IsProtectHost({
		message:
			'[{"field":"host","reason":"Host must be a host name or IP address without scheme, port, path or credentials."}]',
	})
	host: string;

	@ApiPropertyOptional({ description: 'Console HTTPS port', example: PROTECT_DEFAULT_PORT, minimum: 1, maximum: 65535 })
	@Expose()
	@ValidateIf((o: ProtectTestCandidateConnectionDto) => isPresent(o.port))
	@IsInt({ message: '[{"field":"port","reason":"Port must be a whole number."}]' })
	@Min(1, { message: '[{"field":"port","reason":"Port must be between 1 and 65535."}]' })
	@Max(65535, { message: '[{"field":"port","reason":"Port must be between 1 and 65535."}]' })
	port?: number;

	@ApiProperty({
		description: 'New API key for this candidate only. The stored key is never sent to a submitted host.',
		writeOnly: true,
		name: 'api_key',
	})
	@Expose({ name: 'api_key' })
	@IsDefined({ message: '[{"field":"api_key","reason":"A new candidate API key is required."}]' })
	@IsNotEmpty({ message: '[{"field":"api_key","reason":"A new candidate API key is required."}]' })
	@IsString({ message: '[{"field":"api_key","reason":"API key must be a valid string."}]' })
	@Matches(/\S/, { message: '[{"field":"api_key","reason":"API key must contain a non-whitespace character."}]' })
	apiKey: string;

	@ApiPropertyOptional({
		description: 'Certificate trust for the candidate; defaults to verify',
		type: () => ProtectTestTlsDto,
	})
	@Expose()
	@ValidateIf((o: ProtectTestCandidateConnectionDto) => isPresent(o.tls))
	@IsObject({ message: '[{"field":"tls","reason":"TLS configuration must be an object."}]' })
	@ValidateNested()
	@Type(() => ProtectTestTlsDto)
	tls?: ProtectTestTlsDto;
}

const determineTestConnectionDto = (object: unknown): new () => unknown => {
	if (typeof object !== 'object' || object === null || !('data' in object)) {
		return ProtectTestConnectionDto;
	}

	const data = object.data;

	if (typeof data !== 'object' || data === null || !('mode' in data)) {
		return ProtectTestConnectionDto;
	}

	if (data.mode === ProtectTestConnectionMode.SAVED) {
		return ProtectTestSavedConnectionDto;
	}

	if (data.mode === ProtectTestConnectionMode.CANDIDATE) {
		return ProtectTestCandidateConnectionDto;
	}

	return ProtectTestConnectionDto;
};

@ApiSchema({ name: 'DevicesUnifiProtectPluginReqTestConnection' })
export class ProtectTestConnectionRequestDto {
	@ApiProperty({
		description: 'Saved or candidate UniFi Protect connection test data',
		oneOf: [
			{ $ref: getSchemaPath(ProtectTestSavedConnectionDto) },
			{ $ref: getSchemaPath(ProtectTestCandidateConnectionDto) },
		],
		discriminator: {
			propertyName: 'mode',
			mapping: {
				saved: getSchemaPath(ProtectTestSavedConnectionDto),
				candidate: getSchemaPath(ProtectTestCandidateConnectionDto),
			},
		},
	})
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Connection test data is required."}]' })
	@IsObject({ message: '[{"field":"data","reason":"Connection test data must be an object."}]' })
	@ValidateNested()
	@Type((options) => determineTestConnectionDto(options?.object))
	data: ProtectTestSavedConnectionDto | ProtectTestCandidateConnectionDto;
}
