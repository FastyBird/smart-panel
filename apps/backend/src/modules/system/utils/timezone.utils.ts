import { ConfigService } from '../../config/services/config.service';
import { SystemConfigModel } from '../models/config.model';
import { SYSTEM_MODULE_NAME } from '../system.constants';

/** Resolve the house timezone; an unreadable configuration must never change scheduling time. */
export function getConfigTimezone(configService: ConfigService): string {
	const config = configService.getModuleConfig<SystemConfigModel>(SYSTEM_MODULE_NAME);
	return config.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}
