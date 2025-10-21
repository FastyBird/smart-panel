<template>
	<div
		v-if="items.length === 0 && props.loading"
		class="h-full w-full leading-normal"
	>
		<el-result class="h-full w-full">
			<template #icon>
				<icon-with-child :size="80">
					<template #primary>
						<icon icon="mdi:console" />
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
						<icon icon="mdi:console" />
					</template>
					<template #secondary>
						<icon icon="mdi:information" />
					</template>
				</icon-with-child>
			</template>

			<template #title>
				{{ t('systemModule.texts.systemLogs.noLogs') }}
			</template>
		</el-result>
	</div>

	<el-result
		v-else-if="items.length === 0 && props.filtersActive && !props.loading"
		class="h-full w-full"
	>
		<template #icon>
			<icon-with-child :size="80">
				<template #primary>
					<icon icon="mdi:console" />
				</template>
				<template #secondary>
					<icon icon="mdi:filter-multiple" />
				</template>
			</icon-with-child>
		</template>

		<template #title>
			<el-text class="block">
				{{ t('systemModule.texts.systemLogs.noFilteredLogs') }}
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

				{{ t('systemModule.buttons.resetFilters.title') }}
			</el-button>
		</template>
	</el-result>

	<div
		v-else
		:class="[ns.b()]"
	>
		<div
			v-for="e in items"
			:key="e.id"
			class="px-3 py-2 border-b hover:bg-gray-50 cursor-pointer"
			@click="() => onRowClick(e)"
		>
			<div class="grid grid-cols-[160px_80px_80px_1fr] md:grid-cols-[160px_80px_80px_1fr] gap-3 items-center">
				<span class="font-mono text-xs">
					<el-tooltip
						class="box-item"
						effect="dark"
						:content="formatFull(e.ts)"
						placement="top-start"
					>
						{{ formatRelative(e.ts) }}
					</el-tooltip>
				</span>

				<el-tag
					v-bind="levelTagProps(e.type)"
					size="small"
					class="justify-self-start"
				>
					{{ e.type }}
				</el-tag>

				<el-tag
					size="small"
					effect="plain"
					class="justify-self-start"
				>
					{{ e.source }}
				</el-tag>

				<div class="truncate">
					<span
						v-if="e.tag"
						class="text-gray-500"
					>
						[{{ e.tag }}]
					</span>
					<span class="ml-1">{{ e.message ?? t('systemModule.texts.systemLogs.noMessage') }}</span>
				</div>
			</div>
		</div>

		<div class="py-3 text-center">
			<span
				v-if="!hasMore"
				class="text-xs text-gray-400"
			>
				{{ t('systemModule.texts.systemLogs.noMoreEntries') }}
			</span>

			<el-button
				v-if="hasMore"
				:loading="loading"
				@click="emit('load-more')"
			>
				<template #icon>
					<icon icon="mdi:chevron-down" />
				</template>
				{{ t('systemModule.buttons.loadMore.title') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElResult, ElTag, ElText, ElTooltip, useNamespace } from 'element-plus';

import { Icon } from '@iconify/vue';
import { formatTimeAgo } from '@vueuse/core';

import { IconWithChild } from '../../../../common';
import { ConfigModuleSystemLog_levels } from '../../../../openapi';
import type { ILogEntry } from '../../store/logs-entries.store.types';

import type { ISystemLogsTableProps } from './system-logs-table.types';

defineOptions({
	name: 'SystemLogsTable',
});

const props = defineProps<ISystemLogsTableProps>();

const emit = defineEmits<{
	(e: 'detail', id: ILogEntry['id']): void;
	(e: 'reset-filters'): void;
	(e: 'load-more'): void;
}>();

const ns = useNamespace('system-logs-table');
const { t } = useI18n();

const noResults = computed<boolean>((): boolean => props.items.length === 0 && !props.hasMore);

const onRowClick = (row: ILogEntry): void => {
	emit('detail', row.id);
};

const formatRelative = (iso: string): string => {
	return formatTimeAgo(new Date(iso));
};

const formatFull = (iso: string): string => {
	return new Date(iso).toISOString();
};

const levelTagProps = (lvl: ConfigModuleSystemLog_levels) => {
	const s = lvl.toLowerCase();

	if (['fatal', 'error', 'fail'].includes(s)) {
		return { type: 'danger' as const, effect: 'light' as const };
	}

	if (['warn', 'box'].includes(s)) {
		return { type: 'warning' as const, effect: 'light' as const };
	}

	if (['success', 'ready', 'start', 'info', 'log'].includes(s)) {
		return { type: 'success' as const, effect: 'light' as const };
	}

	return {
		effect: 'plain' as const,
		class: 'tag-neutral',
	};
};
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'system-logs-table.scss';
</style>
