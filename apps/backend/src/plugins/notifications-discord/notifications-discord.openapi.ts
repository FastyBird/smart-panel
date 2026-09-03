import { UpdateNotificationsDiscordConfigDto } from './dto/update-config.dto';
import { NotificationsDiscordConfigModel } from './models/config.model';

export const NOTIFICATIONS_DISCORD_PLUGIN_SWAGGER_EXTRA_MODELS = [
	NotificationsDiscordConfigModel,
	UpdateNotificationsDiscordConfigDto,
];
