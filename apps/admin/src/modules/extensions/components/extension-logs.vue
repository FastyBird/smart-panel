<template>
	<div class="h-full w-full flex flex-col">
		<!-- Toolbar -->
		<div class="flex items-center justify-between p-2 border-b">
			<div class="flex items-center gap-2">
				<el-button
					size="small"
					@click="onRefresh"
				>
					<template #icon>
						<icon icon="mdi:refresh" />
					</template>
					{{ t('extensionsModule.buttons.refresh') }}
				</el-button>

				<el-switch
					v-model="innerLive"
					size="small"
					:active-text="t('extensionsModule.labels.live')"
				/>
			</div>

			<div class="flex items-center gap-2">
				<el-select
					v-model="filterLevels"
					size="small"
					class="w-[200px]!"
					clearable
					multiple
					collapse-tags
					collapse-tags-tooltip
					:placeholder="t('extensionsModule.texts.logs.allLevels')"
				>
					<el-option
						v-for="l in levels"
						:key="l"
						:label="t(`systemModule.levels.${l}`)"
						:value="l"
					/>
				</el-select>

				<el-select
					v-model="filterTimeRange"
					size="small"
					class="w-[140px]!"
				>
					<el-option
						v-for="preset in timeRangePresets"
						:key="preset.value"
						:label="preset.label"
						:value="preset.value"
					/>
				</el-select>

				<el-button
					v-if="filtersActive"
					size="small"
					@click="clearFilters"
				>
					<template #icon>
						<icon icon="mdi:filter-off" />
					</template>
					{{ t('extensionsModule.buttons.resetFilters.title') }}
				</el-button>
			</div>
		</div>

		<!-- Loading state -->
		<div
			v-if="!loaded && isLoading"
			class="flex-1 flex items-center justify-center"
		>
			<el-result>
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

		<!-- No filtered logs state -->
		<div
			v-else-if="filtersActive && logs.length === 0"
			class="flex-1 flex items-center justify-center"
		>
			<el-result>
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
					{{ t('extensionsModule.texts.logs.noFilteredLogs') }}
				</template>

				<template #sub-title>
					<el-button
						type="primary"
						plain
						class="mt-2"
						@click="clearFilters"
					>
						<template #icon>
							<icon icon="mdi:filter-off" />
						</template>
						{{ t('extensionsModule.buttons.resetFilters.title') }}
					</el-button>
				</template>
			</el-result>
		</div>

		<!-- No logs state -->
		<div
			v-else-if="logs.length === 0"
			class="flex-1 flex items-center justify-center"
		>
			<el-result>
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
					{{ t('extensionsModule.texts.logs.noLogs') }}
				</template>

				<template #sub-title>
					{{ t('extensionsModule.texts.logs.noLogsDescription') }}
				</template>
			</el-result>
		</div>

		<!-- Logs list -->
		<el-scrollbar
			v-else
			v-loading="isLoading && logs.length > 0"
			class="flex-1"
		>
			<div>
				<div
					v-for="log in logs"
					:key="log.id"
					class="px-3 py-2 border-b hover:bg-[var(--el-fill-color-light)] cursor-pointer"
					@click="selectedLog = log"
				>
					<div class="grid grid-cols-[140px_70px_1fr] gap-3 items-center">
						<span class="font-mono text-xs">
							<el-tooltip
								:content="formatFull(log.ts)"
								placement="top-start"
							>
								{{ formatRelative(log.ts) }}
							</el-tooltip>
						</span>

						<el-tag
							v-bind="levelTagProps(log.type)"
							size="small"
							class="justify-self-start"
						>
							{{ log.type }}
						</el-tag>

						<div class="truncate text-sm">
							{{ log.message ?? t('extensionsModule.texts.logs.noMessage') }}
						</div>
					</div>
				</div>

				<!-- Load more button -->
				<div class="py-3 text-center">
					<span
						v-if="!hasMore"
						class="text-xs text-gray-400"
					>
						{{ t('extensionsModule.texts.logs.noMoreEntries') }}
					</span>

					<el-button
						v-if="hasMore"
						:loading="isLoading"
						@click="onLoadMore"
					>
						<template #icon>
							<icon icon="mdi:chevron-down" />
						</template>
						{{ t('extensionsModule.buttons.loadMore') }}
					</el-button>
				</div>
			</div>
		</el-scrollbar>

		<!-- Log detail drawer -->
		<el-drawer
			v-model="detailVisible"
			:show-close="false"
			:with-header="false"
			direction="rtl"
			size="40%"
		>
			<div class="flex flex-col h-full">
				<app-bar menu-button-hidden>
					<template #title>
						{{ t('extensionsModule.texts.logs.detail') }}
					</template>

					<template #button-right>
						<app-bar-button
							:align="AppBarButtonAlign.RIGHT"
							class="mr-2"
							@click="selectedLog = null"
						>
							<template #icon>
								<el-icon>
									<icon icon="mdi:close" />
								</el-icon>
							</template>
						</app-bar-button>
					</template>
				</app-bar>

				<el-scrollbar class="grow-1">
					<div class="p-2 md:px-4">
						<system-log-detail
							v-if="selectedLog"
							:system-log="selectedLog"
						/>
					</div>
				</el-scrollbar>
			</div>
		</el-drawer>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, type Ref, toRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDrawer, ElIcon, ElOption, ElResult, ElScrollbar, ElSelect, ElSwitch, ElTag, ElTooltip, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';
import { formatTimeAgo, useVModel } from '@vueuse/core';

import { AppBar, AppBarButton, AppBarButtonAlign, IconWithChild } from '../../../common';
import { SystemModuleLogEntryType } from '../../../openapi.constants';
import { SystemLogDetail } from '../../../modules/system';
import type { ILogEntry } from '../../../modules/system/store/logs-entries.store.types';
import { type TimeRangePreset, useExtensionLogs } from '../composables/useExtensionLogs';

import type { IExtensionLogsProps } from './extension-logs.types';

defineOptions({
	name: 'ExtensionLogs',
});

const props = defineProps<IExtensionLogsProps>();

const emit = defineEmits<{
	(e: 'update:live', live: boolean): void;
}>();

const { t } = useI18n();

const { logs, hasMore, isLoading, loaded, live, filterLevels, filterTimeRange, filtersActive, clearFilters, fetchLogs, loadMoreLogs, refreshLogs } =
	useExtensionLogs({
		extensionType: toRef(() => props.extensionType),
	});

const innerLive: Ref<boolean> = useVModel(props, 'live', emit, { defaultValue: false });

const selectedLog = ref<ILogEntry | null>(null);
const detailVisible = computed<boolean>({
	get: () => selectedLog.value !== null,
	set: (val) => {
		if (!val) selectedLog.value = null;
	},
});

const levels = [
	SystemModuleLogEntryType.error,
	SystemModuleLogEntryType.warn,
	SystemModuleLogEntryType.info,
	SystemModuleLogEntryType.debug,
	SystemModuleLogEntryType.fatal,
	SystemModuleLogEntryType.log,
	SystemModuleLogEntryType.success,
	SystemModuleLogEntryType.fail,
];

const timeRangePresets = computed<{ value: TimeRangePreset; label: string }[]>(() => [
	{ value: 'all', label: t('extensionsModule.texts.logs.timeRange.all') },
	{ value: '1h', label: t('extensionsModule.texts.logs.timeRange.1h') },
	{ value: '6h', label: t('extensionsModule.texts.logs.timeRange.6h') },
	{ value: '24h', label: t('extensionsModule.texts.logs.timeRange.24h') },
	{ value: '7d', label: t('extensionsModule.texts.logs.timeRange.7d') },
]);

// Sync live state between parent prop and composable
watch(
	innerLive,
	(val) => {
		live.value = val;
	},
	{ immediate: true }
);

watch(live, (val) => {
	innerLive.value = val;
});

const onRefresh = (): void => {
	void refreshLogs();
};

const onLoadMore = (): void => {
	void loadMoreLogs();
};

const formatRelative = (iso: string): string => {
	return formatTimeAgo(new Date(iso));
};

const formatFull = (iso: string): string => {
	return new Date(iso).toISOString();
};

const levelTagProps = (lvl: SystemModuleLogEntryType) => {
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

onBeforeMount(() => {
	void fetchLogs();
});
</script>
