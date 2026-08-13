<template>
	<div
		data-test-id="wizard-inventory-summary"
		class="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs"
		aria-live="polite"
	>
		<el-text
			v-for="item in summary"
			:key="item.key"
			:data-test-id="`wizard-inventory-${item.key}`"
			size="small"
		>
			{{ t(`devicesModule.wizard.totals.${item.key}`, { count: item.count }) }}
		</el-text>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElText } from 'element-plus';

import type { IWizardRow } from './device-wizard.types';

defineOptions({
	name: 'DeviceWizardInventorySummary',
});

interface IProps {
	rows: IWizardRow[];
	visibleCount: number;
}

const props = defineProps<IProps>();

const { t } = useI18n();

const summary = computed(() => [
	{ key: 'found', count: props.rows.length },
	{ key: 'adoptable', count: props.rows.filter((row) => row.adoptable).length },
	{ key: 'alreadyAdded', count: props.rows.filter((row) => row.status === 'already_registered').length },
	{ key: 'unsupported', count: props.rows.filter((row) => row.status === 'unsupported').length },
	{ key: 'visible', count: props.visibleCount },
]);
</script>
