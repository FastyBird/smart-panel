import { UpdateNotificationsSlackConfigDto } from './dto/update-config.dto';
import { NotificationsSlackConfigModel } from './models/config.model';

export const NOTIFICATIONS_SLACK_PLUGIN_SWAGGER_EXTRA_MODELS = [
	NotificationsSlackConfigModel,
	UpdateNotificationsSlackConfigDto,
];
