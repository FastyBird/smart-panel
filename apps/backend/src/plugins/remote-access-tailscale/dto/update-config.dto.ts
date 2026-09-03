import { Expose } from 'class-transformer';
import { ArrayUnique, Equals, IsArray, IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import {
	REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
	TAILSCALE_DEFAULT_LOGIN_SERVER,
} from '../remote-access-tailscale.constants';

@ApiSchema({ name: 'RemoteAccessTailscalePluginUpdateConfig' })
export class UpdateRemoteAccessTailscalePluginConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME;

	@ApiPropertyOptional({
		description: 'Hostname advertised to the tailnet',
		type: 'string',
		maxLength: 63,
		example: 'smart-panel',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"hostname","reason":"Hostname must be a valid string."}]' })
	@MaxLength(63, { message: '[{"field":"hostname","reason":"Hostname must be at most 63 characters."}]' })
	hostname?: string;

	@ApiPropertyOptional({
		name: 'login_server',
		description: 'Control-plane URL. Override for a self-hosted Headscale server',
		type: 'string',
		example: TAILSCALE_DEFAULT_LOGIN_SERVER,
	})
	@Expose({ name: 'login_server' })
	@IsOptional()
	@IsUrl({ require_tld: false }, { message: '[{"field":"login_server","reason":"Login server must be a valid URL."}]' })
	login_server?: string;

	@ApiPropertyOptional({
		name: 'accept_dns',
		description: 'Accept the tailnet MagicDNS configuration',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'accept_dns' })
	@IsOptional()
	@IsBoolean({ message: '[{"field":"accept_dns","reason":"Accept DNS must be a boolean value."}]' })
	accept_dns?: boolean;

	@ApiPropertyOptional({
		name: 'accept_routes',
		description: 'Accept subnet routes advertised by other tailnet nodes',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'accept_routes' })
	@IsOptional()
	@IsBoolean({ message: '[{"field":"accept_routes","reason":"Accept routes must be a boolean value."}]' })
	accept_routes?: boolean;

	@ApiPropertyOptional({
		name: 'advertise_tags',
		description: 'ACL tags to advertise for this node, e.g. ["tag:smart-panel"]',
		type: 'array',
		items: { type: 'string' },
		example: [],
	})
	@Expose({ name: 'advertise_tags' })
	@IsOptional()
	@IsArray({ message: '[{"field":"advertise_tags","reason":"Advertise tags must be provided as an array."}]' })
	@ArrayUnique({ message: '[{"field":"advertise_tags","reason":"Advertise tags must not contain duplicates."}]' })
	@IsString({
		each: true,
		message: '[{"field":"advertise_tags","reason":"Each advertise tag must be a valid string."}]',
	})
	advertise_tags?: string[];

	@ApiPropertyOptional({
		description: 'Enable Tailscale SSH on this node',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"ssh","reason":"SSH must be a boolean value."}]' })
	ssh?: boolean;

	@ApiPropertyOptional({
		name: 'serve_https',
		description:
			'Serve the admin UI over HTTPS through Tailscale Serve. Not yet applied by the managed service — only the default (true) is accepted until a later release actually configures Serve',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'serve_https' })
	@IsOptional()
	@IsBoolean({ message: '[{"field":"serve_https","reason":"Serve HTTPS must be a boolean value."}]' })
	@Equals(true, {
		message:
			'[{"field":"serve_https","reason":"Serve HTTPS is not yet configurable; it is applied in a later release and must stay true."}]',
	})
	serve_https?: boolean;

	@ApiPropertyOptional({
		description:
			'Publish the served admin UI to the public internet through Tailscale Funnel. Not yet applied by the managed service — only the default (false) is accepted until a later release actually configures Funnel',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"funnel","reason":"Funnel must be a boolean value."}]' })
	@Equals(false, {
		message:
			'[{"field":"funnel","reason":"Funnel is not yet configurable; it is applied in a later release and must stay false."}]',
	})
	funnel?: boolean;
}
