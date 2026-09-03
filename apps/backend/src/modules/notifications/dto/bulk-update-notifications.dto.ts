import { Expose, Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayNotEmpty,
	IsArray,
	IsBoolean,
	IsDefined,
	IsOptional,
	IsUUID,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BULK_NOTIFICATIONS_MAX_IDS } from '../notifications.constants';

@ApiSchema({ name: 'NotificationsModuleBulkUpdateNotifications' })
export class BulkUpdateNotificationsDto {
	@ApiProperty({
		description: 'Identifiers of the notifications to update',
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

	@ApiPropertyOptional({
		description: 'Marks the listed notifications read or unread.',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"read","reason":"Read must be a valid true or false."}]' })
	read?: boolean;

	@ApiPropertyOptional({
		description: 'Marks the listed notifications dismissed or restores them.',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"dismissed","reason":"Dismissed must be a valid true or false."}]' })
	dismissed?: boolean;
}

@ApiSchema({ name: 'NotificationsModuleReqBulkUpdateNotifications' })
export class ReqBulkUpdateNotificationsDto {
	@ApiProperty({ description: 'Bulk update data', type: () => BulkUpdateNotificationsDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Bulk update data is required."}]' })
	@ValidateNested()
	@Type(() => BulkUpdateNotificationsDto)
	data: BulkUpdateNotificationsDto;
}
