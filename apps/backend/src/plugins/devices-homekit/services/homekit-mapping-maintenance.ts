import { DEVICES_HOMEKIT_PLUGIN_NAME } from '../devices-homekit.constants';
import { HomeKitUpdatePluginConfigDto } from '../dto/update-config.dto';

export interface MappingMaintenance {
	removeDeviceIds?: string[];
	rebuildDeviceIds?: string[];
	reconcile?: boolean;
}

// Internal requests use the normal serialized config mutation path. WeakMap metadata
// cannot be submitted through the API or persisted as plugin configuration.
const requests = new WeakMap<HomeKitUpdatePluginConfigDto, MappingMaintenance>();

export function createMappingMaintenance(request: MappingMaintenance): HomeKitUpdatePluginConfigDto {
	const update = new HomeKitUpdatePluginConfigDto();
	update.type = DEVICES_HOMEKIT_PLUGIN_NAME;
	requests.set(update, request);
	return update;
}

export function getMappingMaintenance(update: HomeKitUpdatePluginConfigDto): MappingMaintenance | undefined {
	return requests.get(update);
}
