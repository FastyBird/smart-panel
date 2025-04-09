import type { StoreInjectionKey } from '../../../common';

import type { IChannelsControlsStoreActions, IChannelsControlsStoreState } from './channels.controls.store.types';
import type { IChannelsPropertiesStoreActions, IChannelsPropertiesStoreState } from './channels.properties.store.types';
import type { IChannelsStoreActions, IChannelsStoreState } from './channels.store.types';
import type { IDevicesControlsStoreActions, IDevicesControlsStoreState } from './devices.controls.store.types';
import type { IDevicesStoreActions, IDevicesStoreState } from './devices.store.types';

export const devicesStoreKey: StoreInjectionKey<string, IDevicesStoreState, object, IDevicesStoreActions> =
	Symbol('FB-Module-DevicesModuleDevicesStore');

export const devicesControlsStoreKey: StoreInjectionKey<string, IDevicesControlsStoreState, object, IDevicesControlsStoreActions> = Symbol(
	'FB-Module-DevicesModuleDevicesControlsStore'
);

export const channelsStoreKey: StoreInjectionKey<string, IChannelsStoreState, object, IChannelsStoreActions> = Symbol(
	'FB-Module-DevicesModuleChannelsStore'
);

export const channelsControlsStoreKey: StoreInjectionKey<string, IChannelsControlsStoreState, object, IChannelsControlsStoreActions> = Symbol(
	'FB-Module-DevicesModuleChannelsControlsStore'
);

export const channelsPropertiesStoreKey: StoreInjectionKey<string, IChannelsPropertiesStoreState, object, IChannelsPropertiesStoreActions> = Symbol(
	'FB-Module-DevicesModuleChannelsPropertiesStore'
);
