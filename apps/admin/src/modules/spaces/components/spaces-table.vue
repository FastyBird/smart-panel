<template>
	<el-table
		v-loading="props.loading"
		:element-loading-text="t('spacesModule.texts.loadingSpaces')"
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
								<icon icon="mdi:home-group" />
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
								<icon icon="mdi:home-group" />
							</template>
							<template #secondary>
								<icon icon="mdi:information" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						{{ t('spacesModule.texts.noSpaces') }}
					</template>

					<template #sub-title>
						<el-button
							type="primary"
							@click="emit('add')"
						>
							{{ t('spacesModule.buttons.add.title') }}
						</el-button>
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
								<icon icon="mdi:home-group" />
							</template>
							<template #secondary>
								<icon icon="mdi:filter-multiple" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						<el-text class="block">
							{{ t('spacesModule.texts.noFilteredSpaces') }}
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

							{{ t('spacesModule.buttons.resetFilters.title') }}
						</el-button>
					</template>
				</el-result>
			</div>
		</template>

		<el-table-column
			:width="60"
			align="center"
		>
			<template #default="scope">
				<el-icon
					v-if="scope.row.icon"
					:size="24"
				>
					<icon :icon="scope.row.icon" />
				</el-icon>
				<el-icon
					v-else
					:size="24"
				>
					<icon :icon="scope.row.type === 'room' ? 'mdi:door' : 'mdi:home-floor-1'" />
				</el-icon>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('spacesModule.table.columns.name')"
			prop="name"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="200"
			class-name="py-0!"
		>
			<template #default="scope">
				<strong class="block">{{ scope.row.name }}</strong>
				<el-text
					v-if="scope.row.description"
					size="small"
					class="block leading-4"
					truncated
				>
					{{ scope.row.description }}
				</el-text>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('spacesModule.table.columns.type')"
			prop="type"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="120"
		>
			<template #default="scope">
				<el-tag
					:type="scope.row.type === 'room' ? 'primary' : 'info'"
					size="small"
				>
					{{ t(`spacesModule.misc.types.${scope.row.type}`) }}
				</el-tag>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('spacesModule.table.columns.order')"
			prop="displayOrder"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="100"
			align="center"
		>
			<template #default="scope">
				{{ scope.row.displayOrder }}
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
					data-test-id="detail-space"
					@click.stop="emit('detail', scope.row.id)"
				>
					<template #icon>
						<icon icon="mdi:file-search-outline" />
					</template>

					{{ t('spacesModule.buttons.detail.title') }}
				</el-button>
				<el-button
					size="small"
					plain
					class="ml-1!"
					data-test-id="edit-space"
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
					data-test-id="remove-space"
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

import { ElButton, ElIcon, ElResult, ElTable, ElTableColumn, ElTag, ElText, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { IconWithChild } from '../../../common';
import type { ISpace } from '../store/spaces.store.types';

import type { ISpacesTableProps } from './spaces-table.types';

defineOptions({
	name: 'SpacesTable',
});

const props = defineProps<ISpacesTableProps>();

const emit = defineEmits<{
	(e: 'detail', id: ISpace['id']): void;
	(e: 'edit', id: ISpace['id']): void;
	(e: 'remove', id: ISpace['id']): void;
	(e: 'add'): void;
	(e: 'reset-filters'): void;
	(e: 'update:sort-by', by: 'name' | 'type' | 'displayOrder' | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
}>();

const { t } = useI18n();

const noResults = computed<boolean>((): boolean => props.totalRows === 0);

const tableHeight = computed<number>((): number => props.tableHeight ?? 400);

const onSortData = ({
	prop,
	order,
}: {
	prop: 'name' | 'type' | 'displayOrder';
	order: 'ascending' | 'descending' | null;
}): void => {
	emit('update:sort-by', prop);
	emit('update:sort-dir', order === 'descending' ? 'desc' : order === 'ascending' ? 'asc' : null);
};

const onRowClick = (row: ISpace): void => {
	emit('detail', row.id);
};
</script>
