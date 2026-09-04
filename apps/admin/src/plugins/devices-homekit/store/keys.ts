import type { InjectionKey } from 'vue';

import type { useHomeKitBridge } from './homekit-bridge.store';

export const homeKitBridgeStoreKey: InjectionKey<ReturnType<typeof useHomeKitBridge>> = Symbol(
	'devices_homekit_plugin-bridge'
);
