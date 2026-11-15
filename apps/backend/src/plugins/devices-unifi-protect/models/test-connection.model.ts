import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { PROTECT_TLS_MODES, ProtectTlsMode } from '../devices-unifi-protect.constants';
import { ProtectTestConnectionMode } from '../dto/test-connection.dto';
import { ProtectErrorCategory } from '../errors/protect-api.error';

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataCertificate' })
export class ProtectCertificateModel {
	@ApiProperty({
		description: 'SHA-256 fingerprint of the presented leaf certificate (64 lowercase hex characters)',
		name: 'fingerprint_sha256',
	})
	@Expose({ name: 'fingerprint_sha256' })
	@IsString()
	fingerprintSha256: string;

	@ApiPropertyOptional({ description: 'Subject common name', nullable: true, name: 'subject_common_name' })
	@Expose({ name: 'subject_common_name' })
	@IsOptional()
	@IsString()
	subjectCommonName: string | null;

	@ApiPropertyOptional({ description: 'Issuer common name', nullable: true, name: 'issuer_common_name' })
	@Expose({ name: 'issuer_common_name' })
	@IsOptional()
	@IsString()
	issuerCommonName: string | null;

	@ApiProperty({
		description: 'DNS names and IP addresses the certificate covers',
		type: [String],
		name: 'subject_alt_names',
	})
	@Expose({ name: 'subject_alt_names' })
	@IsArray()
	@IsString({ each: true })
	subjectAltNames: string[];

	@ApiProperty({ description: 'Start of the validity period', name: 'valid_from' })
	@Expose({ name: 'valid_from' })
	@IsString()
	validFrom: string;

	@ApiProperty({ description: 'End of the validity period', name: 'valid_to' })
	@Expose({ name: 'valid_to' })
	@IsString()
	validTo: string;

	@ApiProperty({ description: 'Whether the certificate is self-signed', name: 'self_signed' })
	@Expose({ name: 'self_signed' })
	@IsBoolean()
	selfSigned: boolean;

	@ApiProperty({
		description: 'Whether the chain and name verify against the trusted roots with the tested server name',
	})
	@Expose()
	@IsBoolean()
	trusted: boolean;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataTestConnection' })
export class ProtectTestConnectionModel {
	@ApiProperty({ description: 'Connection test mode that was evaluated', enum: ProtectTestConnectionMode })
	@Expose()
	@IsEnum(ProtectTestConnectionMode)
	mode: ProtectTestConnectionMode;

	@ApiProperty({
		description: 'Whether the certificate was accepted, the key was authenticated and the version is supported',
	})
	@Expose()
	@IsBoolean()
	success: boolean;

	@ApiPropertyOptional({
		description: 'Certificate trust mode that was evaluated',
		enum: PROTECT_TLS_MODES,
		nullable: true,
		name: 'tls_mode',
	})
	@Expose({ name: 'tls_mode' })
	@IsOptional()
	@IsString()
	tlsMode: ProtectTlsMode | null;

	@ApiPropertyOptional({
		description: 'Certificate the console presented, returned even when it was not accepted',
		type: () => ProtectCertificateModel,
		nullable: true,
	})
	@Expose()
	@Type(() => ProtectCertificateModel)
	@IsOptional()
	@ValidateNested()
	certificate: ProtectCertificateModel | null;

	@ApiPropertyOptional({
		description: 'Direct-connect domain the console reported without authentication; never trusted by itself',
		nullable: true,
		name: 'direct_connect_domain',
	})
	@Expose({ name: 'direct_connect_domain' })
	@IsOptional()
	@IsString()
	directConnectDomain: string | null;

	@ApiPropertyOptional({
		description:
			'Valid DNS name the administrator may confirm as the TLS server name. It is only a suggestion and is never adopted automatically.',
		nullable: true,
		name: 'suggested_server_name',
	})
	@Expose({ name: 'suggested_server_name' })
	@IsOptional()
	@IsString()
	suggestedServerName: string | null;

	@ApiPropertyOptional({
		description: 'Console name reported without authentication',
		nullable: true,
		name: 'console_name',
	})
	@Expose({ name: 'console_name' })
	@IsOptional()
	@IsString()
	consoleName: string | null;

	@ApiPropertyOptional({ description: 'Console hardware model short name', nullable: true, name: 'console_model' })
	@Expose({ name: 'console_model' })
	@IsOptional()
	@IsString()
	consoleModel: string | null;

	@ApiPropertyOptional({
		description: 'UniFi Protect application version reported by the console',
		nullable: true,
		name: 'application_version',
	})
	@Expose({ name: 'application_version' })
	@IsOptional()
	@IsString()
	applicationVersion: string | null;

	@ApiProperty({
		description: 'Oldest UniFi Protect application version the plugin supports',
		name: 'minimum_version',
	})
	@Expose({ name: 'minimum_version' })
	@IsString()
	minimumVersion: string;

	@ApiPropertyOptional({
		description: 'Whether the console version is supported; null until the version was read',
		nullable: true,
		name: 'version_supported',
	})
	@Expose({ name: 'version_supported' })
	@IsOptional()
	@IsBoolean()
	versionSupported: boolean | null;

	@ApiPropertyOptional({ description: 'Display name of the console NVR', nullable: true, name: 'nvr_name' })
	@Expose({ name: 'nvr_name' })
	@IsOptional()
	@IsString()
	nvrName: string | null;

	@ApiPropertyOptional({
		description: 'Normalized connection failure category',
		enum: ProtectErrorCategory,
		nullable: true,
		name: 'error_category',
	})
	@Expose({ name: 'error_category' })
	@IsOptional()
	@IsEnum(ProtectErrorCategory)
	errorCategory: ProtectErrorCategory | null;

	@ApiPropertyOptional({ description: 'Fixed, credential-free failure summary', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	error: string | null;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginResTestConnection' })
export class ProtectTestConnectionResponseModel extends BaseSuccessResponseModel<ProtectTestConnectionModel> {
	@ApiProperty({ type: ProtectTestConnectionModel })
	@Expose()
	declare data: ProtectTestConnectionModel;
}
