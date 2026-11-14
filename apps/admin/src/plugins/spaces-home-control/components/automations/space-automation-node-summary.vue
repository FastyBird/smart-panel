<template>
	<span
		:title="summary"
		data-test-id="space-automation-summary"
	>
		{{ summary }}
	</span>
</template>

<script setup lang="ts">
/*
 * The summary of a space card (`automationNodeCard`): what it is set to do, with the name of the room or
 * zone it points at.
 */
import { computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';

import type { IAutomationNodeSummaryProps } from '../../../../modules/automations/components/canvas/automation-node-form.types';
import { useSpaces } from '../../../../modules/spaces/composables/useSpaces';
import { summarizeSpaceNode } from '../../automations/space-automations.summaries';

defineOptions({
	name: 'SpaceAutomationNodeSummary',
});

const props = defineProps<IAutomationNodeSummaryProps>();

const { t } = useI18n();

const { findById, fetching, firstLoadFinished, fetchSpaces } = useSpaces();

const summary = computed<string>(
	(): string =>
		summarizeSpaceNode(props.nodeType.type, props.config, {
			t: (key, params) => (params ? t(key, params) : t(key)),
			spaceName: (id) => findById(id)?.name ?? null,
		}) ?? t('automations.editor.texts.notConfigured')
);

onBeforeMount((): void => {
	if (!firstLoadFinished.value && !fetching.value) {
		// A failed read only leaves the name of the space unknown
		fetchSpaces().catch((): void => undefined);
	}
});
</script>
