import type { InjectionKey } from 'vue';

import type { Store } from 'pinia';

import type {
	IZigbee2mqttDiscoveredDevicesStoreActions,
	IZigbee2mqttDiscoveredDevicesStoreState,
} from './zigbee2mqtt-discovered-devices.store.types';

export const discoveredDevicesStoreKey: InjectionKey<
	Store<string, IZigbee2mqttDiscoveredDevicesStoreState, object, IZigbee2mqttDiscoveredDevicesStoreActions>
> = Symbol('devices_zigbee2mqtt_plugin-discovered_devices');
