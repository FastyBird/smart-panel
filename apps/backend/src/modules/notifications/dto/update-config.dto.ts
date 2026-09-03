import { Expose } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import {
	DEFAULT_MAX_NOTIFICATIONS,
	DEFAULT_RETENTION_DAYS,
	MAX_NOTIFICATIONS_MAX,
	MAX_NOTIFICATIONS_MIN,
	NOTIFICATIONS_MODULE_NAME,
	RETENTION_DAYS_MAX,
	RETENTION_DAYS_MIN,
} from '../notifications.constants';

@ApiSchema({ name: 'NotificationsModuleUpdateConfig' })
export class UpdateNotificationsConfigDto extends UpdateModuleConfigDto {
	override enabled = true;

	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'notifications-module',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = NOTIFICATIONS_MODULE_NAME;

	@ApiPropertyOptional({
		name: 'retention_days',
		description: 'How long dismissed and resolved notifications are kept, in days.',
		type: 'integer',
		minimum: RETENTION_DAYS_MIN,
		maximum: RETENTION_DAYS_MAX,
		example: DEFAULT_RETENTION_DAYS,
	})
	@Expose({ name: 'retention_days' })
	@IsOptional()
	@IsInt({ message: '[{"field":"retention_days","reason":"Retention days must be a valid integer."}]' })
	@Min(RETENTION_DAYS_MIN, {
		message: `[{"field":"retention_days","reason":"Retention days must be at least ${RETENTION_DAYS_MIN}."}]`,
	})
	@Max(RETENTION_DAYS_MAX, {
		message: `[{"field":"retention_days","reason":"Retention days must be at most ${RETENTION_DAYS_MAX}."}]`,
	})
	retention_days?: number;

	@ApiPropertyOptional({
		name: 'max_notifications',
		description: 'Upper bound on active event notifications. Issues are never evicted by this cap.',
		type: 'integer',
		minimum: MAX_NOTIFICATIONS_MIN,
		maximum: MAX_NOTIFICATIONS_MAX,
		example: DEFAULT_MAX_NOTIFICATIONS,
	})
	@Expose({ name: 'max_notifications' })
	@IsOptional()
	@IsInt({ message: '[{"field":"max_notifications","reason":"Max notifications must be a valid integer."}]' })
	@Min(MAX_NOTIFICATIONS_MIN, {
		message: `[{"field":"max_notifications","reason":"Max notifications must be at least ${MAX_NOTIFICATIONS_MIN}."}]`,
	})
	@Max(MAX_NOTIFICATIONS_MAX, {
		message: `[{"field":"max_notifications","reason":"Max notifications must be at most ${MAX_NOTIFICATIONS_MAX}."}]`,
	})
	max_notifications?: number;
}
