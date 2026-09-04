import { UpdateNotificationsTelegramConfigDto } from './dto/update-config.dto';
import { NotificationsTelegramConfigModel } from './models/config.model';

export const NOTIFICATIONS_TELEGRAM_PLUGIN_SWAGGER_EXTRA_MODELS = [
	NotificationsTelegramConfigModel,
	UpdateNotificationsTelegramConfigDto,
];
