import type { Domain } from '../../common/components/domain-icon.types';
import { DevicesModuleDeviceCategory } from '../../openapi.constants';

/*
 * The domain a block works with (spec section 7: the host adds `domain-icon`), from the devices its configuration
 * names. A block with devices of one domain shows it; a block with none, or with devices of several, shows none.
 */

const DOMAIN_BY_CATEGORY: Partial<Record<DevicesModuleDeviceCategory, Domain>> = {
	[DevicesModuleDeviceCategory.lighting]: 'lights',
	[DevicesModuleDeviceCategory.thermostat]: 'climate',
	[DevicesModuleDeviceCategory.heating_unit]: 'climate',
	[DevicesModuleDeviceCategory.water_heater]: 'climate',
	[DevicesModuleDeviceCategory.air_conditioner]: 'climate',
	[DevicesModuleDeviceCategory.air_dehumidifier]: 'climate',
	[DevicesModuleDeviceCategory.air_humidifier]: 'climate',
	[DevicesModuleDeviceCategory.air_purifier]: 'climate',
	[DevicesModuleDeviceCategory.fan]: 'climate',
	[DevicesModuleDeviceCategory.window_covering]: 'covers',
	[DevicesModuleDeviceCategory.door]: 'covers',
	[DevicesModuleDeviceCategory.media]: 'media',
	[DevicesModuleDeviceCategory.television]: 'media',
	[DevicesModuleDeviceCategory.speaker]: 'media',
	[DevicesModuleDeviceCategory.av_receiver]: 'media',
	[DevicesModuleDeviceCategory.projector]: 'media',
	[DevicesModuleDeviceCategory.game_console]: 'media',
	[DevicesModuleDeviceCategory.set_top_box]: 'media',
	[DevicesModuleDeviceCategory.streaming_service]: 'media',
	[DevicesModuleDeviceCategory.sensor]: 'sensors',
	[DevicesModuleDeviceCategory.outlet]: 'energy',
	[DevicesModuleDeviceCategory.camera]: 'cameras',
	[DevicesModuleDeviceCategory.doorbell]: 'cameras',
};

export const deviceCategoryDomain = (category: DevicesModuleDeviceCategory | null | undefined): Domain | undefined =>
	category ? DOMAIN_BY_CATEGORY[category] : undefined;

/** Every device a block's configuration names (`device_id`, at any depth: a list of writes names one per row) */
export const configDeviceIds = (config: unknown): string[] => {
	const ids = new Set<string>();

	const visit = (value: unknown): void => {
		if (Array.isArray(value)) {
			value.forEach(visit);
		} else if (value !== null && typeof value === 'object') {
			for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
				if (key === 'device_id' && typeof item === 'string' && item !== '') {
					ids.add(item);
				} else {
					visit(item);
				}
			}
		}
	};

	visit(config);

	return [...ids];
};

/** The one domain of the named devices, given how to find a device's category */
export const configDomain = (
	config: unknown,
	categoryOf: (deviceId: string) => DevicesModuleDeviceCategory | null | undefined
): Domain | undefined => {
	const domains = new Set(configDeviceIds(config).map((id) => deviceCategoryDomain(categoryOf(id))));

	if (domains.size !== 1) {
		return undefined;
	}

	return [...domains][0];
};
