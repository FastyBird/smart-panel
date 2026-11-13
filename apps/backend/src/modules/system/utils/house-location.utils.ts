import { ConfigService } from '../../config/services/config.service';
import { SystemConfigModel } from '../models/config.model';
import { SYSTEM_MODULE_NAME } from '../system.constants';

export interface HouseLocation {
	/** Degrees, north positive */
	latitude: number;
	/** Degrees, east positive */
	longitude: number;
}

const isCoordinate = (value: unknown, limit: number): value is number =>
	typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;

/**
 * The house location of the system configuration, or null while it is not set. A location counts only
 * when both coordinates are set and in range: one coordinate alone is not a place.
 */
export function getConfigHouseLocation(configService: ConfigService): HouseLocation | null {
	const config = configService.getModuleConfig<SystemConfigModel>(SYSTEM_MODULE_NAME);
	const { latitude, longitude } = config;

	return isCoordinate(latitude, 90) && isCoordinate(longitude, 180) ? { latitude, longitude } : null;
}
