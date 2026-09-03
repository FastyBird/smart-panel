import { UpdateNotificationsWebhookConfigDto } from './dto/update-config.dto';
import { NotificationsWebhookConfigModel } from './models/config.model';

export const NOTIFICATIONS_WEBHOOK_PLUGIN_SWAGGER_EXTRA_MODELS = [
	NotificationsWebhookConfigModel,
	UpdateNotificationsWebhookConfigDto,
];
