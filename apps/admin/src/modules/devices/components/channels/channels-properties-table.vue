<template>
	<el-table
		v-loading="props.loading"
		:element-loading-text="t('devicesModule.texts.channelsProperties.loadingProperties')"
		:data="props.items"
		:default-sort="
			typeof props.sortBy !== 'undefined' && props.sortDir !== null
				? { prop: props.sortBy, order: props.sortDir === 'desc' ? 'descending' : 'ascending' }
				: undefined
		"
		table-layout="fixed"
		row-key="id"
		class="flex-grow"
		:max-height="tableHeight"
		@sort-change="onSortData"
		@selection-change="onSelectionChange"
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
								<icon icon="mdi:tune" />
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
								<icon icon="mdi:tune" />
							</template>
							<template #secondary>
								<icon icon="mdi:information" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						{{ t('devicesModule.texts.channelsProperties.noProperties') }}
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
								<icon icon="mdi:tune" />
							</template>
							<template #secondary>
								<icon icon="mdi:filter-multiple" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						<el-text class="block">
							{{ t('devicesModule.texts.channelsProperties.noFilteredProperties') }}
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
				<channels-properties-table-column-icon :property="scope.row" />
			</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModule.table.channelsProperties.columns.name.title')"
			prop="name"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="150"
			class-name="py-0!"
		>
			<template #default="scope">
				<template v-if="scope.row.name">
					<strong class="block">{{ scope.row.name }}</strong>
					<el-link
						v-if="props.withFilters"
						:type="innerFilters.categories.includes(scope.row.category) ? 'danger' : undefined"
						underline="never"
						class="font-400! block! leading-4"
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

						{{ t(`devicesModule.categories.channelsProperties.${scope.row.category}`) }}
					</el-link>
					<el-text
						v-else
						class="font-400! block! leading-4"
					>
						{{ t(`devicesModule.categories.channelsProperties.${scope.row.category}`) }}
					</el-text>
				</template>
				<template v-else>
					<el-link
						v-if="props.withFilters"
						:type="innerFilters.categories.includes(scope.row.category) ? 'danger' : undefined"
						underline="never"
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

						{{ t(`devicesModule.categories.channelsProperties.${scope.row.category}`) }}
					</el-link>
					<el-text
						v-else
						class="font-400!"
					>
						{{ t(`devicesModule.categories.channelsProperties.${scope.row.category}`) }}
					</el-text>
				</template>
			</template>
		</el-table-column>

		<el-table-column
			v-if="props.withChannelColumn"
			:label="t('devicesModule.table.channelsProperties.columns.channel.title')"
			prop="channel"
			:min-width="150"
		>
			<template #default="scope">
				<channels-properties-table-column-channel
					:property="scope.row"
					:filters="innerFilters"
					:with-filters="props.withFilters"
					@filter-by="(value: IChannel['id'], add: boolean) => onFilterBy('channel', value, add)"
				/>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModule.table.channelsProperties.columns.permissions.title')"
			prop="permissions"
			:min-width="180"
		>
			<template #default="scope">
				<el-space
					:spacer="spacer"
					direction="horizontal"
				>
					<template v-if="props.withFilters">
						<el-link
							v-for="(permission, index) of scope.row.permissions"
							:key="`filter-${index}`"
							:type="innerFilters.permissions.includes(permission) ? 'danger' : undefined"
							underline="never"
							@click.stop="onFilterBy('permission', permission, !innerFilters.permissions.includes(permission))"
						>
							<el-icon class="el-icon--left">
								<icon
									v-if="innerFilters.permissions.includes(permission)"
									icon="mdi:filter-minus"
								/>
								<icon
									v-else
									icon="mdi:filter-plus"
								/>
							</el-icon>

							{{ t(`devicesModule.permissions.${permission}`) }}
						</el-link>
					</template>
					<template v-else>
						<el-text
							v-for="(permission, index) of scope.row.permissions"
							:key="`no-filter-${index}`"
						>
							{{ t(`devicesModule.permissions.${permission}`) }}
						</el-text>
					</template>
				</el-space>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModule.table.channelsProperties.columns.dataType.title')"
			prop="dataType"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="180"
		>
			<template #default="scope">
				<channels-properties-table-column-data-type
					:property="scope.row"
					:filters="innerFilters"
					:with-filters="props.withFilters"
					@filter-by="(value: DevicesModuleChannelPropertyData_type, add: boolean) => onFilterBy('dataType', value, add)"
				/>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModule.table.channelsProperties.columns.value.title')"
			prop="value"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="150"
		>
			<template #default="scope">
				<channels-properties-table-column-value :property="scope.row" />
			</template>
		</el-table-column>

		<el-table-column
			:width="100"
			align="right"
		>
			<template #default="scope">
				<el-button
					size="small"
					plain
					data-test-id="edit-property"
					@click.stop="emit('edit', scope.row.id)"
				>
					<template #icon>
						<icon icon="mdi:pencil" />
					</template>
				</el-button>
				<el-button
					size="small"
					type="warning"
					data-test-id="remove-property"
					plain
					class="ml-1!"
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
import { computed, h } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDivider, ElIcon, ElLink, ElResult, ElSpace, ElTable, ElTableColumn, ElText, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { IconWithChild, useBreakpoints } from '../../../../common';
import {
	DevicesModuleChannelPropertyCategory,
	type DevicesModuleChannelPropertyData_type,
	DevicesModuleChannelPropertyPermissions,
} from '../../../../openapi.constants';
import type { IChannelsPropertiesFilter } from '../../composables/types';
import type { IChannelProperty } from '../../store/channels.properties.store.types';
import type { IChannel } from '../../store/channels.store.types';
import type { IDevice } from '../../store/devices.store.types';

import ChannelsPropertiesTableColumnChannel from './channels-properties-table-column-channel.vue';
import ChannelsPropertiesTableColumnDataType from './channels-properties-table-column-data-type.vue';
import ChannelsPropertiesTableColumnIcon from './channels-properties-table-column-icon.vue';
import ChannelsPropertiesTableColumnValue from './channels-properties-table-column-value.vue';
import type { IChannelsPropertiesTableProps } from './channels-properties-table.types';

defineOptions({
	name: 'ChannelsPropertiesTable',
});

const props = withDefaults(defineProps<IChannelsPropertiesTableProps>(), {
	withChannelColumn: false,
	withFilters: true,
});

const emit = defineEmits<{
	(e: 'edit', id: IChannelProperty['id']): void;
	(e: 'remove', id: IChannelProperty['id']): void;
	(e: 'reset-filters'): void;
	(e: 'selected-changes', selected: IChannel[]): void;
	(e: 'update:filters', filters: IChannelsPropertiesFilter): void;
	(e: 'update:sort-by', by: 'name' | 'category' | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
}>();

const { t } = useI18n();

const { isMDDevice } = useBreakpoints();

const noResults = computed<boolean>((): boolean => props.totalRows === 0);

const innerFilters = useVModel(props, 'filters', emit);

const spacer = h(ElDivider, { direction: 'vertical' });

const onSortData = ({ prop, order }: { prop: 'name' | 'category'; order: 'ascending' | 'descending' | null }): void => {
	emit('update:sort-by', prop);
	emit('update:sort-dir', order === 'descending' ? 'desc' : order === 'ascending' ? 'asc' : null);
};

const onSelectionChange = (selected: IChannel[]): void => {
	emit('selected-changes', selected);
};

const onFilterBy = (column: string, data: string, add?: boolean): void => {
	if (column === 'channel') {
		let filteredChannels = innerFilters.value.channels;

		if (add === true) {
			filteredChannels.push(data as IDevice['id']);
		} else {
			filteredChannels = innerFilters.value.channels.filter((item) => item !== data);
		}

		innerFilters.value.channels = Array.from(new Set(filteredChannels));
	} else if (column === 'category') {
		let filteredCategories = innerFilters.value.categories;

		if (add === true) {
			filteredCategories.push(data as DevicesModuleChannelPropertyCategory);
		} else {
			filteredCategories = innerFilters.value.categories.filter((item) => item !== data);
		}

		innerFilters.value.categories = Array.from(new Set(filteredCategories));
	} else if (column === 'permission') {
		let filteredPermissions = innerFilters.value.permissions;

		if (add === true) {
			filteredPermissions.push(data as DevicesModuleChannelPropertyPermissions);
		} else {
			filteredPermissions = innerFilters.value.permissions.filter((item) => item !== data);
		}

		innerFilters.value.permissions = Array.from(new Set(filteredPermissions));
	} else if (column === 'dataType') {
		let filteredDataTypes = innerFilters.value.dataTypes;

		if (add === true) {
			filteredDataTypes.push(data as DevicesModuleChannelPropertyData_type);
		} else {
			filteredDataTypes = innerFilters.value.dataTypes.filter((item) => item !== data);
		}

		innerFilters.value.dataTypes = Array.from(new Set(filteredDataTypes));
	}
};
</script>
