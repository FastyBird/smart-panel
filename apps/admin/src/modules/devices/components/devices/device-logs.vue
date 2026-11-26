<template>
	<div class="h-full w-full flex flex-col">
		<!-- Filter bar (matches system logs layout) -->
		<el-card
			shadow="never"
			class="px-1 py-2 shrink-0"
			body-class="p-0!"
		>
			<div class="flex w-full items-center content-center">
				<div class="grow-1" />

				<el-switch
					v-model="innerLive"
					class="mr-6"
					:active-text="t('devicesModule.labels.liveTail')"
					:inactive-text="t('devicesModule.labels.paused')"
				/>

				<el-button
					plain
					class="px-2! mt-1 mr-1"
					@click="onRefresh"
				>
					<icon icon="mdi:refresh" />
				</el-button>
			</div>
		</el-card>

		<!-- Logs list card (the same rows as the system logs) -->
		<div class="flex-1 overflow-hidden flex flex-col">
			<el-card
				shadow="never"
				class="mt-2 flex flex-col"
				body-class="p-0! flex-1 overflow-hidden"
			>
				<el-scrollbar>
					<system-logs-list
						:items="logs"
						:loading="isLoading"
						:has-more="hasMore"
						:filters-active="false"
						@open="onLogDetail"
						@load-more="onLoadMore"
					/>
				</el-scrollbar>
			</el-card>
		</div>

		<!-- Log detail drawer -->
		<el-drawer
			v-model="detailVisible"
			:show-close="false"
			:with-header="false"
			direction="rtl"
			size="40%"
		>
			<app-bar-scope @close="selectedLog = null">
				<view-header
					:title="t('systemModule.headings.systemLogs.detail')"
					:subtitle="t('systemModule.subHeadings.systemLogs.detail')"
					icon="mdi:note-text-outline"
				/>

				<div class="flex flex-col overflow-hidden h-full">
					<el-scrollbar
						v-if="selectedLog"
						class="grow-1 p-2 tp:px-4"
					>
						<system-log-detail :system-log="selectedLog" />
					</el-scrollbar>
				</div>
			</app-bar-scope>
		</el-drawer>
	</div>
</template>

<script setup lang="ts">
import { type Ref, computed, onBeforeMount, ref, toRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElCard, ElDrawer, ElScrollbar, ElSwitch } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { AppBarScope, ViewHeader } from '../../../../common';
import { SystemLogDetail, SystemLogsList } from '../../../../modules/system';
import type { ILogEntry } from '../../../../modules/system/store/logs-entries.store.types';
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

const selectedLog = ref<ILogEntry | null>(null);
const detailVisible = computed<boolean>({
	get: () => selectedLog.value !== null,
	set: (val) => {
		if (!val) selectedLog.value = null;
	},
});

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

const onLogDetail = (id: ILogEntry['id']): void => {
	const log = logs.value.find((l) => l.id === id);

	if (log) {
		selectedLog.value = log;
	}
};

const onRefresh = (): void => {
	void doRefreshLogs();
};

const onLoadMore = (): void => {
	void doLoadMoreLogs();
};

// Only fetch on mount in standalone mode - in shared mode, parent already fetched
onBeforeMount(() => {
	if (!isSharedMode) {
		void doFetchLogs();
	}
});
</script>
