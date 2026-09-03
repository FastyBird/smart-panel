import { Expose } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsOptional, IsString, Validate } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import { REMOTE_ACCESS_MODULE_NAME } from '../remote-access.constants';
import { IsRemoteAccessUrlConstraint } from '../validators/is-remote-access-url.validator';
import { IsTrustedProxyEntryConstraint } from '../validators/is-trusted-proxy-entry.validator';

@ApiSchema({ name: 'ConfigModuleDataRemoteAccess' })
export class RemoteAccessConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: REMOTE_ACCESS_MODULE_NAME,
	})
	@Expose()
	@IsString()
	type: string = REMOTE_ACCESS_MODULE_NAME;

	@ApiProperty({
		description: 'Module enabled state. Disabled: providers stop, only the internal URL resolves',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	override enabled: boolean = true;

	@ApiPropertyOptional({
		name: 'internal_url',
		description:
			'Absolute origin override for the internal URL (no path). When unset, derived from FB_APP_HOST/FB_BACKEND_PORT',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'internal_url' })
	@IsOptional()
	@Validate(IsRemoteAccessUrlConstraint, {
		message:
			'[{"field":"internal_url","reason":"Internal URL must be a normalized absolute HTTP(S) origin without a path, query, fragment, or credentials."}]',
	})
	internalUrl: string | null = null;

	@ApiPropertyOptional({
		name: 'external_url',
		description: 'Manually configured external origin (no path), e.g. behind a hand-built reverse proxy or DDNS host',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'external_url' })
	@IsOptional()
	@Validate(IsRemoteAccessUrlConstraint, {
		message:
			'[{"field":"external_url","reason":"External URL must be a normalized absolute HTTP(S) origin without a path, query, fragment, or credentials."}]',
	})
	externalUrl: string | null = null;

	@ApiProperty({
		name: 'trust_forwarded_headers',
		description:
			'Trust X-Forwarded-For/X-Real-IP/CF-Connecting-IP from the addresses listed in trusted_proxies. Inclusive with trusted_proxies',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'trust_forwarded_headers' })
	@IsBoolean()
	trustForwardedHeaders: boolean = false;

	@ApiProperty({
		name: 'trusted_proxies',
		description: 'IPv4/IPv6 addresses or CIDR ranges allowed to present forwarded-identity headers',
		type: 'array',
		items: { type: 'string' },
		example: [],
	})
	@Expose({ name: 'trusted_proxies' })
	@IsArray()
	@ArrayUnique()
	@Validate(IsTrustedProxyEntryConstraint, {
		each: true,
		message:
			'[{"field":"trusted_proxies","reason":"Each trusted proxy must be a valid IPv4/IPv6 address or CIDR range."}]',
	})
	trustedProxies: string[] = [];
}
