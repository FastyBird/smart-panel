<template>
	<div class="flex flex-col gap-3 h-full overflow-hidden">
		<el-table
			:data="rows"
			class="h-full w-full flex-grow"
			table-layout="fixed"
			:empty-text="t('devicesModule.wizard.texts.noSelection')"
			:default-sort="{ prop: 'name', order: 'ascending' }"
		>
			<el-table-column width="60">
				<template #header>
					<el-checkbox
						:model-value="allSelected"
						:indeterminate="someSelected && !allSelected"
						:disabled="rows.length === 0"
						@change="(value: boolean | string | number) => emit('toggle-all', value === true)"
					/>
				</template>
				<template #default="{ row }: { row: IWizardRow }">
					<el-checkbox
						:model-value="selected[row.key] === true"
						@change="(value: boolean | string | number) => emit('toggle-row', row.key, value === true)"
					/>
				</template>
			</el-table-column>

			<el-table-column
				prop="name"
				:label="t('devicesModule.wizard.columns.name')"
				min-width="220"
				sortable
				:sort-method="sortByName"
			>
				<template #default="{ row }: { row: IWizardRow }">
					<el-input
						:model-value="nameByKey[row.key] ?? ''"
						@update:model-value="(value: string) => emit('update-name', row.key, value)"
					/>
				</template>
			</el-table-column>

			<el-table-column
				prop="identifier"
				:label="identifierLabel"
				min-width="150"
				sortable
				:sort-method="sortByIdentifier"
			>
				<template #default="{ row }: { row: IWizardRow }">
					<code class="text-sm">{{ row.identifier }}</code>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModule.wizard.columns.change')"
				width="170"
				sortable
				:sort-method="sortByChange"
			>
				<template #default="{ row }: { row: IWizardRow }">
					<el-tag
						size="small"
						:type="row.willUpdate ? 'warning' : 'success'"
					>
						{{ row.willUpdate ? t('devicesModule.wizard.statuses.willUpdate') : t('devicesModule.wizard.statuses.willCreate') }}
					</el-tag>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModule.wizard.columns.category')"
				min-width="240"
				sortable
				:sort-method="sortByCategory"
			>
				<template #default="{ row }: { row: IWizardRow }">
					<el-select
						:model-value="categoryByKey[row.key] ?? null"
						filterable
						@update:model-value="(value: DevicesModuleDeviceCategory | null) => emit('update-category', row.key, value)"
					>
						<el-option
							v-for="option in row.categoryOptions"
							:key="option.value"
							:label="option.label"
							:value="option.value"
						/>
					</el-select>
				</template>
			</el-table-column>

			<el-table-column
				v-for="column in extraColumns"
				:key="column.key"
				:label="column.label"
				:width="column.width"
				:min-width="column.minWidth"
				:sortable="column.sortable"
				:sort-method="(a: IWizardRow, b: IWizardRow) => sortByCell(column.key, a, b)"
			>
				<template #default="{ row }: { row: IWizardRow }">
					<device-wizard-cell :cell="row.cells?.[column.key]" />
				</template>
			</el-table-column>
		</el-table>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCheckbox, ElInput, ElOption, ElSelect, ElTable, ElTableColumn, ElTag } from 'element-plus';

import type { DevicesModuleDeviceCategory } from '../../../../openapi.constants';

import DeviceWizardCell from './device-wizard-cell.vue';
import { compareLocale } from './device-wizard.sort';
import type { IWizardColumn, IWizardRow } from './device-wizard.types';

defineOptions({
	name: 'DeviceWizardConfirmStep',
});

interface IProps {
	rows: IWizardRow[];
	columns: IWizardColumn[];
	selected: Record<string, boolean>;
	nameByKey: Record<string, string>;
	categoryByKey: Record<string, DevicesModuleDeviceCategory | null>;
	identifierLabel: string;
	allSelected: boolean;
	someSelected: boolean;
}

const props = defineProps<IProps>();

const emit = defineEmits<{
	(e: 'toggle-all', value: boolean): void;
	(e: 'toggle-row', key: string, value: boolean): void;
	(e: 'update-name', key: string, value: string): void;
	(e: 'update-category', key: string, value: DevicesModuleDeviceCategory | null): void;
}>();

const { t } = useI18n();

const extraColumns = computed<IWizardColumn[]>(() => props.columns.filter((column) => column.steps.includes('confirm')));

// `prop`-based sorting can't reach into the parent-owned name / category records, so each
// editable column gets a comparator that reads the current value rather than the row field.
const sortByName = (a: IWizardRow, b: IWizardRow): number =>
	compareLocale(props.nameByKey[a.key] ?? a.suggestedName, props.nameByKey[b.key] ?? b.suggestedName);

const sortByIdentifier = (a: IWizardRow, b: IWizardRow): number => compareLocale(a.identifier, b.identifier);

// Group "will create" rows ahead of "will update" ones so new devices are scanned first.
const sortByChange = (a: IWizardRow, b: IWizardRow): number => {
	const diff = (a.willUpdate ? 1 : 0) - (b.willUpdate ? 1 : 0);

	return diff !== 0 ? diff : compareLocale(a.identifier, b.identifier);
};

const sortByCategory = (a: IWizardRow, b: IWizardRow): number => {
	const label = (row: IWizardRow): string => {
		const category = props.categoryByKey[row.key];

		return row.categoryOptions.find((option) => option.value === category)?.label ?? '';
	};

	return compareLocale(label(a), label(b));
};

const sortByCell = (key: string, a: IWizardRow, b: IWizardRow): number => compareLocale(a.cells?.[key]?.value, b.cells?.[key]?.value);
</script>
