import type { StoreInjectionKey } from '../../../common';

import type { IAutomationsStoreActions, IAutomationsStoreState } from './automations.store.types';
import type { IAutomationNodeTypesStoreActions, IAutomationNodeTypesStoreState } from './node-types.store.types';
import type { IAutomationRunsStoreActions, IAutomationRunsStoreState } from './runs.store.types';

export const automationsStoreKey: StoreInjectionKey<string, IAutomationsStoreState, object, IAutomationsStoreActions> = Symbol(
	'FB-Module-Automations-AutomationsStore'
);

export const automationNodeTypesStoreKey: StoreInjectionKey<string, IAutomationNodeTypesStoreState, object, IAutomationNodeTypesStoreActions> =
	Symbol('FB-Module-Automations-NodeTypesStore');

export const automationRunsStoreKey: StoreInjectionKey<string, IAutomationRunsStoreState, object, IAutomationRunsStoreActions> =
	Symbol('FB-Module-Automations-RunsStore');
