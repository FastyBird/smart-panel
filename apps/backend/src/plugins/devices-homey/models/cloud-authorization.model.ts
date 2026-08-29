import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

@ApiSchema({ name: 'DevicesHomeyPluginDataCloudAuthorizationStart' })
export class HomeyCloudAuthorizationStartModel {
	@ApiProperty({ name: 'authorize_url', description: 'Homey authorization URL', format: 'uri' })
	@Expose({ name: 'authorize_url' })
	@IsString()
	authorizeUrl: string;

	@ApiProperty({ name: 'transaction_id', description: 'Opaque transaction used for selection or cancellation' })
	@Expose({ name: 'transaction_id' })
	@IsString()
	transactionId: string;

	@ApiProperty({ name: 'expires_at', description: 'Authorization-state expiry', format: 'date-time' })
	@Expose({ name: 'expires_at' })
	@IsDateString()
	expiresAt: string;
}

@ApiSchema({ name: 'DevicesHomeyPluginResCloudAuthorizationStart' })
export class HomeyCloudAuthorizationStartResponseModel extends BaseSuccessResponseModel<HomeyCloudAuthorizationStartModel> {
	@ApiProperty({ type: HomeyCloudAuthorizationStartModel })
	@Expose()
	@ValidateNested()
	@Type(() => HomeyCloudAuthorizationStartModel)
	declare data: HomeyCloudAuthorizationStartModel;
}

@ApiSchema({ name: 'DevicesHomeyPluginDataCloudHomeyChoice' })
export class HomeyCloudChoiceModel {
	@ApiProperty({ description: 'Eligible Homey identifier' })
	@Expose()
	@IsString()
	id: string;

	@ApiProperty({ description: 'Sanitized Homey display name' })
	@Expose()
	@IsString()
	name: string;
}

@ApiSchema({ name: 'DevicesHomeyPluginDataCloudHomeyChoices' })
export class HomeyCloudChoicesModel {
	@ApiProperty({ type: [HomeyCloudChoiceModel] })
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => HomeyCloudChoiceModel)
	homeys: HomeyCloudChoiceModel[];
}

@ApiSchema({ name: 'DevicesHomeyPluginResCloudHomeyChoices' })
export class HomeyCloudChoicesResponseModel extends BaseSuccessResponseModel<HomeyCloudChoicesModel> {
	@ApiProperty({ type: HomeyCloudChoicesModel })
	@Expose()
	@ValidateNested()
	@Type(() => HomeyCloudChoicesModel)
	declare data: HomeyCloudChoicesModel;
}

export enum HomeyCloudAuthorizationCompletionStatus {
	CONNECTED = 'connected',
	CANCELLED = 'cancelled',
	DISCONNECTED = 'disconnected',
}

@ApiSchema({ name: 'DevicesHomeyPluginDataCloudAuthorizationCompletion' })
export class HomeyCloudAuthorizationCompletionModel {
	@ApiProperty({ enum: HomeyCloudAuthorizationCompletionStatus })
	@Expose()
	@IsIn(Object.values(HomeyCloudAuthorizationCompletionStatus))
	status: HomeyCloudAuthorizationCompletionStatus;

	@ApiProperty({ description: 'Whether the requested mutation changed persisted authorization state' })
	@Expose()
	@IsBoolean()
	changed: boolean;

	@ApiProperty({
		name: 'homey_id',
		description: 'Selected Homey identifier after a successful selection',
		required: false,
		nullable: true,
	})
	@Expose({ name: 'homey_id' })
	@IsOptional()
	@IsString()
	homeyId: string | null;
}

@ApiSchema({ name: 'DevicesHomeyPluginResCloudAuthorizationCompletion' })
export class HomeyCloudAuthorizationCompletionResponseModel extends BaseSuccessResponseModel<HomeyCloudAuthorizationCompletionModel> {
	@ApiProperty({ type: HomeyCloudAuthorizationCompletionModel })
	@Expose()
	@ValidateNested()
	@Type(() => HomeyCloudAuthorizationCompletionModel)
	declare data: HomeyCloudAuthorizationCompletionModel;
}
