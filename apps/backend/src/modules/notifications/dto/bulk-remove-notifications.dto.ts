import { Expose, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsDefined, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BULK_NOTIFICATIONS_MAX_IDS } from '../notifications.constants';

@ApiSchema({ name: 'NotificationsModuleBulkRemoveNotifications' })
export class BulkRemoveNotificationsDto {
	@ApiProperty({
		description: 'Identifiers of the notifications to remove',
		type: 'array',
		items: { type: 'string', format: 'uuid' },
		example: ['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6'],
	})
	@Expose()
	@IsArray({ message: '[{"field":"ids","reason":"Ids must be an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"ids","reason":"At least one notification identifier is required."}]' })
	@ArrayMaxSize(BULK_NOTIFICATIONS_MAX_IDS, {
		message: `[{"field":"ids","reason":"At most ${BULK_NOTIFICATIONS_MAX_IDS} notification identifiers can be sent in one request."}]`,
	})
	@IsUUID('4', {
		each: true,
		message: '[{"field":"ids","reason":"Each notification identifier must be a valid UUID."}]',
	})
	ids: string[];
}

@ApiSchema({ name: 'NotificationsModuleReqBulkRemoveNotifications' })
export class ReqBulkRemoveNotificationsDto {
	@ApiProperty({ description: 'Bulk removal data', type: () => BulkRemoveNotificationsDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Bulk removal data is required."}]' })
	@ValidateNested()
	@Type(() => BulkRemoveNotificationsDto)
	data: BulkRemoveNotificationsDto;
}
