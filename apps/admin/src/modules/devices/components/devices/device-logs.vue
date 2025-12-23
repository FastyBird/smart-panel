<template>
	<div class="h-full w-full flex flex-col">
		<!-- Toolbar -->
		<div class="flex items-center justify-between p-2 border-b">
			<div class="flex items-center gap-2">
				<el-button
					size="small"
					:loading="isLoading"
					@click="onRefresh"
				>
					<template #icon>
						<icon icon="mdi:refresh" />
					</template>
					{{ t('devicesModule.buttons.refresh.title') }}
				</el-button>

				<el-switch
					v-model="innerLive"
					size="small"
					:active-text="t('devicesModule.labels.live')"
				/>
			</div>
		</div>

		<!-- Loading state -->
		<div
			v-if="logs.length === 0 && isLoading"
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

		<!-- No logs state -->
		<div
			v-else-if="logs.length === 0 && !isLoading"
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
					{{ t('devicesModule.texts.devices.logs.noLogs') }}
				</template>

				<template #sub-title>
					{{ t('devicesModule.texts.devices.logs.noLogsDescription') }}
				</template>
			</el-result>
		</div>

		<!-- Logs list -->
		<el-scrollbar
			v-else
			class="flex-1"
		>
			<div>
				<div
					v-for="log in logs"
					:key="log.id"
					class="px-3 py-2 border-b hover:bg-gray-50"
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
							{{ log.message ?? t('devicesModule.texts.devices.logs.noMessage') }}
						</div>
					</div>
				</div>

				<!-- Load more button -->
				<div class="py-3 text-center">
					<span
						v-if="!hasMore"
						class="text-xs text-gray-400"
					>
						{{ t('devicesModule.texts.devices.logs.noMoreEntries') }}
					</span>

					<el-button
						v-if="hasMore"
						:loading="isLoading"
						@click="onLoadMore"
					>
						<template #icon>
							<icon icon="mdi:chevron-down" />
						</template>
						{{ t('devicesModule.buttons.loadMore.title') }}
					</el-button>
				</div>
			</div>
		</el-scrollbar>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, type Ref, toRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElResult, ElScrollbar, ElSwitch, ElTag, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';
import { formatTimeAgo, useVModel } from '@vueuse/core';

import { IconWithChild } from '../../../../common';
import { SystemModuleLogEntryType } from '../../../../openapi.constants';
import { useDeviceLogs } from '../../composables/composables';

import type { IDeviceLogsProps } from './device-logs.types';

defineOptions({
	name: 'DeviceLogs',
});

const props = defineProps<IDeviceLogsProps>();

const emit = defineEmits<{
	(e: 'update:live', live: boolean): void;
}>();

const { t } = useI18n();

// Check if parent provided composable data (shared mode) or we need our own (standalone mode)
const isSharedMode = props.logs !== undefined;

// Create own composable only in standalone mode
const ownComposable = isSharedMode ? null : useDeviceLogs({ deviceId: toRef(() => props.deviceId) });

// Use props if provided, otherwise use own composable
const logs = computed(() => (isSharedMode ? props.logs!.value : ownComposable!.logs.value));
const hasMore = computed(() => (isSharedMode ? props.hasMore!.value : ownComposable!.hasMore.value));
const isLoading = computed(() => (isSharedMode ? props.isLoading!.value : ownComposable!.isLoading.value));
const live = isSharedMode ? props.liveRef! : ownComposable!.live;

const doRefreshLogs = (): Promise<void> => (isSharedMode ? props.refreshLogs!() : ownComposable!.refreshLogs());
const doLoadMoreLogs = (): Promise<void> => (isSharedMode ? props.loadMoreLogs!() : ownComposable!.loadMoreLogs());
const doFetchLogs = (): Promise<void> => (isSharedMode ? props.fetchLogs!() : ownComposable!.fetchLogs());

const innerLive: Ref<boolean> = useVModel(props, 'live', emit, { defaultValue: false });

// Sync live state between parent prop/v-model and composable's live ref
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
	void doRefreshLogs();
};

const onLoadMore = (): void => {
	void doLoadMoreLogs();
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

// Only fetch on mount in standalone mode - in shared mode, parent already fetched
onBeforeMount(() => {
	if (!isSharedMode) {
		void doFetchLogs();
	}
});
</script>
