import type { StoreInjectionKey } from '../../../common';

import type { IIntentsStoreActions, IIntentsStoreState } from './intents.store.types';

export const intentsStoreKey: StoreInjectionKey<string, IIntentsStoreState, object, IIntentsStoreActions> = Symbol('FB-Module-Intents-IntentsStore');
