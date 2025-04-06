<template>
	<el-table
		v-loading="props.loading"
		:element-loading-text="t('devicesModule.texts.channels.loadingChannels')"
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
								<icon icon="mdi:chip" />
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
								<icon icon="mdi:chip" />
							</template>
							<template #secondary>
								<icon icon="mdi:information" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						{{ t('devicesModule.texts.channels.noChannels') }}
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
								<icon icon="mdi:chip" />
							</template>
							<template #secondary>
								<icon icon="mdi:filter-multiple" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						<el-text class="block">
							{{ t('devicesModule.texts.channels.noFilteredChannels') }}
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
				<channels-table-column-icon :channel="scope.row" />
			</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModule.table.channels.columns.name.title')"
			prop="name"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="150"
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
			:label="t('devicesModule.table.channels.columns.device.title')"
			prop="device"
			:min-width="180"
		>
			<template #default="scope">
				<channels-table-column-device
					:channel="scope.row"
					:filters="innerFilters"
					@filter-by="(value: IDevice['id'], add: boolean) => onFilterBy('device', value, add)"
				/>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModule.table.channels.columns.category.title')"
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

					{{ t(`devicesModule.categories.channels.${scope.row.category}`) }}
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
					data-test-id="detail-channel"
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
					data-test-id="edit-channel"
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
					data-test-id="remove-channel"
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

import { IconWithChild, useBreakpoints } from '../../../../common';
import { DevicesChannelCategory } from '../../../../openapi';
import type { IChannelsFilter } from '../../composables/types';
import type { IChannel } from '../../store/channels.store.types';
import type { IDevice } from '../../store/devices.store.types';

import ChannelsTableColumnDevice from './channels-table-column-device.vue';
import ChannelsTableColumnIcon from './channels-table-column-icon.vue';
import type { IChannelsTableProps } from './channels-table.types';

defineOptions({
	name: 'ChannelsTable',
});

const props = defineProps<IChannelsTableProps>();

const emit = defineEmits<{
	(e: 'detail', id: IChannel['id']): void;
	(e: 'edit', id: IChannel['id']): void;
	(e: 'remove', id: IChannel['id']): void;
	(e: 'reset-filters'): void;
	(e: 'selected-changes', selected: IChannel[]): void;
	(e: 'update:filters', filters: IChannelsFilter): void;
	(e: 'update:sort-by', by: 'name' | 'description' | 'category'): void;
	(e: 'update:sort-dir', dir: 'ascending' | 'descending' | null): void;
}>();

const { t } = useI18n();

const { isMDDevice } = useBreakpoints();

const noResults = computed<boolean>((): boolean => props.totalRows === 0);

const innerFilters = useVModel(props, 'filters', emit);

const onSortData = ({ prop, order }: { prop: 'name' | 'description' | 'category'; order: 'ascending' | 'descending' | null }): void => {
	emit('update:sort-by', prop);
	emit('update:sort-dir', order);
};

const onSelectionChange = (selected: IChannel[]): void => {
	emit('selected-changes', selected);
};

const onRowClick = (row: IChannel): void => {
	emit('detail', row.id);
};

const onFilterBy = (column: string, data: string, add?: boolean): void => {
	if (column === 'device') {
		let filteredDevices = innerFilters.value.devices;

		if (add === true) {
			filteredDevices.push(data as IDevice['id']);
		} else {
			filteredDevices = innerFilters.value.devices.filter((item) => item !== data);
		}

		innerFilters.value.devices = Array.from(new Set(filteredDevices));
	} else if (column === 'category') {
		let filteredCategories = innerFilters.value.categories;

		if (add === true) {
			filteredCategories.push(data as DevicesChannelCategory);
		} else {
			filteredCategories = innerFilters.value.categories.filter((item) => item !== data);
		}

		innerFilters.value.categories = Array.from(new Set(filteredCategories));
	}
};
</script>
