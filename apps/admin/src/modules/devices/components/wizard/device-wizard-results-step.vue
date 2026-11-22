<template>
	<div class="flex flex-col gap-3 h-full overflow-hidden">
		<el-alert
			:title="hasFailures ? t('devicesModule.wizard.texts.resultsFailed') : t('devicesModule.wizard.texts.resultsSuccess')"
			:type="hasFailures ? 'warning' : 'success'"
			:closable="false"
			show-icon
			class="shrink-0"
		/>

		<el-table
			:data="sortedResults"
			class="h-full w-full flex-grow"
			table-layout="fixed"
		>
			<el-table-column
				:label="t('devicesModule.wizard.columns.status')"
				width="140"
			>
				<template #default="{ row }: { row: IWizardResult }">
					<status-tag
						:status="resultStatus(row.status)"
						:label="t(`devicesModule.wizard.statuses.${row.status}`)"
					/>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModule.wizard.columns.name')"
				min-width="200"
			>
				<template #default="{ row }: { row: IWizardResult }">
					<span class="font-medium">{{ row.name }}</span>
				</template>
			</el-table-column>

			<el-table-column
				:label="identifierLabel"
				min-width="150"
			>
				<template #default="{ row }: { row: IWizardResult }">
					<code class="text-sm">{{ row.identifier }}</code>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModule.wizard.columns.error')"
				min-width="220"
			>
				<template #default="{ row }: { row: IWizardResult }">
					<span
						v-if="row.error"
						class="text-danger"
					>
						{{ row.error }}
					</span>
					<span
						v-else
						class="text-secondary"
					>
						&mdash;
					</span>
				</template>
			</el-table-column>

			<el-table-column
				v-if="hasFailures"
				width="120"
				align="right"
			>
				<template #default="{ row }: { row: IWizardResult }">
					<!-- Partial success: a failed device is retried on its own, the added ones stay as they are -->
					<el-button
						v-if="row.status === 'failed'"
						:loading="props.retrying"
						:disabled="props.retrying"
						:aria-label="t('devicesModule.wizard.actions.retryDevice', { name: row.name })"
						size="small"
						data-test-id="wizard-result-retry"
						@click="emit('retry', row.key)"
					>
						{{ t('devicesModule.wizard.actions.retry') }}
					</el-button>
				</template>
			</el-table-column>

			<el-table-column
				v-for="column in extraColumns"
				:key="column.key"
				:label="column.label"
				:width="column.width"
				:min-width="column.minWidth"
			>
				<template #default="{ row }: { row: IWizardResult }">
					<device-wizard-cell :cell="row.cells?.[column.key]" />
				</template>
			</el-table-column>
		</el-table>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElTable, ElTableColumn } from 'element-plus';

import { StatusTag, type StatusTagStatus } from '../../../../common';

import DeviceWizardCell from './device-wizard-cell.vue';
import { compareLocale } from './device-wizard.sort';
import { type IWizardColumn, type IWizardResult, wizardResultTagType } from './device-wizard.types';

defineOptions({
	name: 'DeviceWizardResultsStep',
});

interface IProps {
	results: IWizardResult[];
	columns: IWizardColumn[];
	identifierLabel: string;
	/** A retry of failed devices is on its way */
	retrying?: boolean;
}

const props = withDefaults(defineProps<IProps>(), { retrying: false });

const emit = defineEmits<{
	(e: 'retry', key: string): void;
}>();

const { t } = useI18n();

const resultStatus = (status: IWizardResult['status']): StatusTagStatus => {
	const type = wizardResultTagType(status);

	return type === 'success' ? 'ok' : type;
};

const hasFailures = computed<boolean>(() => props.results.some((item) => item.status === 'failed'));

const extraColumns = computed<IWizardColumn[]>(() => props.columns.filter((column) => column.steps.includes('results')));

// Failures rise to the top so the user immediately sees what needs attention, then created
// devices, then updates and no-change results, falling back to name within each bucket.
const sortedResults = computed<IWizardResult[]>(() => {
	const rank = (status: IWizardResult['status']): number => {
		if (status === 'failed') {
			return 0;
		}

		if (status === 'created') {
			return 1;
		}

		return status === 'updated' ? 2 : 3;
	};

	return props.results.slice().sort((a, b) => {
		const diff = rank(a.status) - rank(b.status);

		return diff !== 0 ? diff : compareLocale(a.name, b.name);
	});
});
</script>
