import { Expose, Type } from 'class-transformer';
import { Equals, IsDefined, IsString, IsUUID, Matches, MaxLength, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

export const COVER_RECOVERY_ACKNOWLEDGEMENT = 'accept_uncertain_physical_handback' as const;
@ApiSchema({ name: 'DevicesShellyNgPluginRecoverCoverOrdering' })
export class RecoverCoverOrderingDto {
	@ApiProperty({ description: 'Current short-lived server recovery context identifier', format: 'uuid' })
	@Expose()
	@IsUUID()
	context_id: string;
	@ApiProperty({ description: 'Exact unresolved reservation token from the authorized context', format: 'uuid' })
	@Expose()
	@IsUUID()
	expected_token: string;
	@ApiProperty({ description: 'Exact current mapping, source, configuration and connection revision' })
	@Expose()
	@IsString()
	@Matches(/^[a-f0-9]{64}$/)
	expected_revision: string;
	@ApiProperty({
		description: 'Explicit operator acceptance that the previously sent action may still execute',
		enum: [COVER_RECOVERY_ACKNOWLEDGEMENT],
	})
	@Expose()
	@Equals(COVER_RECOVERY_ACKNOWLEDGEMENT)
	acknowledgement: typeof COVER_RECOVERY_ACKNOWLEDGEMENT;
	@ApiProperty({
		description: 'Operator reason for accepting responsibility for physical handback',
		minLength: 1,
		maxLength: 500,
	})
	@Expose()
	@IsString()
	@Matches(/\S/)
	@MaxLength(500)
	reason: string;
}
@ApiSchema({ name: 'DevicesShellyNgPluginReqRecoverCoverOrdering' })
export class ReqRecoverCoverOrderingDto {
	@ApiProperty({ description: 'Operator uncertainty override request', type: () => RecoverCoverOrderingDto })
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => RecoverCoverOrderingDto)
	data: RecoverCoverOrderingDto;
}
