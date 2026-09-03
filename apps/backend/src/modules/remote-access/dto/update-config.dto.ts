import { Expose } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsOptional, IsString, Validate, ValidateIf } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { REMOTE_ACCESS_MODULE_NAME } from '../remote-access.constants';
import { IsRemoteAccessUrlConstraint } from '../validators/is-remote-access-url.validator';
import { IsTrustedProxyEntryConstraint } from '../validators/is-trusted-proxy-entry.validator';

@ApiSchema({ name: 'ConfigModuleUpdateRemoteAccess' })
export class UpdateRemoteAccessConfigDto extends UpdateModuleConfigDto {
	override enabled = true;

	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: REMOTE_ACCESS_MODULE_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = REMOTE_ACCESS_MODULE_NAME;

	@ApiPropertyOptional({
		name: 'internal_url',
		description:
			'Absolute origin override for the internal URL (no path). When unset, derived from FB_APP_HOST/FB_BACKEND_PORT',
		type: 'string',
		nullable: true,
		example: 'https://panel.example.com',
	})
	@Expose({ name: 'internal_url' })
	@IsOptional()
	@Validate(IsRemoteAccessUrlConstraint, {
		message:
			'[{"field":"internal_url","reason":"Internal URL must be a normalized absolute HTTP(S) origin without a path, query, fragment, or credentials."}]',
	})
	@ValidateIf((_, value) => value !== null)
	internal_url?: string | null;

	@ApiPropertyOptional({
		name: 'external_url',
		description: 'Manually configured external origin (no path), e.g. behind a hand-built reverse proxy or DDNS host',
		type: 'string',
		nullable: true,
		example: 'https://panel.example.com',
	})
	@Expose({ name: 'external_url' })
	@IsOptional()
	@Validate(IsRemoteAccessUrlConstraint, {
		message:
			'[{"field":"external_url","reason":"External URL must be a normalized absolute HTTP(S) origin without a path, query, fragment, or credentials."}]',
	})
	@ValidateIf((_, value) => value !== null)
	external_url?: string | null;

	@ApiPropertyOptional({
		name: 'trust_forwarded_headers',
		description:
			'Trust X-Forwarded-For/X-Real-IP/CF-Connecting-IP from the addresses listed in trusted_proxies. Inclusive with trusted_proxies',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'trust_forwarded_headers' })
	@IsOptional()
	@IsBoolean({
		message: '[{"field":"trust_forwarded_headers","reason":"Trust forwarded headers must be a boolean value."}]',
	})
	trust_forwarded_headers?: boolean;

	@ApiPropertyOptional({
		name: 'trusted_proxies',
		description: 'IPv4/IPv6 addresses or CIDR ranges allowed to present forwarded-identity headers',
		type: 'array',
		items: { type: 'string' },
		example: [],
	})
	@Expose({ name: 'trusted_proxies' })
	@IsOptional()
	@IsArray({ message: '[{"field":"trusted_proxies","reason":"Trusted proxies must be provided as an array."}]' })
	@ArrayUnique({ message: '[{"field":"trusted_proxies","reason":"Trusted proxies must not contain duplicates."}]' })
	@Validate(IsTrustedProxyEntryConstraint, {
		each: true,
		message:
			'[{"field":"trusted_proxies","reason":"Each trusted proxy must be a valid IPv4/IPv6 address or CIDR range."}]',
	})
	trusted_proxies?: string[];
}
