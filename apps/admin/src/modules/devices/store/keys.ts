import type { StoreInjectionKey } from '../../../common';

import type { IChannelsControlsStoreActions, IChannelsControlsStoreState } from './channels.controls.store.types';
import type { IChannelsPropertiesStoreActions, IChannelsPropertiesStoreState } from './channels.properties.store.types';
import type { IChannelsStoreActions, IChannelsStoreState } from './channels.store.types';
import type { IDevicesControlsStoreActions, IDevicesControlsStoreState } from './devices.controls.store.types';
import type { IDevicesStoreActions, IDevicesStoreState } from './devices.store.types';

export const devicesStoreKey: StoreInjectionKey<string, IDevicesStoreState, object, IDevicesStoreActions> = Symbol('FB-Module-Devices-DevicesStore');

export const devicesControlsStoreKey: StoreInjectionKey<string, IDevicesControlsStoreState, object, IDevicesControlsStoreActions> = Symbol(
	'FB-Module-Devices-DevicesControlsStore'
);

export const channelsStoreKey: StoreInjectionKey<string, IChannelsStoreState, object, IChannelsStoreActions> =
	Symbol('FB-Module-Devices-ChannelsStore');

export const channelsControlsStoreKey: StoreInjectionKey<string, IChannelsControlsStoreState, object, IChannelsControlsStoreActions> = Symbol(
	'FB-Module-Devices-ChannelsControlsStore'
);

export const channelsPropertiesStoreKey: StoreInjectionKey<string, IChannelsPropertiesStoreState, object, IChannelsPropertiesStoreActions> = Symbol(
	'FB-Module-Devices-ChannelsPropertiesStore'
);
