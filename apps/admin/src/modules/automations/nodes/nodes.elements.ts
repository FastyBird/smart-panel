/*
 * The admin elements of the cards the automations module provides (ADR 0003, decision 13), registered
 * with the module the way a plugin registers the elements of its cards.
 *
 * Every card has a form of its own, or is listed here as one the generic form serves on purpose: a card
 * with nothing to configure, whose description in the panel already says what it does. The form, the
 * schema and the summary are kept by node type, so a card added to `AutomationBuiltInNodeType` without
 * them does not compile, and the catalogue test lists the cards the backend knows.
 */
import type { IModuleElement } from '../../../common';
import { AUTOMATIONS_MODULE_NAME } from '../automations.constants';
import type { IAutomationNodePluginsComponents, IAutomationNodePluginsSchemas } from '../automations.types';
import AutomationNodeGenericForm from '../components/canvas/automation-node-generic-form.vue';
import AutomationAutomationTargetForm from '../components/nodes/automation-automation-target-form.vue';
import AutomationDelayForm from '../components/nodes/automation-delay-form.vue';
import AutomationDeviceButtonPressedForm from '../components/nodes/automation-device-button-pressed-form.vue';
import AutomationDeviceConnectionChangedForm from '../components/nodes/automation-device-connection-changed-form.vue';
import AutomationDevicePropertyChangedForm from '../components/nodes/automation-device-property-changed-form.vue';
import AutomationDevicePropertyCompareForm from '../components/nodes/automation-device-property-compare-form.vue';
import AutomationDevicePropertySetForm from '../components/nodes/automation-device-property-set-form.vue';
import AutomationHouseModeChangedForm from '../components/nodes/automation-house-mode-changed-form.vue';
import AutomationHouseModeIsForm from '../components/nodes/automation-house-mode-is-form.vue';
import AutomationHouseModeSetForm from '../components/nodes/automation-house-mode-set-form.vue';
import AutomationManualStartForm from '../components/nodes/automation-manual-start-form.vue';
import AutomationNodeSummary from '../components/nodes/automation-node-summary.vue';
import AutomationNotificationSendForm from '../components/nodes/automation-notification-send-form.vue';
import AutomationSceneRunForm from '../components/nodes/automation-scene-run-form.vue';
import AutomationSceneWasRunForm from '../components/nodes/automation-scene-was-run-form.vue';
import AutomationSecurityArmForm from '../components/nodes/automation-security-arm-form.vue';
import AutomationSecurityArmedIsForm from '../components/nodes/automation-security-armed-is-form.vue';
import AutomationSecurityStateChangedForm from '../components/nodes/automation-security-state-changed-form.vue';
import AutomationSunDaylightForm from '../components/nodes/automation-sun-daylight-form.vue';
import AutomationSunEventForm from '../components/nodes/automation-sun-event-form.vue';
import AutomationTimeOfDayForm from '../components/nodes/automation-time-of-day-form.vue';
import AutomationTimeWindowForm from '../components/nodes/automation-time-window-form.vue';
import AutomationWaitUntilForm from '../components/nodes/automation-wait-until-form.vue';

import { AutomationBuiltInNodeType } from './nodes.constants';
import { AUTOMATION_BUILT_IN_CONFIG_SCHEMAS } from './nodes.schemas';

type AutomationNodeForm = NonNullable<IAutomationNodePluginsComponents['automationNodeForm']>;

// A card the generic form serves on purpose, rather than for want of a form of its own
const GENERIC = 'generic';

const FORMS: Record<AutomationBuiltInNodeType, AutomationNodeForm | typeof GENERIC> = {
	[AutomationBuiltInNodeType.DEVICE_PROPERTY_CHANGED]: AutomationDevicePropertyChangedForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.DEVICE_PROPERTY_COMPARE]: AutomationDevicePropertyCompareForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.DEVICE_PROPERTY_SET]: AutomationDevicePropertySetForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.MANUAL_START]: AutomationManualStartForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.NOTIFICATION_SEND]: AutomationNotificationSendForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.SCENE_RUN]: AutomationSceneRunForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.TIME_OF_DAY]: AutomationTimeOfDayForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.TIME_WINDOW]: AutomationTimeWindowForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.FLOW_DELAY]: AutomationDelayForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.FLOW_WAIT_UNTIL]: AutomationWaitUntilForm as AutomationNodeForm,
	// A join only waits for the first or for every branch leading to it: nothing to configure
	[AutomationBuiltInNodeType.FLOW_ANY]: GENERIC,
	[AutomationBuiltInNodeType.FLOW_ALL]: GENERIC,
	[AutomationBuiltInNodeType.SUN_EVENT]: AutomationSunEventForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.SUN_DAYLIGHT]: AutomationSunDaylightForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.DEVICE_BUTTON_PRESSED]: AutomationDeviceButtonPressedForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.DEVICE_CONNECTION_CHANGED]: AutomationDeviceConnectionChangedForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.SCENE_WAS_RUN]: AutomationSceneWasRunForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.HOUSE_MODE_CHANGED]: AutomationHouseModeChangedForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.HOUSE_MODE_IS]: AutomationHouseModeIsForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.HOUSE_MODE_SET]: AutomationHouseModeSetForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.SECURITY_STATE_CHANGED]: AutomationSecurityStateChangedForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.SECURITY_ARMED_IS]: AutomationSecurityArmedIsForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.SECURITY_ARM]: AutomationSecurityArmForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.AUTOMATION_ENABLE]: AutomationAutomationTargetForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.AUTOMATION_DISABLE]: AutomationAutomationTargetForm as AutomationNodeForm,
	[AutomationBuiltInNodeType.AUTOMATION_RUN]: AutomationAutomationTargetForm as AutomationNodeForm,
};

/**
 * The built-in cards the generic form serves on purpose. A card in no list - without an element, or
 * with an element that brings no form - falls back to it by accident; the catalogue test refuses that.
 */
export const AUTOMATION_GENERIC_FORM_NODE_TYPES: AutomationBuiltInNodeType[] = (Object.keys(FORMS) as AutomationBuiltInNodeType[]).filter(
	(type) => FORMS[type] === GENERIC
);

export const AUTOMATION_BUILT_IN_NODE_ELEMENTS: IModuleElement<IAutomationNodePluginsComponents, IAutomationNodePluginsSchemas>[] = (
	Object.keys(FORMS) as AutomationBuiltInNodeType[]
).map((type) => {
	const form = FORMS[type];

	return {
		type,
		components: {
			automationNodeForm: form === GENERIC ? (AutomationNodeGenericForm as AutomationNodeForm) : form,
			automationNodeCard: AutomationNodeSummary as NonNullable<IAutomationNodePluginsComponents['automationNodeCard']>,
		},
		schemas: {
			automationNodeConfigSchema: AUTOMATION_BUILT_IN_CONFIG_SCHEMAS[type],
		},
		modules: [AUTOMATIONS_MODULE_NAME],
	};
});
