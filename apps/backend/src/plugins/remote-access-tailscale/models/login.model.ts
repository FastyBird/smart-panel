import { Expose } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { RemoteAccessProviderState } from '../../../modules/remote-access/platforms/remote-access-provider.platform';

const REMOTE_ACCESS_PROVIDER_STATES: RemoteAccessProviderState[] = [
	'unsupported',
	'not-installed',
	'setup-required',
	'pending-auth',
	'pending-approval',
	'connecting',
	'connected',
	'disconnected',
	'error',
];

/**
 * Result of `POST /login`: the resulting state after an auth-key sign-in, or
 * the auth URL and QR code to complete an interactive one. `authUrl`/`qr`
 * are set only while `state` is `pending-auth` — the controller sends
 * `Cache-Control: no-store` whenever either is present, exactly like
 * `RemoteAccessTailscalePluginStatusModel`.
 */
@ApiSchema({ name: 'RemoteAccessTailscalePluginDataLogin' })
export class RemoteAccessTailscalePluginLoginModel {
	@ApiProperty({
		description: 'Provider state resulting from this sign-in attempt',
		enum: REMOTE_ACCESS_PROVIDER_STATES,
		example: 'pending-auth',
	})
	@Expose()
	@IsEnum(REMOTE_ACCESS_PROVIDER_STATES)
	state: RemoteAccessProviderState;

	@ApiPropertyOptional({
		name: 'auth_url',
		description:
			'Interactive sign-in link. Present only while state is pending-auth. A capability URL — never logged or persisted.',
		type: 'string',
		example: 'https://login.tailscale.com/a/0123456789abcdef',
	})
	@Expose({ name: 'auth_url' })
	@IsOptional()
	@IsString()
	authUrl?: string;

	@ApiPropertyOptional({
		description:
			'QR code encoding the sign-in link, as a base64 PNG data URL. Present only while state is pending-auth.',
		type: 'string',
		example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
	})
	@Expose()
	@IsOptional()
	@IsString()
	qr?: string;
}

/**
 * Response wrapper for RemoteAccessTailscalePluginLoginModel
 */
@ApiSchema({ name: 'RemoteAccessTailscalePluginResLogin' })
export class RemoteAccessTailscalePluginLoginResponseModel extends BaseSuccessResponseModel<RemoteAccessTailscalePluginLoginModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => RemoteAccessTailscalePluginLoginModel,
	})
	@Expose()
	declare data: RemoteAccessTailscalePluginLoginModel;
}

/**
 * Result of `POST /install`: the id of the privileged setup job just
 * started. Progress is streamed separately as
 * `RemoteAccessModule.Setup.Progress` websocket events keyed by this same
 * job id — this response never blocks on the job finishing.
 */
@ApiSchema({ name: 'RemoteAccessTailscalePluginDataInstall' })
export class RemoteAccessTailscalePluginInstallModel {
	@ApiProperty({
		description: 'Privileged setup job id, matching the `job` field of RemoteAccessModule.Setup.Progress events',
		type: 'string',
		format: 'uuid',
		example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
	})
	@Expose()
	@IsString()
	job: string;
}

/**
 * Response wrapper for RemoteAccessTailscalePluginInstallModel
 */
@ApiSchema({ name: 'RemoteAccessTailscalePluginResInstall' })
export class RemoteAccessTailscalePluginInstallResponseModel extends BaseSuccessResponseModel<RemoteAccessTailscalePluginInstallModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => RemoteAccessTailscalePluginInstallModel,
	})
	@Expose()
	declare data: RemoteAccessTailscalePluginInstallModel;
}
