<template>
	<el-table
		v-loading="props.loading"
		:element-loading-text="t('devicesModule.texts.devices.loadingDevices')"
		:data="props.items"
		:default-sort="{ prop: props.sortBy, order: props.sortDir || 'ascending' }"
		table-layout="fixed"
		class="flex-grow"
		@sort-change="onSortData"
		@selection-change="onSelectionChange"
		@row-click="onRowClick"
	>
		<template #empty>
			<div
				v-if="props.loading"
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:power-plug" />
							</template>
							<template #secondary>
								<icon icon="mdi:database-refresh" />
							</template>
						</icon-with-child>
					</template>
				</el-result>
			</div>

			<div
				v-else-if="noResults && !props.loading"
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:power-plug" />
							</template>
							<template #secondary>
								<icon icon="mdi:information" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						{{ t('devicesModule.texts.devices.noDevices') }}
					</template>
				</el-result>
			</div>

			<div
				v-else-if="props.filtersActive && !props.loading"
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:power-plug" />
							</template>
							<template #secondary>
								<icon icon="mdi:filter-multiple" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						<el-text class="block">
							{{ t('devicesModule.texts.devices.noFilteredDevices') }}
						</el-text>

						<el-button
							type="primary"
							plain
							class="mt-4"
							@click="emit('reset-filters')"
						>
							<template #icon>
								<icon icon="mdi:filter-off" />
							</template>

							{{ t('devicesModule.buttons.resetFilters.title') }}
						</el-button>
					</template>
				</el-result>
			</div>
		</template>

		<el-table-column
			v-if="isMDDevice"
			type="selection"
			:width="30"
		/>

		<el-table-column
			:width="60"
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
			</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModule.table.devices.columns.type.title')"
			prop="type"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="200"
		>
			<template #default="scope">
				<devices-table-column-plugin
					:device="scope.row"
					:filters="innerFilters"
					@filter-by="(value: IPlugin['type'], add: boolean) => onFilterBy('type', value, add)"
				/>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModule.table.devices.columns.state.title')"
			prop="state"
			:width="150"
		>
			<template #default="scope">
				<devices-table-column-state
					:device="scope.row"
					:filters="innerFilters"
					@filter-by="(value: ConnectionState, add: boolean) => onFilterBy('state', value, add)"
				/>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModule.table.devices.columns.category.title')"
			prop="category"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="180"
		>
			<template #default="scope">
				<el-link
					:type="innerFilters.categories.includes(scope.row.category) ? 'danger' : undefined"
					:underline="false"
					class="font-400!"
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

					{{ t(`devicesModule.categories.devices.${scope.row.category}`) }}
				</el-link>
			</template>
		</el-table-column>

		<el-table-column
			:width="180"
			align="right"
		>
			<template #default="scope">
				<el-button
					size="small"
					plain
					data-test-id="detail-device"
					@click.stop="emit('detail', scope.row.id)"
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
					@click.stop="emit('edit', scope.row.id)"
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
					@click.stop="emit('remove', scope.row.id)"
				>
					<template #icon>
						<icon icon="mdi:trash" />
					</template>
				</el-button>
			</template>
		</el-table-column>
	</el-table>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElIcon, ElLink, ElResult, ElTable, ElTableColumn, ElText, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { type IPlugin, IconWithChild, useBreakpoints } from '../../../../common';
import type { DevicesModuleDeviceCategory } from '../../../../openapi';
import type { IDevicesFilter } from '../../composables/composables';
import type { ConnectionState } from '../../devices.constants';
import type { IDevice } from '../../store/devices.store.types';

import DevicesTableColumnIcon from './devices-table-column-icon.vue';
import DevicesTableColumnPlugin from './devices-table-column-plugin.vue';
import DevicesTableColumnState from './devices-table-column-state.vue';
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
	(e: 'update:sort-by', by: 'name' | 'description' | 'type' | 'category'): void;
	(e: 'update:sort-dir', dir: 'ascending' | 'descending' | null): void;
}>();

const { t } = useI18n();

const { isMDDevice } = useBreakpoints();

const noResults = computed<boolean>((): boolean => props.totalRows === 0);

const innerFilters = useVModel(props, 'filters', emit);

const onSortData = ({ prop, order }: { prop: 'name' | 'description' | 'type' | 'category'; order: 'ascending' | 'descending' | null }): void => {
	emit('update:sort-by', prop);
	emit('update:sort-dir', order);
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
			filteredStates.push(data as ConnectionState);
		} else {
			filteredStates = innerFilters.value.states.filter((item) => item !== data);
		}

		innerFilters.value.states = Array.from(new Set(filteredStates));
	}
};
</script>
