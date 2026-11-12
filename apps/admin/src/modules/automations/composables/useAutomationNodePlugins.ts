import { type Component, computed } from 'vue';

import type { ZodType } from 'zod';

import { injectModulesManager, injectPluginsManager } from '../../../common';
import { AUTOMATIONS_MODULE_NAME } from '../automations.constants';
import type { IAutomationNodePluginsComponents, IAutomationNodePluginsSchemas } from '../automations.types';

import type { IAutomationNodeElement as AutomationNodeElement, IUseAutomationNodePlugins } from './types';

const COMPONENT_KEYS: (keyof IAutomationNodePluginsComponents)[] = ['automationNodeForm', 'automationNodeCard'];

const SCHEMA_KEYS: (keyof IAutomationNodePluginsSchemas)[] = ['automationNodeConfigSchema'];

const isEligible = (owner: { modules?: string[] }): boolean => owner.modules === undefined || owner.modules.includes(AUTOMATIONS_MODULE_NAME);

const bringsSomething = (element: AutomationNodeElement): boolean =>
	COMPONENT_KEYS.some((key) => !!element.components && key in element.components) ||
	SCHEMA_KEYS.some((key) => !!element.schemas && key in element.schemas);

// What the element asked first leaves out is taken from the next one: a plugin that brings only a better
// summary for a card of a module keeps the form of the module, and the other way round
const fillIn = (first: AutomationNodeElement, next: AutomationNodeElement): AutomationNodeElement => ({
	...first,
	components: {
		automationNodeForm: first.components?.automationNodeForm ?? next.components?.automationNodeForm,
		automationNodeCard: first.components?.automationNodeCard ?? next.components?.automationNodeCard,
	},
	schemas: {
		automationNodeConfigSchema: first.schemas?.automationNodeConfigSchema ?? next.schemas?.automationNodeConfigSchema,
	},
});

/**
 * The admin elements of the cards (design § Editor, "Plugin forms"), on the pattern of the scene actions:
 * an element whose `type` is a node type brings the form of the card (`automationNodeForm`), the summary
 * shown on it (`automationNodeCard`) and the schema of its configuration (`automationNodeConfigSchema`).
 *
 * Elements come from plugins - the space cards of `spaces-home-control`, a third-party card - and from
 * modules: the automations module registers its own cards (ADR 0003, decision 13). A plugin is asked
 * first, so a plugin can bring a better form or summary for a card of a module; what it does not bring is
 * still the module's. A card without an element gets the generic form and summary; a card of a disabled
 * plugin is not offered by the backend in the first place.
 */
export const useAutomationNodePlugins = (): IUseAutomationNodePlugins => {
	const pluginsManager = injectPluginsManager();
	const modulesManager = injectModulesManager();

	const elements = computed<Map<string, AutomationNodeElement>>((): Map<string, AutomationNodeElement> => {
		const found = new Map<string, AutomationNodeElement>();

		const collect = (owners: { modules?: string[]; elements?: AutomationNodeElement[] }[]): void => {
			for (const owner of owners) {
				if (!isEligible(owner)) {
					continue;
				}

				for (const element of owner.elements ?? []) {
					if (!Array.isArray(element.modules) || !element.modules.includes(AUTOMATIONS_MODULE_NAME) || !bringsSomething(element)) {
						continue;
					}

					const first = found.get(element.type);

					found.set(element.type, first ? fillIn(first, element) : element);
				}
			}
		};

		collect(pluginsManager.getPlugins());
		collect(modulesManager.getModules());

		return found;
	});

	const getElement = (type: string): AutomationNodeElement | undefined => elements.value.get(type);

	const getFormComponent = (type: string): Component | null => getElement(type)?.components?.automationNodeForm ?? null;

	const getCardComponent = (type: string): Component | null => getElement(type)?.components?.automationNodeCard ?? null;

	const getConfigSchema = (type: string): ZodType | null => getElement(type)?.schemas?.automationNodeConfigSchema ?? null;

	return {
		elements,
		getElement,
		getFormComponent,
		getCardComponent,
		getConfigSchema,
	};
};
