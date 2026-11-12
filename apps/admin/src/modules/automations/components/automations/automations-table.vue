<template>
	<el-table
		v-loading="props.loading"
		:element-loading-text="t('automations.texts.loadingAutomations')"
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
								<icon :icon="AUTOMATION_DEFAULT_ICON" />
							</template>
							<template #secondary>
								<icon icon="mdi:database-refresh" />
							</template>
						</icon-with-child>
					</template>
				</el-result>
			</div>

			<div
				v-else-if="props.loadFailed"
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child
							type="danger"
							:size="80"
						>
							<template #primary>
								<icon :icon="AUTOMATION_DEFAULT_ICON" />
							</template>
							<template #secondary>
								<icon icon="mdi:alert-circle" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						<el-text class="block">
							{{ t('automations.texts.loadFailed') }}
						</el-text>

						<el-button
							type="primary"
							plain
							class="mt-4"
							data-test-id="retry-load"
							@click="emit('retry')"
						>
							<template #icon>
								<icon icon="mdi:refresh" />
							</template>

							{{ t('automations.buttons.retry.title') }}
						</el-button>
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
								<icon :icon="AUTOMATION_DEFAULT_ICON" />
							</template>
							<template #secondary>
								<icon icon="mdi:information" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						{{ t('automations.texts.noAutomations') }}
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
								<icon :icon="AUTOMATION_DEFAULT_ICON" />
							</template>
							<template #secondary>
								<icon icon="mdi:filter-multiple" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						<el-text class="block">
							{{ t('automations.texts.noFilteredAutomations') }}
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

							{{ t('automations.buttons.resetFilters.title') }}
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
				<el-avatar :size="32">
					<icon
						:icon="scope.row.icon ?? AUTOMATION_DEFAULT_ICON"
						class="w[20px] h[20px]"
					/>
				</el-avatar>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('automations.fields.name')"
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
			:label="t('automations.fields.space')"
			prop="spaceId"
			:width="200"
		>
			<template #default="scope">
				<el-link
					:type="isSpaceFilterActive(scope.row.spaceId) ? 'danger' : undefined"
					underline="never"
					class="font-400!"
					@click.stop="onFilterBySpace(scope.row.spaceId)"
				>
					<el-icon class="el-icon--left">
						<icon
							v-if="isSpaceFilterActive(scope.row.spaceId)"
							icon="mdi:filter-minus"
						/>
						<icon
							v-else
							icon="mdi:filter-plus"
						/>
					</el-icon>
					{{ getSpaceLabel(scope.row.spaceId) }}
				</el-link>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('automations.fields.enabled')"
			prop="enabled"
			:width="100"
			align="center"
		>
			<template #default="scope">
				<!-- The switch follows the store: it moves once the backend has accepted the change -->
				<div @click.stop>
					<el-switch
						:model-value="scope.row.enabled"
						:loading="props.updating.includes(scope.row.id)"
						:aria-label="t('automations.aria.enabled', { automation: scope.row.name })"
						data-test-id="toggle-automation"
						@change="(value: string | number | boolean): void => emit('toggle-enabled', scope.row.id, value === true)"
					/>
				</div>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('automations.fields.status')"
			prop="status"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="140"
		>
			<template #default="scope">
				<el-tooltip
					:content="t(`automations.statuses.${scope.row.status}.description`)"
					placement="top"
				>
					<el-tag
						:type="AUTOMATION_STATUS_COLORS[scope.row.status as AutomationStatus]"
						data-test-id="automation-status"
					>
						{{ t(`automations.statuses.${scope.row.status}.title`) }}
					</el-tag>
				</el-tooltip>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('automations.fields.lastRun')"
			prop="lastTriggeredAt"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="200"
		>
			<template #default="scope">
				<template v-if="scope.row.lastTriggeredAt">
					<el-text
						size="small"
						class="block"
					>
						{{ formatDate(scope.row.lastTriggeredAt) }}
					</el-text>
					<el-text
						v-if="scope.row.lastRunStatus"
						size="small"
						:type="AUTOMATION_RUN_STATUS_COLORS[scope.row.lastRunStatus as AutomationRunStatus]"
						class="block leading-4"
					>
						{{ t(`automations.runStatuses.${scope.row.lastRunStatus}`) }}
					</el-text>
				</template>
				<el-text
					v-else
					size="small"
					type="info"
				>
					{{ t('automations.fields.neverRun') }}
				</el-text>
			</template>
		</el-table-column>

		<el-table-column
			:width="160"
			align="right"
		>
			<template #default="scope">
				<el-tooltip
					:content="t('automations.buttons.flow.title')"
					placement="top"
				>
					<el-button
						size="small"
						type="primary"
						plain
						:aria-label="t('automations.aria.flow', { automation: scope.row.name })"
						data-test-id="flow-automation"
						@click.stop="emit('flow', scope.row.id)"
					>
						<template #icon>
							<icon :icon="AUTOMATION_FLOW_ICON" />
						</template>
					</el-button>
				</el-tooltip>
				<el-button
					size="small"
					plain
					class="ml-1!"
					:aria-label="t('automations.aria.edit', { automation: scope.row.name })"
					data-test-id="edit-automation"
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
					:aria-label="t('automations.aria.remove', { automation: scope.row.name })"
					data-test-id="remove-automation"
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

import { ElAvatar, ElButton, ElIcon, ElLink, ElResult, ElSwitch, ElTable, ElTableColumn, ElTag, ElText, ElTooltip, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { IconWithChild } from '../../../../common';
import {
	AUTOMATION_DEFAULT_ICON,
	AUTOMATION_FLOW_ICON,
	AUTOMATION_RUN_STATUS_COLORS,
	AUTOMATION_STATUS_COLORS,
	type AutomationRunStatus,
	type AutomationStatus,
	WHOLE_HOME_SPACE_FILTER,
} from '../../automations.constants';
import type { AutomationsSortBy, IAutomationsFilter } from '../../composables/types';
import { useAutomationSpaces } from '../../composables/useAutomationSpaces';
import type { IAutomation } from '../../store/automations.store.types';

import type { IAutomationsTableProps } from './automations-table.types';

defineOptions({
	name: 'AutomationsTable',
});

const props = defineProps<IAutomationsTableProps>();

const emit = defineEmits<{
	(e: 'edit', id: IAutomation['id']): void;
	(e: 'flow', id: IAutomation['id']): void;
	(e: 'remove', id: IAutomation['id']): void;
	(e: 'toggle-enabled', id: IAutomation['id'], enabled: boolean): void;
	(e: 'reset-filters'): void;
	(e: 'retry'): void;
	(e: 'update:filters', filters: IAutomationsFilter): void;
	(e: 'update:sort-by', by: AutomationsSortBy | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
}>();

const { t, locale } = useI18n();

const { getSpaceName } = useAutomationSpaces();

const noResults = computed<boolean>((): boolean => props.totalRows === 0);

const innerFilters = useVModel(props, 'filters', emit);

const tableHeight = computed<number>(() => props.tableHeight);

// "Whole home" is what an automation without a space belongs to; a space that cannot be named
// (not loaded, or gone) is still a space
const getSpaceLabel = (spaceId: IAutomation['spaceId']): string => {
	if (spaceId === null) {
		return t('automations.fields.wholeHome');
	}

	return getSpaceName(spaceId) ?? t('automations.fields.unknownSpace');
};

// In the language of the application, which is not always the one of the browser
const formatDate = (date: Date): string => {
	return new Intl.DateTimeFormat(locale.value, {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(date);
};

const onSortData = ({ prop, order }: { prop: AutomationsSortBy; order: 'ascending' | 'descending' | null }): void => {
	emit('update:sort-by', order === null ? undefined : prop);
	emit('update:sort-dir', order === 'descending' ? 'desc' : order === 'ascending' ? 'asc' : null);
};

const onRowClick = (row: IAutomation): void => {
	emit('edit', row.id);
};

const isSpaceFilterActive = (spaceId: IAutomation['spaceId']): boolean => {
	return innerFilters.value.spaceId === (spaceId ?? WHOLE_HOME_SPACE_FILTER);
};

const onFilterBySpace = (spaceId: IAutomation['spaceId']): void => {
	const spaceFilter = spaceId ?? WHOLE_HOME_SPACE_FILTER;

	innerFilters.value.spaceId = innerFilters.value.spaceId === spaceFilter ? undefined : spaceFilter;
};
</script>
