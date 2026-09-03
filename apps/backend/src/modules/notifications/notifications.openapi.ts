/**
 * OpenAPI extra models for Notifications module
 */
import { UpdateNotificationsConfigDto } from './dto/update-config.dto';
import { NotificationEntity } from './entities/notifications.entity';
import { NotificationsConfigModel } from './models/config.model';
import { NotificationActionModel } from './models/notification-action.model';

export const NOTIFICATIONS_SWAGGER_EXTRA_MODELS = [
	// Module configuration
	NotificationsConfigModel,
	UpdateNotificationsConfigDto,
	// Data models
	NotificationActionModel,
	NotificationEntity,
];
