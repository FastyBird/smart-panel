import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

/**
 * Body for `POST /login`. The auth key is accepted only here, used once to
 * write an ephemeral `0600` file consumed by `tailscale up
 * --auth-key=file:<path>`, and never persisted or logged — see
 * `TailscaleLoginService`.
 */
@ApiSchema({ name: 'RemoteAccessTailscalePluginReqLogin' })
export class RemoteAccessTailscalePluginLoginDto {
	@ApiPropertyOptional({
		name: 'auth_key',
		description:
			'Pre-authorised Tailscale auth key for a headless sign-in. Used once to sign in and never stored or logged. Omit to receive an interactive sign-in link and QR code instead.',
		type: 'string',
		writeOnly: true,
		example: 'tskey-auth-xxxxxCNTRL-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
	})
	@Expose({ name: 'auth_key' })
	@IsOptional()
	@IsString({ message: '[{"field":"auth_key","reason":"Auth key must be a valid string."}]' })
	authKey?: string;
}
