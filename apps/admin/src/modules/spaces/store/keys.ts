import type { InjectionKey, Ref } from 'vue';

import type { StoreInjectionKey } from '../../../common';

import type { ISpacesStoreActions, ISpacesStoreState } from './spaces.store.types';

export const spacesStoreKey: StoreInjectionKey<string, ISpacesStoreState, object, ISpacesStoreActions> = Symbol(
	'FB-Module-Spaces-SpacesStore'
);

export interface ISpacesRefreshSignals {
	climate: Ref<number>;
	lighting: Ref<number>;
	climateState: Ref<number>;
	lightingState: Ref<number>;
}

export const spacesRefreshSignalsKey: InjectionKey<ISpacesRefreshSignals> = Symbol('FB-Module-Spaces-RefreshSignals');
