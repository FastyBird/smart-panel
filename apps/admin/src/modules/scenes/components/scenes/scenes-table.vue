<template>
	<el-table
		v-loading="props.loading"
		:element-loading-text="t('scenes.texts.loadingScenes')"
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
			<div
				v-if="props.loading"
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:play-circle" />
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
								<icon icon="mdi:play-circle" />
							</template>
							<template #secondary>
								<icon icon="mdi:information" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						{{ t('scenes.texts.noScenes') }}
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
								<icon icon="mdi:play-circle" />
							</template>
							<template #secondary>
								<icon icon="mdi:filter-multiple" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						<el-text class="block">
							{{ t('scenes.texts.noFilteredScenes') }}
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

							{{ t('scenes.buttons.resetFilters.title') }}
						</el-button>
					</template>
				</el-result>
			</div>
		</template>

		<el-table-column
			v-if="isMDDevice"
			type="selection"
			fixed
			:width="30"
		/>

		<el-table-column
			:width="60"
			align="center"
		>
			<template #default="scope">
				<scenes-table-column-icon :scene="scope.row" />
			</template>
		</el-table-column>

		<el-table-column
			:label="t('scenes.fields.name')"
			prop="name"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="180"
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
			:label="t('scenes.fields.space')"
			prop="primarySpaceId"
			:width="200"
		>
			<template #default="scope">
				<el-link
					:type="isSpaceFilterActive(scope.row.primarySpaceId) ? 'danger' : undefined"
					underline="never"
					class="font-400!"
					@click.stop="onFilterBySpace(scope.row.primarySpaceId)"
				>
					<el-icon class="el-icon--left">
						<icon
							v-if="isSpaceFilterActive(scope.row.primarySpaceId)"
							icon="mdi:filter-minus"
						/>
						<icon
							v-else
							icon="mdi:filter-plus"
						/>
					</el-icon>
					{{ getSpaceName(scope.row.primarySpaceId) }}
				</el-link>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('scenes.fields.category')"
			prop="category"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="140"
		>
			<template #default="scope">
				<el-tag :type="getCategoryType(scope.row.category)">
					{{ t(`scenes.categories.${scope.row.category}`) }}
				</el-tag>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('scenes.fields.enabled')"
			prop="enabled"
			:width="110"
		>
			<template #default="scope">
				<el-link
					:type="innerFilters.enabled === (scope.row.enabled ? 'enabled' : 'disabled') ? 'danger' : undefined"
					underline="never"
					class="font-400!"
					@click.stop="onFilterByEnabled(scope.row.enabled)"
				>
					<el-icon class="el-icon--left">
						<icon
							v-if="innerFilters.enabled === (scope.row.enabled ? 'enabled' : 'disabled')"
							icon="mdi:filter-minus"
						/>
						<icon
							v-else
							icon="mdi:filter-plus"
						/>
					</el-icon>

					{{
						scope.row.enabled
							? t('scenes.filters.enabled.values.enabled')
							: t('scenes.filters.enabled.values.disabled')
					}}
				</el-link>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('scenes.fields.lastTriggered')"
			prop="lastTriggeredAt"
			:width="160"
		>
			<template #default="scope">
				<el-text v-if="scope.row.lastTriggeredAt" size="small">
					{{ formatDate(scope.row.lastTriggeredAt) }}
				</el-text>
				<el-text v-else size="small" type="info">
					{{ t('scenes.fields.neverTriggered') }}
				</el-text>
			</template>
		</el-table-column>

		<el-table-column
			:width="200"
			align="right"
		>
			<template #default="scope">
				<el-button
					v-if="scope.row.triggerable"
					size="small"
					type="success"
					plain
					:loading="props.triggering.includes(scope.row.id)"
					data-test-id="trigger-scene"
					@click.stop="emit('trigger', scope.row.id)"
				>
					<template #icon>
						<icon icon="mdi:play" />
					</template>
				</el-button>
				<el-button
					v-if="scope.row.editable"
					size="small"
					plain
					class="ml-1!"
					data-test-id="edit-scene"
					@click.stop="emit('edit', scope.row.id)"
				>
					<template #icon>
						<icon icon="mdi:pencil" />
					</template>
				</el-button>
				<el-button
					v-if="scope.row.editable"
					size="small"
					type="warning"
					plain
					class="ml-1!"
					data-test-id="remove-scene"
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
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElIcon, ElLink, ElResult, ElTable, ElTableColumn, ElTag, ElText, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { IconWithChild, useBreakpoints } from '../../../../common';
import { SceneCategory } from '../../scenes.constants';
import type { IScenesFilter } from '../../composables/types';
import type { IScene } from '../../store/scenes.store.types';

import ScenesTableColumnIcon from './scenes-table-column-icon.vue';
import type { IScenesTableProps } from './scenes-table.types';

defineOptions({
	name: 'ScenesTable',
});

const props = defineProps<IScenesTableProps>();

const emit = defineEmits<{
	(e: 'edit', id: IScene['id']): void;
	(e: 'remove', id: IScene['id']): void;
	(e: 'trigger', id: IScene['id']): void;
	(e: 'reset-filters'): void;
	(e: 'selected-changes', selected: IScene[]): void;
	(e: 'update:filters', filters: IScenesFilter): void;
	(e: 'update:sort-by', by: 'name' | 'category' | 'order' | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
}>();

const { t } = useI18n();

const { isMDDevice } = useBreakpoints();

// Inject spaces from parent (passed through provide)
const spaces = inject<{ value: Array<{ id: string; name: string }> }>('spaces', { value: [] });

const noResults = computed<boolean>((): boolean => props.totalRows === 0);

const innerFilters = useVModel(props, 'filters', emit);

const tableHeight = computed<number>(() => props.tableHeight);

const getCategoryType = (category: SceneCategory): 'success' | 'warning' | 'info' | 'primary' | 'danger' | undefined => {
	const typeMap: Record<SceneCategory, 'success' | 'warning' | 'info' | 'primary' | 'danger' | undefined> = {
		[SceneCategory.GENERIC]: undefined,
		[SceneCategory.LIGHTING]: 'warning',
		[SceneCategory.CLIMATE]: 'info',
		[SceneCategory.MEDIA]: 'primary',
		[SceneCategory.WORK]: undefined,
		[SceneCategory.RELAX]: 'success',
		[SceneCategory.NIGHT]: 'info',
		[SceneCategory.MORNING]: 'warning',
		[SceneCategory.PARTY]: 'danger',
		[SceneCategory.MOVIE]: 'primary',
		[SceneCategory.AWAY]: undefined,
		[SceneCategory.HOME]: 'success',
		[SceneCategory.SECURITY]: 'danger',
		[SceneCategory.ENERGY]: 'warning',
		[SceneCategory.CUSTOM]: undefined,
	};
	return typeMap[category];
};

const getSpaceName = (primarySpaceId: string | null | undefined): string => {
	if (!primarySpaceId) {
		return t('scenes.fields.wholeHome');
	}
	const space = spaces.value.find((s) => s.id === primarySpaceId);
	return space?.name || t('scenes.fields.wholeHome');
};

const formatDate = (date: Date): string => {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(date);
};

const onSortData = ({
	prop,
	order,
}: {
	prop: 'name' | 'category' | 'order';
	order: 'ascending' | 'descending' | null;
}): void => {
	emit('update:sort-by', order === null ? undefined : prop);
	emit('update:sort-dir', order === 'descending' ? 'desc' : order === 'ascending' ? 'asc' : null);
};

const onSelectionChange = (selected: IScene[]): void => {
	emit('selected-changes', selected);
};

const onRowClick = (row: IScene): void => {
	if (row.editable) {
		emit('edit', row.id);
	}
};

const isSpaceFilterActive = (primarySpaceId: string | null | undefined): boolean => {
	const spaceFilter = primarySpaceId || 'whole_home';
	return innerFilters.value.primarySpaceId === spaceFilter;
};

const onFilterBySpace = (primarySpaceId: string | null | undefined): void => {
	const spaceFilter = primarySpaceId || 'whole_home';
	if (innerFilters.value.primarySpaceId === spaceFilter) {
		innerFilters.value.primarySpaceId = undefined;
	} else {
		innerFilters.value.primarySpaceId = spaceFilter;
	}
};

const onFilterByEnabled = (enabled: boolean): void => {
	const enabledValue = enabled ? 'enabled' : 'disabled';
	if (innerFilters.value.enabled === enabledValue) {
		innerFilters.value.enabled = 'all';
	} else {
		innerFilters.value.enabled = enabledValue;
	}
};
</script>

<style scoped>
.text-primary {
	color: var(--el-color-primary);
}

.text-success {
	color: var(--el-color-success);
}

.text-danger {
	color: var(--el-color-danger);
}
</style>
