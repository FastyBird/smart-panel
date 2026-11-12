import type { StoreInjectionKey } from '../../../common';

import type { IAutomationsStoreActions, IAutomationsStoreState } from './automations.store.types';
import type { IAutomationNodeTypesStoreActions, IAutomationNodeTypesStoreState } from './node-types.store.types';

export const automationsStoreKey: StoreInjectionKey<string, IAutomationsStoreState, object, IAutomationsStoreActions> = Symbol(
	'FB-Module-Automations-AutomationsStore'
);

export const automationNodeTypesStoreKey: StoreInjectionKey<string, IAutomationNodeTypesStoreState, object, IAutomationNodeTypesStoreActions> =
	Symbol('FB-Module-Automations-NodeTypesStore');
