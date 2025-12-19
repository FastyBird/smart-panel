<template>
	<el-table
		v-loading="props.loading"
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
		:max-height="tableHeight"
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
								<icon icon="mdi:puzzle" />
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
								<icon icon="mdi:puzzle" />
							</template>
							<template #secondary>
								<icon icon="mdi:information" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						{{ t('extensionsModule.texts.noExtensions') }}
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
								<icon icon="mdi:puzzle" />
							</template>
							<template #secondary>
								<icon icon="mdi:filter-multiple" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						<el-text class="block">
							{{ t('extensionsModule.texts.noFilteredExtensions') }}
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

							{{ t('extensionsModule.buttons.resetFilters.title') }}
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
				<el-avatar :size="32">
					<icon
						:icon="scope.row.kind === ExtensionKind.MODULE ? 'mdi:package-variant' : 'mdi:toy-brick'"
						class="w[20px] h[20px]"
					/>
				</el-avatar>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('extensionsModule.table.columns.name.title')"
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
			:label="t('extensionsModule.table.columns.type.title')"
			prop="type"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="200"
		>
			<template #default="scope">
				<el-tooltip
					:content="scope.row.type"
					placement="top"
					:show-after="500"
				>
					<el-text
						size="small"
						type="info"
						class="block max-w-[180px]"
						truncated
					>
						{{ scope.row.type }}
					</el-text>
				</el-tooltip>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('extensionsModule.table.columns.kind.title')"
			prop="kind"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="120"
		>
			<template #default="scope">
				<el-tag
					:type="scope.row.kind === ExtensionKind.MODULE ? 'primary' : 'success'"
					size="small"
				>
					{{ scope.row.kind === ExtensionKind.MODULE ? t('extensionsModule.labels.module') : t('extensionsModule.labels.plugin') }}
				</el-tag>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('extensionsModule.table.columns.version.title')"
			prop="version"
			:width="100"
		>
			<template #default="scope">
				<el-text
					v-if="scope.row.version"
					size="small"
				>
					{{ scope.row.version }}
				</el-text>
				<el-text
					v-else
					size="small"
					type="info"
				>
					-
				</el-text>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('extensionsModule.table.columns.core.title')"
			prop="isCore"
			:width="100"
		>
			<template #default="scope">
				<el-tag
					v-if="scope.row.isCore"
					type="warning"
					size="small"
				>
					{{ t('extensionsModule.labels.core') }}
				</el-tag>
				<el-tag
					v-else
					type="info"
					size="small"
				>
					{{ t('extensionsModule.labels.addon') }}
				</el-tag>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('extensionsModule.table.columns.enabled.title')"
			prop="enabled"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="120"
		>
			<template #default="scope">
				<el-switch
					:model-value="scope.row.enabled"
					:disabled="!scope.row.canToggleEnabled"
					size="small"
					@click.stop
					@change="(val: string | number | boolean) => onToggleEnabled(scope.row.type, val as boolean)"
				/>
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
					data-test-id="detail-extension"
					@click.stop="emit('detail', scope.row.type)"
				>
					<template #icon>
						<icon icon="mdi:file-search-outline" />
					</template>

					{{ t('extensionsModule.buttons.detail.title') }}
				</el-button>
			</template>
		</el-table-column>
	</el-table>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAvatar, ElButton, ElResult, ElSwitch, ElTable, ElTableColumn, ElTag, ElText, ElTooltip, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { IconWithChild, useBreakpoints } from '../../../common';
import { ExtensionKind } from '../extensions.constants';
import type { IExtension } from '../store/extensions.store.types';

import type { IExtensionsTableProps } from './extensions-table.types';

defineOptions({
	name: 'ExtensionsTable',
});

const props = defineProps<IExtensionsTableProps>();

const emit = defineEmits<{
	(e: 'detail', type: IExtension['type']): void;
	(e: 'toggle-enabled', type: IExtension['type'], enabled: boolean): void;
	(e: 'reset-filters'): void;
	(e: 'update:sort-by', by: 'name' | 'type' | 'kind' | 'enabled' | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
}>();

const { t } = useI18n();

const { isMDDevice } = useBreakpoints();

const noResults = computed<boolean>((): boolean => props.totalRows === 0);

const tableHeight = computed<number>(() => props.tableHeight ?? 400);

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const onSelectionChange = (selection: IExtension[]): void => {
	// Selection handling - can be extended for bulk operations
};
</script>
