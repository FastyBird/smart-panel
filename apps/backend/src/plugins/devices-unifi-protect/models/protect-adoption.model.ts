import { Expose, Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import {
	PROTECT_RTSPS_QUALITIES,
	PROTECT_STREAM_QUALITIES,
	ProtectRtspsQuality,
	ProtectStreamQuality,
} from '../devices-unifi-protect.constants';
import { ProtectErrorCategory } from '../errors/protect-api.error';
import { PROTECT_MODEL_KEYS, ProtectModelKey } from '../mappings/mapping.types';

export enum ProtectAdoptionStatus {
	CREATED = 'created',
	UPDATED = 'updated',
	SKIPPED = 'skipped',
	FAILED = 'failed',
}

export enum ProtectAdoptionFailureCode {
	UNAVAILABLE = 'unavailable',
	DEVICE_NOT_FOUND = 'device_not_found',
	UNSUPPORTED_MAPPING = 'unsupported_mapping',
	NOT_READY = 'not_ready',
	PERSISTENCE_FAILED = 'persistence_failed',
	ROLLBACK_FAILED = 'rollback_failed',
}

export enum ProtectAdoptionWarningCode {
	/** The structure was saved but some current values were not written; the next adoption completes them. */
	VALUES_INCOMPLETE = 'values_incomplete',
}

export enum ProtectStreamOutcome {
	ENABLED = 'enabled',
	ALREADY_ENABLED = 'already_enabled',
	NOT_REQUESTED = 'not_requested',
	FAILED = 'failed',
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataAdoptionStream' })
export class ProtectAdoptionStreamModel {
	@ApiProperty({ description: 'RTSPS stream enablement outcome', enum: ProtectStreamOutcome })
	@Expose()
	@IsEnum(ProtectStreamOutcome)
	status: ProtectStreamOutcome;

	@ApiPropertyOptional({
		description: 'Stream quality that was requested',
		enum: PROTECT_STREAM_QUALITIES,
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	quality: ProtectStreamQuality | null;

	@ApiProperty({
		name: 'enabled_qualities',
		description: 'Qualities enabled on the console after adoption, never stream addresses',
		enum: PROTECT_RTSPS_QUALITIES,
		isArray: true,
	})
	@Expose({ name: 'enabled_qualities' })
	@IsArray()
	enabledQualities: ProtectRtspsQuality[];

	@ApiPropertyOptional({
		name: 'failure_category',
		description: 'Sanitized failure category of a failed enablement',
		enum: ProtectErrorCategory,
		nullable: true,
	})
	@Expose({ name: 'failure_category' })
	@IsOptional()
	@IsEnum(ProtectErrorCategory)
	failureCategory: ProtectErrorCategory | null;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataAdoptionResult' })
export class ProtectAdoptionResultModel {
	@ApiProperty({ name: 'device_id', description: 'UniFi Protect device identifier' })
	@Expose({ name: 'device_id' })
	@IsString()
	deviceId: string;

	@ApiProperty({ name: 'model_key', description: 'UniFi Protect device kind', enum: PROTECT_MODEL_KEYS })
	@Expose({ name: 'model_key' })
	@IsString()
	modelKey: ProtectModelKey;

	@ApiProperty({ description: 'Idempotent adoption outcome', enum: ProtectAdoptionStatus })
	@Expose()
	@IsEnum(ProtectAdoptionStatus)
	status: ProtectAdoptionStatus;

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
		enum: ProtectAdoptionFailureCode,
		nullable: true,
	})
	@Expose({ name: 'failure_code' })
	@IsOptional()
	@IsEnum(ProtectAdoptionFailureCode)
	failureCode: ProtectAdoptionFailureCode | null;

	@ApiPropertyOptional({ description: 'Sanitized failure message', type: 'string', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	message: string | null;

	@ApiProperty({
		description: 'Warnings of a successful adoption',
		enum: ProtectAdoptionWarningCode,
		isArray: true,
	})
	@Expose()
	@IsArray()
	@IsEnum(ProtectAdoptionWarningCode, { each: true })
	warnings: ProtectAdoptionWarningCode[];

	@ApiPropertyOptional({
		description: 'RTSPS stream enablement of a camera; null for other devices and failed adoptions',
		type: () => ProtectAdoptionStreamModel,
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => ProtectAdoptionStreamModel)
	stream: ProtectAdoptionStreamModel | null;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataBatchAdoption' })
export class ProtectBatchAdoptionModel {
	@ApiProperty({ description: 'Per-device results in request order', type: [ProtectAdoptionResultModel] })
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ProtectAdoptionResultModel)
	results: ProtectAdoptionResultModel[];
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginResAdoption' })
export class ProtectAdoptionResponseModel extends BaseSuccessResponseModel<ProtectAdoptionResultModel> {
	@ApiProperty({ description: 'UniFi Protect adoption result', type: ProtectAdoptionResultModel })
	@Expose()
	@ValidateNested()
	@Type(() => ProtectAdoptionResultModel)
	declare data: ProtectAdoptionResultModel;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginResBatchAdoption' })
export class ProtectBatchAdoptionResponseModel extends BaseSuccessResponseModel<ProtectBatchAdoptionModel> {
	@ApiProperty({ description: 'UniFi Protect batch adoption results', type: ProtectBatchAdoptionModel })
	@Expose()
	@ValidateNested()
	@Type(() => ProtectBatchAdoptionModel)
	declare data: ProtectBatchAdoptionModel;
}
