import { Expose } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel, SuccessPaginatedMetadataModel } from '../../api/models/api-response.model';
import { DisplayProfileEntity } from '../entities/system.entity';

import {
	ExtensionAdminModel,
	ExtensionBackendModel,
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
		items: {
			oneOf: [{ $ref: getSchemaPath(ExtensionAdminModel) }, { $ref: getSchemaPath(ExtensionBackendModel) }],
			discriminator: {
				propertyName: 'location_type',
				mapping: {
					admin: getSchemaPath(ExtensionAdminModel),
					backend: getSchemaPath(ExtensionBackendModel),
				},
			},
		},
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

	@ApiProperty({
		description: 'Additional metadata about the request and server performance metrics.',
		type: () => SuccessPaginatedMetadataModel,
	})
	@Expose()
	declare metadata: SuccessPaginatedMetadataModel;
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
		type: 'integer',
		example: 5,
	})
	accepted: number;

	@ApiProperty({
		description: 'Number of log entries rejected',
		type: 'integer',
		example: 0,
	})
	rejected: number;

	@ApiPropertyOptional({
		description:
			'Optional list of validation or processing errors for rejected items. Each entry references the index of the rejected log event in the original request batch.',
		type: 'array',
		items: {
			type: 'object',
			properties: {
				index: {
					type: 'integer',
					minimum: 0,
					description: 'Zero-based index of the log event within the submitted data array that caused an error.',
				},
				reason: {
					type: 'string',
					description: 'Short, human-readable reason describing why the log event was rejected.',
				},
				details: {
					type: 'string',
					description: 'Optional additional details about the error.',
					nullable: true,
				},
			},
			required: ['index', 'reason'],
		},
	})
	errors?: Array<{
		index: number;
		reason: string;
		details?: string | null;
	}>;
}
