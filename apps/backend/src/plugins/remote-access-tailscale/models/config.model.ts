import { Expose } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsString, IsUrl, MaxLength } from 'class-validator';
import os from 'os';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import {
	REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
	TAILSCALE_DEFAULT_LOGIN_SERVER,
} from '../remote-access-tailscale.constants';

@ApiSchema({ name: 'RemoteAccessTailscalePluginDataConfig' })
export class RemoteAccessTailscalePluginConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME;

	@ApiProperty({
		description: 'Hostname advertised to the tailnet',
		type: 'string',
		maxLength: 63,
		example: 'smart-panel',
	})
	@Expose()
	@IsString()
	@MaxLength(63)
	hostname: string = os.hostname();

	@ApiProperty({
		name: 'login_server',
		description: 'Control-plane URL. Override for a self-hosted Headscale server',
		type: 'string',
		example: TAILSCALE_DEFAULT_LOGIN_SERVER,
	})
	@Expose({ name: 'login_server' })
	@IsUrl({ require_tld: false })
	loginServer: string = TAILSCALE_DEFAULT_LOGIN_SERVER;

	@ApiProperty({
		name: 'accept_dns',
		description: 'Accept the tailnet MagicDNS configuration',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'accept_dns' })
	@IsBoolean()
	acceptDns: boolean = true;

	@ApiProperty({
		name: 'accept_routes',
		description: 'Accept subnet routes advertised by other tailnet nodes',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'accept_routes' })
	@IsBoolean()
	acceptRoutes: boolean = false;

	@ApiProperty({
		name: 'advertise_tags',
		description: 'ACL tags to advertise for this node, e.g. ["tag:smart-panel"]',
		type: 'array',
		items: { type: 'string' },
		example: [],
	})
	@Expose({ name: 'advertise_tags' })
	@IsArray()
	@ArrayUnique()
	@IsString({ each: true })
	advertiseTags: string[] = [];

	@ApiProperty({
		description: 'Enable Tailscale SSH on this node',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@IsBoolean()
	ssh: boolean = false;

	@ApiProperty({
		name: 'serve_https',
		description: 'Serve the admin UI over HTTPS through Tailscale Serve',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'serve_https' })
	@IsBoolean()
	serveHttps: boolean = true;

	@ApiProperty({
		description: 'Publish the served admin UI to the public internet through Tailscale Funnel',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@IsBoolean()
	funnel: boolean = false;
}
