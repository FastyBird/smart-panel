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
					<el-tag :type="wizardResultTagType(row.status)">
						{{ t(`devicesModule.wizard.statuses.${row.status}`) }}
					</el-tag>
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
						class="text-red-500"
					>
						{{ row.error }}
					</span>
					<span
						v-else
						class="text-gray-400"
					>
						&mdash;
					</span>
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

import { ElAlert, ElTable, ElTableColumn, ElTag } from 'element-plus';

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
}

const props = defineProps<IProps>();

const { t } = useI18n();

const hasFailures = computed<boolean>(() => props.results.some((item) => item.status === 'failed'));

const extraColumns = computed<IWizardColumn[]>(() => props.columns.filter((column) => column.steps.includes('results')));

// Failures rise to the top so the user immediately sees what needs attention, then created
// devices, then updates, falling back to name within each bucket.
const sortedResults = computed<IWizardResult[]>(() => {
	const rank = (status: IWizardResult['status']): number => {
		if (status === 'failed') {
			return 0;
		}

		return status === 'created' ? 1 : 2;
	};

	return props.results.slice().sort((a, b) => {
		const diff = rank(a.status) - rank(b.status);

		return diff !== 0 ? diff : compareLocale(a.name, b.name);
	});
});
</script>
