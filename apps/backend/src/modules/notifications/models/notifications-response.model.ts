import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel, SuccessPaginatedMetadataModel } from '../../api/models/api-response.model';
import { BulkResultModel } from '../../api/models/bulk.model';
import { NotificationEntity } from '../entities/notifications.entity';

/**
 * Response wrapper for NotificationEntity
 */
@ApiSchema({ name: 'NotificationsModuleResNotification' })
export class NotificationResponseModel extends BaseSuccessResponseModel<NotificationEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => NotificationEntity,
	})
	@Expose()
	declare data: NotificationEntity;
}

/**
 * Response wrapper for array of NotificationEntity, paginated through a cursor.
 */
@ApiSchema({ name: 'NotificationsModuleResNotifications' })
export class NotificationsResponseModel extends BaseSuccessResponseModel<NotificationEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(NotificationEntity) },
	})
	@Expose()
	declare data: NotificationEntity[];

	@ApiProperty({
		description:
			'Additional metadata about the request and server performance metrics, including the pagination cursor.',
		type: () => SuccessPaginatedMetadataModel,
	})
	@Expose()
	declare metadata: SuccessPaginatedMetadataModel;
}

/**
 * Response wrapper for the outcome of a bulk operation
 */
@ApiSchema({ name: 'NotificationsModuleResBulkResult' })
export class BulkResultResponseModel extends BaseSuccessResponseModel<BulkResultModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => BulkResultModel,
	})
	@Expose()
	declare data: BulkResultModel;
}
