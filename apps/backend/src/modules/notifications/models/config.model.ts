import { Expose } from 'class-transformer';
import { IsBoolean, IsInt, IsString, Max, Min } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import {
	DEFAULT_MAX_NOTIFICATIONS,
	DEFAULT_RETENTION_DAYS,
	MAX_NOTIFICATIONS_MAX,
	MAX_NOTIFICATIONS_MIN,
	NOTIFICATIONS_MODULE_NAME,
	RETENTION_DAYS_MAX,
	RETENTION_DAYS_MIN,
} from '../notifications.constants';

@ApiSchema({ name: 'NotificationsModuleDataConfig' })
export class NotificationsConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'notifications-module',
	})
	@Expose()
	@IsString()
	type: string = NOTIFICATIONS_MODULE_NAME;

	@ApiProperty({
		description: 'Module enabled state',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	override enabled: boolean = true;

	@ApiProperty({
		name: 'retention_days',
		description: 'How long dismissed and resolved notifications are kept, in days.',
		type: 'integer',
		minimum: RETENTION_DAYS_MIN,
		maximum: RETENTION_DAYS_MAX,
		example: DEFAULT_RETENTION_DAYS,
	})
	@Expose({ name: 'retention_days' })
	@IsInt()
	@Min(RETENTION_DAYS_MIN)
	@Max(RETENTION_DAYS_MAX)
	retentionDays: number = DEFAULT_RETENTION_DAYS;

	@ApiProperty({
		name: 'max_notifications',
		description: 'Upper bound on active event notifications. Issues are never evicted by this cap.',
		type: 'integer',
		minimum: MAX_NOTIFICATIONS_MIN,
		maximum: MAX_NOTIFICATIONS_MAX,
		example: DEFAULT_MAX_NOTIFICATIONS,
	})
	@Expose({ name: 'max_notifications' })
	@IsInt()
	@Min(MAX_NOTIFICATIONS_MIN)
	@Max(MAX_NOTIFICATIONS_MAX)
	maxNotifications: number = DEFAULT_MAX_NOTIFICATIONS;
}
