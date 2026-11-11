import type { StoreInjectionKey } from '../../../common';

import type { IAutomationsStoreActions, IAutomationsStoreState } from './automations.store.types';

export const automationsStoreKey: StoreInjectionKey<string, IAutomationsStoreState, object, IAutomationsStoreActions> = Symbol(
	'FB-Module-Automations-AutomationsStore'
);
