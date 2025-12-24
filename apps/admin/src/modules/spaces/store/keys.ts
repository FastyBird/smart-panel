import type { InjectionKey } from 'vue';

import type { ISpacesStore } from './spaces.store.types';

export const spacesStoreKey: InjectionKey<ISpacesStore> = Symbol('spacesStore');
