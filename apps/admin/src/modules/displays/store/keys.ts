import type { InjectionKey } from 'vue';

import type { DisplaysStore } from './displays.store.types';

export const displaysStoreKey: InjectionKey<DisplaysStore> = Symbol('FB-DisplaysStore');
