import type { StoreInjectionKey } from '../../../common';

import type { ISpacesStoreActions, ISpacesStoreState } from './spaces.store.types';

export const spacesStoreKey: StoreInjectionKey<string, ISpacesStoreState, object, ISpacesStoreActions> = Symbol(
	'FB-Module-Spaces-SpacesStore'
);
