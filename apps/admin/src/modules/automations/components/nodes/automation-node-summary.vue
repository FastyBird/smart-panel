<template>
	<span
		:title="summary"
		data-test-id="built-in-summary"
	>
		{{ summary }}
	</span>
</template>

<script setup lang="ts">
/*
 * The summary of a built-in card (`automationNodeCard`): what it is set to do, with the names of the
 * devices, scenes and automations it points at.
 */
import { computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';

import { useAutomationNodeLookups } from '../../composables/useAutomationNodeLookups';
import { AutomationBuiltInNodeType } from '../../nodes/nodes.constants';
import { summarizeBuiltInNode } from '../../nodes/nodes.summaries';
import type { IAutomationNodeSummaryProps } from '../canvas/automation-node-form.types';

defineOptions({
	name: 'AutomationNodeSummary',
});

const props = defineProps<IAutomationNodeSummaryProps>();

const { t } = useI18n();

const lookups = useAutomationNodeLookups();

const DEVICE_TYPES: string[] = [
	AutomationBuiltInNodeType.DEVICE_PROPERTY_CHANGED,
	AutomationBuiltInNodeType.DEVICE_PROPERTY_COMPARE,
	AutomationBuiltInNodeType.DEVICE_PROPERTY_SET,
	AutomationBuiltInNodeType.DEVICE_BUTTON_PRESSED,
	AutomationBuiltInNodeType.DEVICE_CONNECTION_CHANGED,
	AutomationBuiltInNodeType.FLOW_WAIT_UNTIL,
	AutomationBuiltInNodeType.SECURITY_ARM,
];

const SCENE_TYPES: string[] = [AutomationBuiltInNodeType.SCENE_RUN, AutomationBuiltInNodeType.SCENE_WAS_RUN];

const AUTOMATION_TYPES: string[] = [
	AutomationBuiltInNodeType.AUTOMATION_ENABLE,
	AutomationBuiltInNodeType.AUTOMATION_DISABLE,
	AutomationBuiltInNodeType.AUTOMATION_RUN,
];

const summary = computed<string>(
	(): string =>
		summarizeBuiltInNode(props.nodeType.type, props.config, { t: (key, params) => (params ? t(key, params) : t(key)), lookups }) ??
		t('automations.editor.texts.notConfigured')
);

onBeforeMount((): void => {
	if (DEVICE_TYPES.includes(props.nodeType.type)) {
		void lookups.ensureDevices();
	} else if (SCENE_TYPES.includes(props.nodeType.type)) {
		void lookups.ensureScenes();
	} else if (AUTOMATION_TYPES.includes(props.nodeType.type)) {
		void lookups.ensureAutomations();
	}
});
</script>
