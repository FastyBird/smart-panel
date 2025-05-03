import type { StoreInjectionKey } from '../../../common';

import type {
	IHomeAssistantDiscoveredDevicesStoreActions,
	IHomeAssistantDiscoveredDevicesStoreState,
} from './home-assistant-discovered-devices.store.types';
import type { IHomeAssistantStatesStoreActions, IHomeAssistantStatesStoreState } from './home-assistant-states.store.types';

export const discoveredDevicesStoreKey: StoreInjectionKey<
	string,
	IHomeAssistantDiscoveredDevicesStoreState,
	object,
	IHomeAssistantDiscoveredDevicesStoreActions
> = Symbol('FB-Plugin-Devices-Home-Assistant-Discovered-Devices');

export const statesStoreKey: StoreInjectionKey<string, IHomeAssistantStatesStoreState, object, IHomeAssistantStatesStoreActions> = Symbol(
	'FB-Plugin-Devices-Home-Assistant-States'
);
