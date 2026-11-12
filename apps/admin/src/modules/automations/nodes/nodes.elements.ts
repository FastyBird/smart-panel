/*
 * The admin elements of the cards the automations module provides (ADR 0003, decision 13), registered
 * with the module the way a plugin registers the elements of its cards.
 */
import type { IModuleElement } from '../../../common';
import { AUTOMATIONS_MODULE_NAME } from '../automations.constants';
import type { IAutomationNodePluginsComponents, IAutomationNodePluginsSchemas } from '../automations.types';
import AutomationDelayForm from '../components/nodes/automation-delay-form.vue';
import AutomationDevicePropertyChangedForm from '../components/nodes/automation-device-property-changed-form.vue';
import AutomationDevicePropertyCompareForm from '../components/nodes/automation-device-property-compare-form.vue';
import AutomationDevicePropertySetForm from '../components/nodes/automation-device-property-set-form.vue';
import AutomationManualStartForm from '../components/nodes/automation-manual-start-form.vue';
import AutomationNodeSummary from '../components/nodes/automation-node-summary.vue';
import AutomationNotificationSendForm from '../components/nodes/automation-notification-send-form.vue';
import AutomationSceneRunForm from '../components/nodes/automation-scene-run-form.vue';
import AutomationTimeOfDayForm from '../components/nodes/automation-time-of-day-form.vue';
import AutomationTimeWindowForm from '../components/nodes/automation-time-window-form.vue';

import { AutomationBuiltInNodeType } from './nodes.constants';
import { AUTOMATION_BUILT_IN_CONFIG_SCHEMAS } from './nodes.schemas';

type AutomationNodeForm = NonNullable<IAutomationNodePluginsComponents['automationNodeForm']>;

const FORMS: Record<AutomationBuiltInNodeType, AutomationNodeForm> = {
	[AutomationBuiltInNodeType.DEVICE_PROPERTY_CHANGED]: AutomationDevicePropertyChangedForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.DEVICE_PROPERTY_COMPARE]: AutomationDevicePropertyCompareForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.DEVICE_PROPERTY_SET]: AutomationDevicePropertySetForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.MANUAL_START]: AutomationManualStartForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.NOTIFICATION_SEND]: AutomationNotificationSendForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.SCENE_RUN]: AutomationSceneRunForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.TIME_OF_DAY]: AutomationTimeOfDayForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.TIME_WINDOW]: AutomationTimeWindowForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.FLOW_DELAY]: AutomationDelayForm as AutomationNodeForm,
};

export const AUTOMATION_BUILT_IN_NODE_ELEMENTS: IModuleElement<IAutomationNodePluginsComponents, IAutomationNodePluginsSchemas>[] = (
	Object.keys(FORMS) as AutomationBuiltInNodeType[]
).map((type) => ({
	type,
	components: {
		automationNodeForm: FORMS[type],
		automationNodeCard: AutomationNodeSummary as NonNullable<IAutomationNodePluginsComponents['automationNodeCard']>,
	},
	schemas: {
		automationNodeConfigSchema: AUTOMATION_BUILT_IN_CONFIG_SCHEMAS[type],
	},
	modules: [AUTOMATIONS_MODULE_NAME],
}));
