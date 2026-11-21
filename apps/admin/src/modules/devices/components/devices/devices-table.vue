<template>
	<el-table
		ref="tableEl"
		:data="props.items"
		:default-sort="
			typeof props.sortBy !== 'undefined' && props.sortDir !== null
				? { prop: props.sortBy, order: props.sortDir === 'desc' ? 'descending' : 'ascending' }
				: undefined
		"
		table-layout="fixed"
		row-key="id"
		class="flex-grow"
		:style="{ maxHeight: tableHeight + 'px' }"
		:max-height="tableHeight"
		@sort-change="onSortData"
		@selection-change="onSelectionChange"
		@row-click="onRowClick"
	>
		<template #empty>
			<state-view
				v-if="props.loading"
				kind="loading"
				:title="t('devicesModule.texts.devices.loadingDevices')"
				icon="mdi:devices"
			/>

			<state-view
				v-else-if="props.filtersActive && !noResults"
				kind="empty"
				:title="t('devicesModule.texts.devices.noFilteredDevices')"
				icon="mdi:filter-multiple"
			>
				<template #action>
					<el-button
						plain
						@click="emit('reset-filters')"
					>
						<template #icon>
							<icon icon="mdi:filter-off" />
						</template>

						{{ t('devicesModule.buttons.resetFilters.title') }}
					</el-button>
				</template>
			</state-view>

			<state-view
				v-else
				kind="empty"
				:title="t('devicesModule.texts.devices.noDevices')"
				icon="mdi:devices"
			/>
		</template>

		<el-table-column
			type="selection"
			fixed="left"
			:width="40"
		/>

		<el-table-column
			:width="60"
			fixed="left"
			align="center"
		>
			<template #default="scope">
				<devices-table-column-icon :device="scope.row" />
			</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModule.table.devices.columns.name.title')"
			prop="name"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="200"
			fixed="left"
			class-name="py-0!"
		>
			<template #default="scope">
				<template v-if="scope.row.description">
					<strong class="block">{{ scope.row.name }}</strong>
					<el-text
						size="small"
						class="block leading-4"
						truncated
					>
						{{ scope.row.description }}
					</el-text>
				</template>
				<template v-else>
					{{ scope.row.name }}
				</template>

				<devices-table-column-hidden :device="scope.row" />
			</template>
		</el-table-column>

		<!-- Integration: dropped on tablet portrait, where the table keeps to what fits (spec section 6) -->
		<el-table-column
			v-if="!isTabletPortrait"
			:label="t('devicesModule.table.devices.columns.type.title')"
			prop="type"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="170"
		>
			<template #default="scope">
				<devices-table-column-plugin
					:device="scope.row"
					:filters="innerFilters"
					@filter-by="(value: IPluginElement['type'], add: boolean) => onFilterBy('type', value, add)"
				/>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModule.table.devices.columns.state.title')"
			prop="state"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="130"
		>
			<template #default="scope">
				<status-tag
					:status="deviceStatusTag(scope.row.status?.status)"
					:label="t(`devicesModule.states.${String(scope.row.status?.status ?? DevicesModuleDeviceConnectionStatus.unknown).toLowerCase()}`)"
				/>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModule.table.devices.columns.category.title')"
			prop="category"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="140"
		>
			<template #default="scope">
				<el-tooltip
					:content="t(`devicesModule.categories.devices.${scope.row.category}`)"
					placement="top"
					:show-after="500"
				>
					<el-link
						:type="innerFilters.categories.includes(scope.row.category) ? 'danger' : undefined"
						underline="never"
						class="font-400! overflow-hidden"
						@click.stop="onFilterBy('category', scope.row.category, !innerFilters.categories.includes(scope.row.category))"
					>
						<el-icon class="el-icon--left">
							<icon
								v-if="innerFilters.categories.includes(scope.row.category)"
								icon="mdi:filter-minus"
							/>
							<icon
								v-else
								icon="mdi:filter-plus"
							/>
						</el-icon>

						<el-text
							class="block leading-4 max-w-[80%]!"
							truncated
						>
							{{ t(`devicesModule.categories.devices.${scope.row.category}`) }}
						</el-text>
					</el-link>
				</el-tooltip>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModule.table.devices.columns.enabled.title')"
			prop="enabled"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="110"
		>
			<template #default="scope">
				<el-link
					:type="innerFilters.enabled === (scope.row.enabled ? 'enabled' : 'disabled') ? 'danger' : undefined"
					underline="never"
					class="font-400!"
					@click.stop="
						onFilterBy('enabled', scope.row.enabled ? 'enabled' : 'disabled', innerFilters.enabled !== (scope.row.enabled ? 'enabled' : 'disabled'))
					"
				>
					<el-icon class="el-icon--left">
						<icon
							v-if="innerFilters.categories.includes(scope.row.category)"
							icon="mdi:filter-minus"
						/>
						<icon
							v-else
							icon="mdi:filter-plus"
						/>
					</el-icon>

					{{
						scope.row.enabled
							? t('devicesModule.table.devices.columns.enabled.values.enabled')
							: t('devicesModule.table.devices.columns.enabled.values.disabled')
					}}
				</el-link>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModule.table.devices.columns.validation.title')"
			prop="validation"
			:width="120"
		>
			<template #default="scope">
				<devices-table-column-validation :device="scope.row" />
			</template>
		</el-table-column>

		<el-table-column
			:width="190"
			align="right"
		>
			<template #default="scope">
				<div @click.stop>
					<el-button
						size="small"
						plain
						data-test-id="detail-device"
						@click="emit('detail', scope.row.id)"
					>
						<template #icon>
							<icon icon="mdi:file-search-outline" />
						</template>

						{{ t('devicesModule.buttons.detail.title') }}
					</el-button>
					<el-button
						size="small"
						plain
						class="ml-1!"
						data-test-id="edit-device"
						@click="emit('edit', scope.row.id)"
					>
						<template #icon>
							<icon icon="mdi:pencil" />
						</template>
					</el-button>
					<el-button
						size="small"
						type="warning"
						plain
						class="ml-1!"
						data-test-id="remove-device"
						@click="emit('remove', scope.row.id)"
					>
						<template #icon>
							<icon icon="mdi:trash" />
						</template>
					</el-button>
				</div>
			</template>
		</el-table-column>
	</el-table>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElIcon, ElLink, ElTable, ElTableColumn, ElText, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { type IPluginElement, StateView, StatusTag, useSizeClass } from '../../../../common';
import { type DevicesModuleDeviceCategory, DevicesModuleDeviceConnectionStatus } from '../../../../openapi.constants';
import type { IDevicesFilter } from '../../composables/types';
import { deviceStatusTag } from '../../devices.status';
import type { IDevice } from '../../store/devices.store.types';

import DevicesTableColumnHidden from './devices-table-column-hidden.vue';
import DevicesTableColumnIcon from './devices-table-column-icon.vue';
import DevicesTableColumnPlugin from './devices-table-column-plugin.vue';
import DevicesTableColumnValidation from './devices-table-column-validation.vue';
import type { IDevicesTableProps } from './devices-table.types';

defineOptions({
	name: 'DevicesTable',
});

const props = defineProps<IDevicesTableProps>();

const emit = defineEmits<{
	(e: 'detail', id: IDevice['id']): void;
	(e: 'edit', id: IDevice['id']): void;
	(e: 'remove', id: IDevice['id']): void;
	(e: 'reset-filters'): void;
	(e: 'selected-changes', selected: IDevice[]): void;
	(e: 'update:filters', filters: IDevicesFilter): void;
	(e: 'update:sort-by', by: 'name' | 'description' | 'type' | 'state' | 'category' | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
}>();

const { t } = useI18n();

const { isTabletPortrait } = useSizeClass();

const tableEl = ref<InstanceType<typeof ElTable> | null>(null);

// The filter bar's Clear selection
const clearSelection = (): void => {
	tableEl.value?.clearSelection();
};

defineExpose({ clearSelection });

const noResults = computed<boolean>((): boolean => props.totalRows === 0);

const innerFilters = useVModel(props, 'filters', emit);

const onSortData = ({
	prop,
	order,
}: {
	prop: 'name' | 'description' | 'type' | 'state' | 'category';
	order: 'ascending' | 'descending' | null;
}): void => {
	emit('update:sort-by', prop);
	emit('update:sort-dir', order === 'descending' ? 'desc' : order === 'ascending' ? 'asc' : null);
};

const onSelectionChange = (selected: IDevice[]): void => {
	emit('selected-changes', selected);
};

const onRowClick = (row: IDevice): void => {
	emit('detail', row.id);
};

const onFilterBy = (column: string, data: string, add?: boolean): void => {
	if (column === 'type') {
		let filteredTypes = innerFilters.value.types;

		if (add === true) {
			filteredTypes.push(data);
		} else {
			filteredTypes = innerFilters.value.types.filter((item) => item !== data);
		}

		innerFilters.value.types = Array.from(new Set(filteredTypes));
	} else if (column === 'category') {
		let filteredCategories = innerFilters.value.categories;

		if (add === true) {
			filteredCategories.push(data as DevicesModuleDeviceCategory);
		} else {
			filteredCategories = innerFilters.value.categories.filter((item) => item !== data);
		}

		innerFilters.value.categories = Array.from(new Set(filteredCategories));
	} else if (column === 'state') {
		let filteredStates = innerFilters.value.states;

		if (add === true) {
			filteredStates.push(data as DevicesModuleDeviceConnectionStatus);
		} else {
			filteredStates = innerFilters.value.states.filter((item) => item !== data);
		}

		innerFilters.value.states = Array.from(new Set(filteredStates));
	} else if (column === 'enabled') {
		if (add === true) {
			innerFilters.value.enabled = data as 'enabled' | 'disabled';
		} else {
			innerFilters.value.enabled = 'all';
		}
	} else if (column === 'validation') {
		if (add === true) {
			innerFilters.value.validation = data as 'valid' | 'invalid';
		} else {
			innerFilters.value.validation = 'all';
		}
	}
};
</script>
