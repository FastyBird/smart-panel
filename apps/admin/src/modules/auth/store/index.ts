import type { StoreInjectionKey } from '../../../common';

import type { ISessionStoreActions, ISessionStoreState } from './session.store.types';

export { registerSessionStore } from './session.store';
export * from './session.store.types';

export const sessionStoreKey: StoreInjectionKey<string, ISessionStoreState, object, ISessionStoreActions> = Symbol('FB-AuthModuleSessionStore');
