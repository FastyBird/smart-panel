<template>
	<div class="flex flex-col gap-3 h-full overflow-hidden">
		<el-table
			:data="rows"
			class="h-full w-full flex-grow"
			table-layout="fixed"
		>
			<el-table-column
				:label="t('devicesZigbee2mqttPlugin.wizard.columns.status')"
				width="160"
				sortable
				:sort-method="sortByStatus"
			>
				<template #default="{ row }: { row: IResultRow }">
					<el-tag :type="resultTagType(row.result.status)">
						{{ t(`devicesZigbee2mqttPlugin.wizard.steps.results.${row.result.status}`) }}
					</el-tag>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesZigbee2mqttPlugin.wizard.columns.name')"
				min-width="200"
				sortable
				:sort-method="sortByName"
			>
				<template #default="{ row }: { row: IResultRow }">
					<span class="font-medium">{{ row.result.name }}</span>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesZigbee2mqttPlugin.wizard.columns.friendlyName')"
				min-width="180"
				sortable
				:sort-method="sortByFriendlyName"
			>
				<template #default="{ row }: { row: IResultRow }">
					<code class="text-sm">{{ row.device?.friendlyName ?? row.result.ieeeAddress }}</code>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesZigbee2mqttPlugin.wizard.columns.manufacturer')"
				min-width="180"
				sortable
				:sort-method="sortByManufacturer"
			>
				<template #default="{ row }: { row: IResultRow }">
					<small
						v-if="row.device && (row.device.manufacturer || row.device.model)"
						class="text-gray-500"
					>
						{{ [row.device.manufacturer, row.device.model].filter(Boolean).join(' · ') }}
					</small>
					<small
						v-else
						class="text-gray-400"
					>
						&mdash;
					</small>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesZigbee2mqttPlugin.wizard.columns.error')"
				min-width="220"
			>
				<template #default="{ row }: { row: IResultRow }">
					<span
						v-if="row.result.error"
						class="text-red-500"
					>
						{{ row.result.error }}
					</span>
					<span
						v-else
						class="text-gray-400"
					>
						&mdash;
					</span>
				</template>
			</el-table-column>
		</el-table>

		<div class="flex justify-end gap-2 shrink-0">
			<el-button @click="emit('restart')">
				<template #icon>
					<icon icon="mdi:plus" />
				</template>
				{{ t('devicesZigbee2mqttPlugin.wizard.steps.results.addMore') }}
			</el-button>
			<el-button
				type="primary"
				@click="emit('done')"
			>
				{{ t('devicesZigbee2mqttPlugin.wizard.steps.results.done') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElTable, ElTableColumn, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { IZ2mWizardAdoptionResult, IZ2mWizardDevice } from '../schemas/wizard.types';
import { compareLocale } from '../utils/wizard.sort';

defineOptions({
	name: 'Zigbee2mqttWizardResultsStep',
});

interface IProps {
	results: IZ2mWizardAdoptionResult[];
	devices: IZ2mWizardDevice[];
}

const props = defineProps<IProps>();

const emit = defineEmits<{
	(e: 'done'): void;
	(e: 'restart'): void;
}>();

const { t } = useI18n();

interface IResultRow {
	result: IZ2mWizardAdoptionResult;
	device: IZ2mWizardDevice | null;
}

// Pre-join each result with its source device so the table cells don't have to repeat the
// O(n) lookup, and so sort comparators can index into the device fields cleanly.
const rows = computed<IResultRow[]>(() =>
	props.results.map((result) => ({
		result,
		device: props.devices.find((device) => device.ieeeAddress === result.ieeeAddress) ?? null,
	}))
);

// Failures rise to the top so the user immediately sees which devices need attention; created
// devices come next, then updates, finally falling back to alphabetical name within ties.
const sortByStatus = (a: IResultRow, b: IResultRow): number => {
	const order = (status: IZ2mWizardAdoptionResult['status']): number => {
		if (status === 'failed') {
			return 0;
		}

		if (status === 'created') {
			return 1;
		}

		return 2;
	};

	const diff = order(a.result.status) - order(b.result.status);
	return diff !== 0 ? diff : compareLocale(a.result.name, b.result.name);
};

const sortByName = (a: IResultRow, b: IResultRow): number => compareLocale(a.result.name, b.result.name);

const sortByFriendlyName = (a: IResultRow, b: IResultRow): number =>
	compareLocale(a.device?.friendlyName ?? a.result.ieeeAddress, b.device?.friendlyName ?? b.result.ieeeAddress);

const sortByManufacturer = (a: IResultRow, b: IResultRow): number => {
	const aLabel = [a.device?.manufacturer, a.device?.model].filter(Boolean).join(' ');
	const bLabel = [b.device?.manufacturer, b.device?.model].filter(Boolean).join(' ');
	return compareLocale(aLabel, bLabel);
};

const resultTagType = (status: IZ2mWizardAdoptionResult['status']): 'success' | 'info' | 'danger' => {
	if (status === 'created') {
		return 'success';
	}

	if (status === 'updated') {
		return 'info';
	}

	return 'danger';
};
</script>
