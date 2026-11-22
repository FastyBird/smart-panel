<template>
	<div class="flex flex-col gap-3 h-full overflow-hidden">
		<div
			data-test-id="wizard-select-search"
			class="shrink-0"
		>
			<el-input
				v-model="search"
				:placeholder="t('devicesModule.fields.devices.search.placeholder')"
				clearable
			/>
		</div>

		<device-wizard-inventory-summary
			:rows="summaryRows"
			:visible-count="filteredRows.length"
		/>

		<div
			data-test-id="wizard-select-table-scroll"
			class="min-h-0 flex-1 overflow-x-auto overscroll-x-contain"
		>
			<el-table
				:data="pageRows"
				class="h-full w-full"
				:style="{ minWidth: `${tableMinWidth}px` }"
				table-layout="fixed"
				:empty-text="t('devicesModule.wizard.texts.noSelection')"
				:default-sort="{ prop: 'name', order: 'ascending' }"
				@sort-change="onSortChange"
			>
				<el-table-column width="60">
					<template #header>
						<el-checkbox
							:model-value="allFilteredSelected"
							:indeterminate="someFilteredSelected && !allFilteredSelected"
							:disabled="filteredRows.length === 0"
							@change="
								(value: boolean | string | number) =>
									emit(
										'toggle-rows',
										filteredRows.map((row) => row.key),
										value === true
									)
							"
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
					sortable="custom"
				>
					<template #default="{ row }: { row: IWizardRow }">
						<span class="font-medium">{{ nameByKey[row.key] ?? row.suggestedName }}</span>
					</template>
				</el-table-column>

				<el-table-column
					prop="identifier"
					:label="identifierLabel"
					min-width="150"
					sortable="custom"
				>
					<template #default="{ row }: { row: IWizardRow }">
						<code class="text-sm">{{ row.identifier }}</code>
					</template>
				</el-table-column>

				<el-table-column
					prop="change"
					:label="t('devicesModule.wizard.columns.change')"
					width="170"
					sortable="custom"
				>
					<template #default="{ row }: { row: IWizardRow }">
						<status-tag
							:status="row.willUpdate ? 'warn' : 'ok'"
							:label="row.willUpdate ? t('devicesModule.wizard.statuses.willUpdate') : t('devicesModule.wizard.statuses.willCreate')"
						/>
					</template>
				</el-table-column>

				<el-table-column
					prop="category"
					:label="t('devicesModule.wizard.columns.category')"
					min-width="240"
					sortable="custom"
				>
					<template #default="{ row }: { row: IWizardRow }">
						<span>{{ categoryLabel(row) }}</span>
					</template>
				</el-table-column>

				<el-table-column
					v-for="column in extraColumns"
					:key="column.key"
					:prop="column.key"
					:label="column.label"
					:width="column.width"
					:min-width="column.minWidth"
					:sortable="column.sortable ? 'custom' : false"
				>
					<template #default="{ row }: { row: IWizardRow }">
						<device-wizard-cell :cell="row.cells?.[column.key]" />
					</template>
				</el-table-column>
			</el-table>
		</div>

		<el-pagination
			v-if="filteredRows.length > PAGE_SIZE"
			v-model:current-page="currentPage"
			data-test-id="wizard-select-pagination"
			class="shrink-0 justify-center"
			layout="prev, pager, next"
			:page-size="PAGE_SIZE"
			:pager-count="5"
			:total="filteredRows.length"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCheckbox, ElInput, ElPagination, ElTable, ElTableColumn } from 'element-plus';

import { StatusTag } from '../../../../common';
import type { DevicesModuleDeviceCategory } from '../../../../openapi.constants';

import DeviceWizardCell from './device-wizard-cell.vue';
import DeviceWizardInventorySummary from './device-wizard-inventory-summary.vue';
import { compareLocale } from './device-wizard.sort';
import type { IWizardColumn, IWizardRow } from './device-wizard.types';

defineOptions({
	name: 'DeviceWizardSelectStep',
});

interface IProps {
	rows: IWizardRow[];
	summaryRows: IWizardRow[];
	columns: IWizardColumn[];
	selected: Record<string, boolean>;
	nameByKey: Record<string, string>;
	categoryByKey: Record<string, DevicesModuleDeviceCategory | null>;
	identifierLabel: string;
}

const props = defineProps<IProps>();

const emit = defineEmits<{
	(e: 'toggle-row', key: string, value: boolean): void;
	(e: 'toggle-rows', keys: string[], value: boolean): void;
}>();

const { t } = useI18n();

const PAGE_SIZE = 25;

const search = ref<string>('');
const currentPage = ref<number>(1);
const sortKey = ref<string | null>('name');
const sortOrder = ref<'ascending' | 'descending' | null>('ascending');

const categoryLabel = (row: IWizardRow): string => {
	const category = props.categoryByKey[row.key] ?? row.suggestedCategory;

	return row.categoryOptions.find((option) => option.value === category)?.label ?? '';
};

const filteredRows = computed<IWizardRow[]>(() => {
	const query = search.value.trim().toLocaleLowerCase();

	if (query.length === 0) {
		return props.rows;
	}

	return props.rows.filter((row) => {
		const values = [
			row.label,
			row.subLabel,
			row.identifier,
			row.statusLabel ?? t(`devicesModule.wizard.statuses.${row.status}`),
			props.nameByKey[row.key],
			categoryLabel(row),
			...Object.values(row.cells ?? {}).map((cell) => cell.value),
		];

		return values.some((value) => value?.toLocaleLowerCase().includes(query));
	});
});

const allFilteredSelected = computed<boolean>(
	() => filteredRows.value.length > 0 && filteredRows.value.every((row) => props.selected[row.key] === true)
);

const someFilteredSelected = computed<boolean>(() => filteredRows.value.some((row) => props.selected[row.key] === true));

const extraColumns = computed<IWizardColumn[]>(() =>
	props.columns.filter((column) => column.steps.includes('select') || column.steps.includes('confirm'))
);

const tableMinWidth = computed<number>(() => extraColumns.value.reduce((width, column) => width + (column.width ?? column.minWidth ?? 150), 900));

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
	return compareLocale(categoryLabel(a), categoryLabel(b));
};

const sortByCell = (key: string, a: IWizardRow, b: IWizardRow): number => compareLocale(a.cells?.[key]?.value, b.cells?.[key]?.value);

const compareRows = (a: IWizardRow, b: IWizardRow): number => {
	if (sortKey.value === 'name') {
		return sortByName(a, b);
	}

	if (sortKey.value === 'identifier') {
		return sortByIdentifier(a, b);
	}

	if (sortKey.value === 'change') {
		return sortByChange(a, b);
	}

	if (sortKey.value === 'category') {
		return sortByCategory(a, b);
	}

	return sortKey.value === null ? 0 : sortByCell(sortKey.value, a, b);
};

const sortedRows = computed<IWizardRow[]>(() => {
	if (sortKey.value === null || sortOrder.value === null) {
		return filteredRows.value;
	}

	const direction = sortOrder.value === 'ascending' ? 1 : -1;

	return [...filteredRows.value].sort((a, b) => direction * compareRows(a, b));
});

const pageRows = computed<IWizardRow[]>(() => {
	const start = (currentPage.value - 1) * PAGE_SIZE;

	return sortedRows.value.slice(start, start + PAGE_SIZE);
});

watch(search, () => {
	currentPage.value = 1;
});

watch(
	() => filteredRows.value.length,
	(count) => {
		currentPage.value = Math.min(currentPage.value, Math.max(1, Math.ceil(count / PAGE_SIZE)));
	}
);

const onSortChange = ({ prop, order }: { prop: string | null; order: 'ascending' | 'descending' | null }): void => {
	sortKey.value = prop;
	sortOrder.value = order;
	currentPage.value = 1;
};
</script>
