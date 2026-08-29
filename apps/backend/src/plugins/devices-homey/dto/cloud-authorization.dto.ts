import { Expose, Transform, Type } from 'class-transformer';
import { IsDefined, IsNotEmpty, IsObject, IsString, MaxLength, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { HOMEY_CLOUD_MAX_HOMEY_ID_LENGTH, HOMEY_CLOUD_MAX_TRANSACTION_ID_LENGTH } from '../devices-homey.constants';

@ApiSchema({ name: 'DevicesHomeyPluginCloudAuthorizationTransaction' })
export class HomeyCloudAuthorizationTransactionDto {
	@ApiProperty({
		name: 'transaction_id',
		description: 'Opaque authorization transaction returned by the authorization-start endpoint',
		maxLength: HOMEY_CLOUD_MAX_TRANSACTION_ID_LENGTH,
	})
	@Expose({ name: 'transaction_id' })
	@Transform(
		({ obj }: { obj: Record<string, unknown> }) =>
			Object.hasOwn(obj, 'transaction_id') ? obj.transaction_id : obj.transactionId,
		{ toClassOnly: true },
	)
	@IsString({ message: '[{"field":"transaction_id","reason":"Transaction ID must be a string."}]' })
	@IsNotEmpty({ message: '[{"field":"transaction_id","reason":"Transaction ID is required."}]' })
	@MaxLength(HOMEY_CLOUD_MAX_TRANSACTION_ID_LENGTH, {
		message: '[{"field":"transaction_id","reason":"Transaction ID is too long."}]',
	})
	transactionId: string;
}

@ApiSchema({ name: 'DevicesHomeyPluginReqCloudAuthorizationTransaction' })
export class HomeyCloudAuthorizationTransactionRequestDto {
	@ApiProperty({ type: HomeyCloudAuthorizationTransactionDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Authorization transaction data is required."}]' })
	@IsObject({ message: '[{"field":"data","reason":"Authorization transaction data must be an object."}]' })
	@ValidateNested()
	@Type(() => HomeyCloudAuthorizationTransactionDto)
	data: HomeyCloudAuthorizationTransactionDto;
}

@ApiSchema({ name: 'DevicesHomeyPluginCloudAuthorizationSelection' })
export class HomeyCloudAuthorizationSelectionDto extends HomeyCloudAuthorizationTransactionDto {
	@ApiProperty({
		name: 'homey_id',
		description: 'Exact eligible Homey identifier returned for this authorization transaction',
		maxLength: HOMEY_CLOUD_MAX_HOMEY_ID_LENGTH,
	})
	@Expose({ name: 'homey_id' })
	@Transform(
		({ obj }: { obj: Record<string, unknown> }) => (Object.hasOwn(obj, 'homey_id') ? obj.homey_id : obj.homeyId),
		{ toClassOnly: true },
	)
	@IsString({ message: '[{"field":"homey_id","reason":"Homey ID must be a string."}]' })
	@IsNotEmpty({ message: '[{"field":"homey_id","reason":"Homey ID is required."}]' })
	@MaxLength(HOMEY_CLOUD_MAX_HOMEY_ID_LENGTH, {
		message: '[{"field":"homey_id","reason":"Homey ID is too long."}]',
	})
	homeyId: string;
}

@ApiSchema({ name: 'DevicesHomeyPluginReqCloudAuthorizationSelection' })
export class HomeyCloudAuthorizationSelectionRequestDto {
	@ApiProperty({ type: HomeyCloudAuthorizationSelectionDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Homey selection data is required."}]' })
	@IsObject({ message: '[{"field":"data","reason":"Homey selection data must be an object."}]' })
	@ValidateNested()
	@Type(() => HomeyCloudAuthorizationSelectionDto)
	data: HomeyCloudAuthorizationSelectionDto;
}
