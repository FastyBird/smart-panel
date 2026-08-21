import { Expose, Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

export enum HomeyAdoptionStatus {
	CREATED = 'created',
	UPDATED = 'updated',
	SKIPPED = 'skipped',
	FAILED = 'failed',
}

export enum HomeyAdoptionFailureCode {
	UNAVAILABLE = 'unavailable',
	DEVICE_NOT_FOUND = 'device_not_found',
	UNSUPPORTED_MAPPING = 'unsupported_mapping',
	PERSISTENCE_FAILED = 'persistence_failed',
	ROLLBACK_FAILED = 'rollback_failed',
}

@ApiSchema({ name: 'DevicesHomeyPluginDataAdoptionResult' })
export class HomeyAdoptionResultModel {
	@ApiProperty({ name: 'device_id', description: 'Authoritative full Homey device identifier' })
	@Expose({ name: 'device_id' })
	@IsString()
	deviceId: string;

	@ApiProperty({ description: 'Idempotent adoption outcome', enum: HomeyAdoptionStatus })
	@Expose()
	@IsEnum(HomeyAdoptionStatus)
	status: HomeyAdoptionStatus;

	@ApiPropertyOptional({
		name: 'panel_device_id',
		description: 'Smart Panel device identifier when adoption succeeded',
		type: 'string',
		format: 'uuid',
		nullable: true,
	})
	@Expose({ name: 'panel_device_id' })
	@IsOptional()
	@IsUUID('4')
	panelDeviceId: string | null;

	@ApiPropertyOptional({
		name: 'failure_code',
		description: 'Stable sanitized failure category',
		enum: HomeyAdoptionFailureCode,
		nullable: true,
	})
	@Expose({ name: 'failure_code' })
	@IsOptional()
	@IsEnum(HomeyAdoptionFailureCode)
	failureCode: HomeyAdoptionFailureCode | null;

	@ApiPropertyOptional({ description: 'Sanitized failure message', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	message: string | null;
}

@ApiSchema({ name: 'DevicesHomeyPluginDataBatchAdoption' })
export class HomeyBatchAdoptionModel {
	@ApiProperty({ description: 'Per-device results in request order', type: [HomeyAdoptionResultModel] })
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => HomeyAdoptionResultModel)
	results: HomeyAdoptionResultModel[];
}

@ApiSchema({ name: 'DevicesHomeyPluginResAdoption' })
export class HomeyAdoptionResponseModel extends BaseSuccessResponseModel<HomeyAdoptionResultModel> {
	@ApiProperty({ description: 'Homey adoption result', type: HomeyAdoptionResultModel })
	@Expose()
	@ValidateNested()
	@Type(() => HomeyAdoptionResultModel)
	declare data: HomeyAdoptionResultModel;
}

@ApiSchema({ name: 'DevicesHomeyPluginResBatchAdoption' })
export class HomeyBatchAdoptionResponseModel extends BaseSuccessResponseModel<HomeyBatchAdoptionModel> {
	@ApiProperty({ description: 'Homey batch adoption results', type: HomeyBatchAdoptionModel })
	@Expose()
	@ValidateNested()
	@Type(() => HomeyBatchAdoptionModel)
	declare data: HomeyBatchAdoptionModel;
}
