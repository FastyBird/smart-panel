import type { StoreInjectionKey } from '../../../common';

import type { IChannelsControlsStoreActions, IChannelsControlsStoreState } from './channels.controls.store.types';
import type { IChannelsPropertiesStoreActions, IChannelsPropertiesStoreState } from './channels.properties.store.types';
import type { IChannelsStoreActions, IChannelsStoreState } from './channels.store.types';
import type { IDevicesControlsStoreActions, IDevicesControlsStoreState } from './devices.controls.store.types';
import type { IDevicesStoreActions, IDevicesStoreState } from './devices.store.types';

export { registerDevicesStore } from './devices.store';
export { registerDevicesControlsStore } from './devices.controls.store';
export { registerChannelsStore } from './channels.store';
export { registerChannelsControlsStore } from './channels.controls.store';
export { registerChannelsPropertiesStore } from './channels.properties.store';

export * from './devices.store.types';
export * from './devices.controls.store.types';
export * from './channels.store.types';
export * from './channels.controls.store.types';
export * from './channels.properties.store.types';

export const devicesStoreKey: StoreInjectionKey<string, IDevicesStoreState, object, IDevicesStoreActions> = Symbol('FB-DevicesModuleDevicesStore');

export const devicesControlsStoreKey: StoreInjectionKey<string, IDevicesControlsStoreState, object, IDevicesControlsStoreActions> = Symbol(
	'FB-DevicesModuleDevicesControlsStore'
);

export const channelsStoreKey: StoreInjectionKey<string, IChannelsStoreState, object, IChannelsStoreActions> =
	Symbol('FB-DevicesModuleChannelsStore');

export const channelsControlsStoreKey: StoreInjectionKey<string, IChannelsControlsStoreState, object, IChannelsControlsStoreActions> = Symbol(
	'FB-DevicesModuleChannelsControlsStore'
);

export const channelsPropertiesStoreKey: StoreInjectionKey<string, IChannelsPropertiesStoreState, object, IChannelsPropertiesStoreActions> = Symbol(
	'FB-DevicesModuleChannelsPropertiesStore'
);

export * from './devices.transformers';
export * from './devices.controls.transformers';
export * from './channels.transformers';
export * from './channels.controls.transformers';
export * from './channels.properties.transformers';
