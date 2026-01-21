import type { InjectionKey, Ref } from 'vue';

import type { StoreInjectionKey } from '../../../common';

import type { ISpacesStoreActions, ISpacesStoreState } from './spaces.store.types';

export const spacesStoreKey: StoreInjectionKey<string, ISpacesStoreState, object, ISpacesStoreActions> = Symbol(
	'FB-Module-Spaces-SpacesStore'
);

export interface ISpacesRefreshSignals {
	climate: Ref<number>;
	lighting: Ref<number>;
	media: Ref<number>;
	covers: Ref<number>;
	sensor: Ref<number>;
	climateState: Ref<number>;
	lightingState: Ref<number>;
	mediaState: Ref<number>;
	coversState: Ref<number>;
	sensorState: Ref<number>;
}

export const spacesRefreshSignalsKey: InjectionKey<ISpacesRefreshSignals> = Symbol('FB-Module-Spaces-RefreshSignals');
