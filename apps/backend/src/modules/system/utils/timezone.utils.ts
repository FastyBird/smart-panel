import { ConfigService } from '../../config/services/config.service';
import { SystemConfigModel } from '../models/config.model';
import { SYSTEM_MODULE_NAME } from '../system.constants';

/** One house timezone, shared by scheduling and time-of-day pattern detection. */
export function getConfigTimezone(configService: ConfigService): string {
	try {
		const config = configService.getModuleConfig<SystemConfigModel>(SYSTEM_MODULE_NAME);
		return config.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	}
}
