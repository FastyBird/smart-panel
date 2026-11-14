/*
 * The admin elements of the space cards (design § Editor, "Plugin forms"): the form, the summary and the
 * schema of each card the plugin brings to the automations editor. Every card has a form of its own.
 */
import type { IPluginElement } from '../../../common';
import { AUTOMATIONS_MODULE_NAME } from '../../../modules/automations/automations.constants';
import type { IAutomationNodePluginsComponents, IAutomationNodePluginsSchemas } from '../../../modules/automations/automations.types';
import SpaceAutomationNodeSummary from '../components/automations/space-automation-node-summary.vue';
import SpaceLightingIntentForm from '../components/automations/space-lighting-intent-form.vue';
import SpaceModeForm from '../components/automations/space-mode-form.vue';
import SpaceOccupancyForm from '../components/automations/space-occupancy-form.vue';

import { SpaceAutomationNodeType } from './space-automations.constants';
import { SPACE_AUTOMATION_CONFIG_SCHEMAS } from './space-automations.schemas';

type AutomationNodeForm = NonNullable<IAutomationNodePluginsComponents['automationNodeForm']>;

const FORMS: Record<SpaceAutomationNodeType, AutomationNodeForm> = {
	[SpaceAutomationNodeType.OCCUPANCY_CHANGED]: SpaceOccupancyForm as AutomationNodeForm,
	[SpaceAutomationNodeType.OCCUPANCY_IS]: SpaceOccupancyForm as AutomationNodeForm,
	[SpaceAutomationNodeType.MODE_CHANGED]: SpaceModeForm as AutomationNodeForm,
	[SpaceAutomationNodeType.MODE_IS]: SpaceModeForm as AutomationNodeForm,
	[SpaceAutomationNodeType.MODE_SET]: SpaceModeForm as AutomationNodeForm,
	[SpaceAutomationNodeType.LIGHTING_INTENT]: SpaceLightingIntentForm as AutomationNodeForm,
};

export const SPACE_AUTOMATION_NODE_ELEMENTS: IPluginElement<IAutomationNodePluginsComponents, IAutomationNodePluginsSchemas>[] = (
	Object.keys(FORMS) as SpaceAutomationNodeType[]
).map((type) => ({
	type,
	components: {
		automationNodeForm: FORMS[type],
		automationNodeCard: SpaceAutomationNodeSummary as NonNullable<IAutomationNodePluginsComponents['automationNodeCard']>,
	},
	schemas: {
		automationNodeConfigSchema: SPACE_AUTOMATION_CONFIG_SCHEMAS[type],
	},
	// Found by the automations editor only; the spaces module does not take them for space types
	modules: [AUTOMATIONS_MODULE_NAME],
}));
