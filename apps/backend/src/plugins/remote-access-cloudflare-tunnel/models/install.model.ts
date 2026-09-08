import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

/**
 * Result of `POST /install`: the id of the privileged setup job just started. Progress is
 * streamed separately as `RemoteAccessModule.Setup.Progress` websocket events keyed by this
 * same job id — this response never blocks on the job finishing. Mirrors
 * `RemoteAccessTailscalePluginInstallModel`.
 */
@ApiSchema({ name: 'RemoteAccessCloudflareTunnelPluginDataInstall' })
export class RemoteAccessCloudflareTunnelPluginInstallModel {
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
 * Response wrapper for RemoteAccessCloudflareTunnelPluginInstallModel
 */
@ApiSchema({ name: 'RemoteAccessCloudflareTunnelPluginResInstall' })
export class RemoteAccessCloudflareTunnelPluginInstallResponseModel extends BaseSuccessResponseModel<RemoteAccessCloudflareTunnelPluginInstallModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => RemoteAccessCloudflareTunnelPluginInstallModel,
	})
	@Expose()
	declare data: RemoteAccessCloudflareTunnelPluginInstallModel;
}
