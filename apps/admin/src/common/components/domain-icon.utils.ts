import { DevicesModuleDeviceCategory } from '../../openapi.constants';

import type { Domain } from './domain-icon.types';

// The domain of a device category, for the `domain-icon` a host draws beside a device (spec section 7)
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
