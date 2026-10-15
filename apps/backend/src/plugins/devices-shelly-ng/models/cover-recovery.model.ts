import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

@ApiSchema({ name: 'DevicesShellyNgPluginDataCoverRecoveryContext' })
export class CoverRecoveryContextModel {
	@ApiProperty({ description: 'Short-lived server-bound recovery context', format: 'uuid' })
	@Expose()
	context_id: string;
	@ApiProperty({ description: 'Canonical ordinary physical motor identity' }) @Expose() physical_identity: string;
	@ApiProperty({
		description: 'Unresolved reservation token; only an identified owner or administrator may read it',
		format: 'uuid',
	})
	@Expose()
	expected_token: string;
	@ApiProperty({ description: 'Mapping, source, configuration and connection revision' })
	@Expose()
	expected_revision: string;
	@ApiProperty({ description: 'Unresolved reservation creation time', format: 'date-time' })
	@Expose()
	started_at: string;
	@ApiProperty({ description: 'Recovery context expiration time', format: 'date-time' }) @Expose() expires_at: string;
}
@ApiSchema({ name: 'DevicesShellyNgPluginDataCoverRecovery' })
export class CoverRecoveryModel {
	@ApiProperty({ description: 'Durable operator uncertainty override epoch', format: 'uuid' })
	@Expose()
	override_epoch: string;
	@ApiProperty({
		description: 'Explicit advisory; this is neither a drain barrier nor command confirmation',
		enum: ['operator_overridden_unresolved_ordering'],
	})
	@Expose()
	advisory: 'operator_overridden_unresolved_ordering';
	@ApiProperty({
		description: 'Fresh observed nonmoving state before the override; only a current condition observation',
	})
	@Expose()
	observed_state: string;
	@ApiProperty({ description: 'Time of the fresh current-condition observation', format: 'date-time' })
	@Expose()
	observed_at: string;
}
@ApiSchema({ name: 'DevicesShellyNgPluginResCoverRecoveryContext' })
export class CoverRecoveryContextResponseModel extends BaseSuccessResponseModel<CoverRecoveryContextModel> {
	@ApiProperty({
		description: 'Authorized unresolved ordering recovery context',
		type: () => CoverRecoveryContextModel,
	})
	@Expose()
	declare data: CoverRecoveryContextModel;
}
@ApiSchema({ name: 'DevicesShellyNgPluginResCoverRecovery' })
export class CoverRecoveryResponseModel extends BaseSuccessResponseModel<CoverRecoveryModel> {
	@ApiProperty({
		description: 'Audited operator uncertainty override result; never command evidence',
		type: () => CoverRecoveryModel,
	})
	@Expose()
	declare data: CoverRecoveryModel;
}
