import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsFQDN, IsOptional, IsString, ValidateIf } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { readSubmittedValue } from '../../../common/utils/transform.utils';
import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import {
	CLOUDFLARE_TUNNEL_PROTOCOLS,
	CloudflareTunnelProtocol,
	REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
} from '../remote-access-cloudflare-tunnel.constants';

@ApiSchema({ name: 'RemoteAccessCloudflareTunnelPluginUpdateConfig' })
export class UpdateRemoteAccessCloudflareTunnelPluginConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME;

	@ApiPropertyOptional({
		description: 'Enable or disable the plugin',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled must be a boolean."}]' })
	enabled?: boolean;

	@ApiPropertyOptional({
		name: 'public_hostname',
		description:
			'Replacement public hostname, e.g. panel.example.com. Hostname only — no scheme or path. Omit to preserve the stored value or send null to clear it.',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'public_hostname' })
	@IsOptional()
	@ValidateIf((dto: UpdateRemoteAccessCloudflareTunnelPluginConfigDto) => dto.publicHostname !== null)
	@IsFQDN(
		{},
		{
			message:
				'[{"field":"public_hostname","reason":"Public hostname must be a valid hostname, without a scheme or path."}]',
		},
	)
	publicHostname?: string | null;

	@ApiPropertyOptional({
		description: 'Protocol cloudflared uses to connect to the Cloudflare edge',
		enum: CLOUDFLARE_TUNNEL_PROTOCOLS,
		example: 'auto',
	})
	@Expose()
	@IsOptional()
	@IsEnum(CLOUDFLARE_TUNNEL_PROTOCOLS, {
		message: '[{"field":"protocol","reason":"Protocol must be one of auto, http2, quic."}]',
	})
	protocol?: CloudflareTunnelProtocol;

	@ApiPropertyOptional({
		name: 'tunnel_token',
		description:
			'Replacement tunnel token from the Cloudflare Zero Trust dashboard. Omit to preserve the stored token or send null to clear it.',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'tunnel_token' })
	@Transform(({ obj }: { obj: unknown }) => readSubmittedValue<string>(obj, 'tunnel_token', 'tunnelToken'), {
		toClassOnly: true,
	})
	@IsOptional()
	@IsString({ message: '[{"field":"tunnel_token","reason":"Tunnel token must be a string."}]' })
	tunnelToken?: string | null;
}
