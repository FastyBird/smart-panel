import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { DisplayProfileEntity } from '../entities/system.entity';

import {
	ExtensionBaseModel,
	LogEntryAcceptedModel,
	LogEntryModel,
	SystemHealthModel,
	SystemInfoModel,
	ThrottleStatusModel,
} from './system.model';

/**
 * Response wrapper for DisplayProfileEntity
 */
@ApiSchema({ name: 'SystemModuleResDisplayProfile' })
export class DisplayProfileResponseModel extends BaseSuccessResponseModel<DisplayProfileEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => DisplayProfileEntity,
	})
	@Expose()
	declare data: DisplayProfileEntity;
}

/**
 * Response wrapper for array of DisplayProfileEntity
 */
@ApiSchema({ name: 'SystemModuleResDisplayProfiles' })
export class DisplayProfilesResponseModel extends BaseSuccessResponseModel<DisplayProfileEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(DisplayProfileEntity) },
	})
	@Expose()
	declare data: DisplayProfileEntity[];
}

/**
 * Response wrapper for DisplayProfileEntity by UID
 */
@ApiSchema({ name: 'SystemModuleResDisplayProfileByUid' })
export class DisplayProfileByUidResponseModel extends BaseSuccessResponseModel<DisplayProfileEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => DisplayProfileEntity,
	})
	@Expose()
	declare data: DisplayProfileEntity;
}

/**
 * Response wrapper for array of ExtensionBaseModel
 */
@ApiSchema({ name: 'SystemModuleResExtensions' })
export class ExtensionsResponseModel extends BaseSuccessResponseModel<ExtensionBaseModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(ExtensionBaseModel) },
	})
	@Expose()
	declare data: ExtensionBaseModel[];
}

/**
 * Response wrapper for array of LogEntryModel
 */
@ApiSchema({ name: 'SystemModuleResLogEntries' })
export class LogEntriesResponseModel extends BaseSuccessResponseModel<LogEntryModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(LogEntryModel) },
	})
	@Expose()
	declare data: LogEntryModel[];
}

/**
 * Response wrapper for LogEntryAcceptedModel
 */
@ApiSchema({ name: 'SystemModuleResLogEntryAccepted' })
export class LogEntryAcceptedResponseModel extends BaseSuccessResponseModel<LogEntryAcceptedModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => LogEntryAcceptedModel,
	})
	@Expose()
	declare data: LogEntryAcceptedModel;
}

/**
 * Response wrapper for SystemHealthModel
 */
@ApiSchema({ name: 'SystemModuleResSystemHealth' })
export class SystemHealthResponseModel extends BaseSuccessResponseModel<SystemHealthModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => SystemHealthModel,
	})
	@Expose()
	declare data: SystemHealthModel;
}

/**
 * Response wrapper for SystemInfoModel
 */
@ApiSchema({ name: 'SystemModuleResSystemInfo' })
export class SystemInfoResponseModel extends BaseSuccessResponseModel<SystemInfoModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => SystemInfoModel,
	})
	@Expose()
	declare data: SystemInfoModel;
}

/**
 * Response wrapper for ThrottleStatusModel
 */
@ApiSchema({ name: 'SystemModuleResThrottleStatus' })
export class ThrottleStatusResponseModel extends BaseSuccessResponseModel<ThrottleStatusModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => ThrottleStatusModel,
	})
	@Expose()
	declare data: ThrottleStatusModel;
}

/**
 * Log ingest result schema
 */
@ApiSchema({ name: 'SystemModuleLogIngestResult' })
export class SystemModuleLogIngestResult {
	@ApiProperty({
		description: 'Number of log entries accepted',
		type: 'number',
		example: 5,
	})
	accepted: number;

	@ApiProperty({
		description: 'Number of log entries rejected',
		type: 'number',
		example: 0,
	})
	rejected: number;
}
