import { Expose } from 'class-transformer';
import { IsBoolean, IsEnum, IsFQDN, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import {
	CLOUDFLARE_TUNNEL_DEFAULT_PROTOCOL,
	CLOUDFLARE_TUNNEL_PROTOCOLS,
	CloudflareTunnelProtocol,
	REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
} from '../remote-access-cloudflare-tunnel.constants';

@ApiSchema({ name: 'RemoteAccessCloudflareTunnelPluginDataConfig' })
export class RemoteAccessCloudflareTunnelPluginConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME;

	@ApiProperty({
		name: 'public_hostname',
		description: 'Public hostname the tunnel publishes, e.g. panel.example.com. Hostname only — no scheme or path.',
		type: 'string',
		nullable: true,
		example: 'panel.example.com',
	})
	@Expose({ name: 'public_hostname' })
	@ValidateIf((config: RemoteAccessCloudflareTunnelPluginConfigModel) => config.publicHostname !== null)
	@IsFQDN(
		{},
		{
			message:
				'[{"field":"public_hostname","reason":"Public hostname must be a valid hostname, without a scheme or path."}]',
		},
	)
	publicHostname: string | null = null;

	@ApiProperty({
		description: 'Protocol cloudflared uses to connect to the Cloudflare edge',
		enum: CLOUDFLARE_TUNNEL_PROTOCOLS,
		example: CLOUDFLARE_TUNNEL_DEFAULT_PROTOCOL,
	})
	@Expose()
	@IsEnum(CLOUDFLARE_TUNNEL_PROTOCOLS)
	protocol: CloudflareTunnelProtocol = CLOUDFLARE_TUNNEL_DEFAULT_PROTOCOL;

	@ApiPropertyOptional({
		name: 'tunnel_token',
		description:
			'Tunnel token from the Cloudflare Zero Trust dashboard. This value is accepted on write and never returned.',
		type: 'string',
		nullable: true,
		writeOnly: true,
	})
	@Expose({ name: 'tunnel_token' })
	@ValidateIf((config: RemoteAccessCloudflareTunnelPluginConfigModel) => config.tunnelToken !== null)
	@IsNotEmpty()
	@IsString()
	tunnelToken: string | null = null;

	@ApiProperty({
		name: 'tunnel_token_configured',
		description: 'Whether a tunnel token is configured',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'tunnel_token_configured' })
	@IsOptional()
	@IsBoolean()
	tunnelTokenConfigured?: boolean;
}
