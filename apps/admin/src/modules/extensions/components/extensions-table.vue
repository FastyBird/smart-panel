<template>
	<el-table
		ref="tableEl"
		v-loading="props.loading && props.items.length > 0"
		:element-loading-text="t('extensionsModule.texts.loadingExtensions')"
		:data="sortedItems"
		:default-sort="
			typeof props.sortBy !== 'undefined' && props.sortDir !== null
				? { prop: props.sortBy, order: props.sortDir === 'desc' ? 'descending' : 'ascending' }
				: undefined
		"
		table-layout="fixed"
		row-key="type"
		class="flex-grow"
		:style="{ maxHeight: props.tableHeight + 'px' }"
		:max-height="props.tableHeight"
		@sort-change="onSortData"
		@selection-change="onSelectionChange"
		@row-click="onRowClick"
	>
		<template #empty>
			<extensions-empty
				:loading="props.loading"
				:filters-active="props.filtersActive"
				@reset-filters="emit('reset-filters')"
			/>
		</template>

		<el-table-column
			type="selection"
			fixed="left"
			:width="40"
		/>

		<el-table-column
			:width="56"
			align="center"
		>
			<template #default="scope">
				<icon
					:icon="scope.row.kind === ExtensionKind.module ? 'mdi:package-variant' : 'mdi:toy-brick'"
					width="24"
					height="24"
					class="text-secondary"
					aria-hidden="true"
				/>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('extensionsModule.table.columns.name.title')"
			prop="name"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="220"
		>
			<template #default="scope">
				<span class="block text-card-title truncate">{{ scope.row.name }}</span>
				<span
					v-if="scope.row.description"
					class="block text-help truncate"
				>
					{{ scope.row.description }}
				</span>
			</template>
		</el-table-column>

		<!-- Tablet portrait keeps the name, the kind and the enabled switch; the identifier and version stay on the detail -->
		<el-table-column
			v-if="!isTabletPortrait"
			:label="t('extensionsModule.table.columns.type.title')"
			prop="type"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="220"
		>
			<template #default="scope">
				<span
					:title="scope.row.type"
					class="block text-mono text-secondary truncate"
				>
					{{ scope.row.type }}
				</span>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('extensionsModule.table.columns.kind.title')"
			prop="kind"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="150"
		>
			<template #default="scope">
				<span class="block text-body">
					{{ scope.row.kind === ExtensionKind.module ? t('extensionsModule.labels.module') : t('extensionsModule.labels.plugin') }}
				</span>
				<span class="block text-caption">
					{{ scope.row.isCore ? t('extensionsModule.labels.core') : t('extensionsModule.labels.addon') }}
				</span>
			</template>
		</el-table-column>

		<el-table-column
			v-if="!isTabletPortrait"
			:label="t('extensionsModule.table.columns.version.title')"
			prop="version"
			:width="160"
		>
			<template #default="scope">
				<span
					:title="scope.row.version || undefined"
					class="block text-mono whitespace-nowrap truncate"
				>
					{{ scope.row.version || '—' }}
				</span>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('extensionsModule.table.columns.enabled.title')"
			prop="enabled"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="110"
		>
			<template #default="scope">
				<div @click.stop>
					<el-switch
						:model-value="scope.row.enabled"
						:disabled="!scope.row.canToggleEnabled"
						:aria-label="t('extensionsModule.aria.enable', { name: scope.row.name })"
						data-test-id="extension-enabled"
						@change="(val: string | number | boolean) => onToggleEnabled(scope.row.type, val === true)"
					/>
				</div>
			</template>
		</el-table-column>

		<el-table-column
			:width="110"
			align="right"
			fixed="right"
		>
			<template #default="scope">
				<div @click.stop>
					<el-button
						plain
						data-test-id="detail-extension"
						@click="emit('detail', scope.row.type)"
					>
						{{ t('extensionsModule.buttons.detail.title') }}
					</el-button>
				</div>
			</template>
		</el-table-column>
	</el-table>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElSwitch, ElTable, ElTableColumn, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useSizeClass } from '../../../common';
import { ExtensionKind } from '../extensions.constants';
import type { IExtension } from '../store/extensions.store.types';

import ExtensionsEmpty from './extensions-empty.vue';
import type { IExtensionsTableProps } from './extensions-table.types';

defineOptions({
	name: 'ExtensionsTable',
});

const props = defineProps<IExtensionsTableProps>();

const emit = defineEmits<{
	(e: 'detail', type: IExtension['type']): void;
	(e: 'toggle-enabled', type: IExtension['type'], enabled: boolean): void;
	(e: 'reset-filters'): void;
	(e: 'selected-changes', selected: IExtension[]): void;
	(e: 'update:sort-by', by: 'name' | 'type' | 'kind' | 'enabled' | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
}>();

const { t } = useI18n();

const { isTabletPortrait } = useSizeClass();

const tableEl = ref<InstanceType<typeof ElTable> | null>(null);

// Items are already sorted by the datasource based on user selection
const sortedItems = computed<IExtension[]>(() => props.items);

const onSortData = ({
	prop,
	order,
}: {
	prop: 'name' | 'type' | 'kind' | 'enabled';
	order: 'ascending' | 'descending' | null;
}): void => {
	emit('update:sort-by', prop);
	emit('update:sort-dir', order === 'descending' ? 'desc' : order === 'ascending' ? 'asc' : null);
};

const onRowClick = (row: IExtension): void => {
	emit('detail', row.type);
};

const onToggleEnabled = (type: IExtension['type'], enabled: boolean): void => {
	emit('toggle-enabled', type, enabled);
};

const onSelectionChange = (selection: IExtension[]): void => {
	emit('selected-changes', selection);
};

// The filter bar's Clear selection
const clearSelection = (): void => {
	tableEl.value?.clearSelection();
};

defineExpose({ clearSelection });
</script>
