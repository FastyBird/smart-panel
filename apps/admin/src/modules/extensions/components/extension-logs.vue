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
	</div>
</template>

<script setup lang="ts">
import { onBeforeMount, type Ref, toRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElResult, ElScrollbar, ElSwitch, ElTag, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';
import { formatTimeAgo, useVModel } from '@vueuse/core';

import { IconWithChild } from '../../../common';
import { SystemModuleLogEntryType } from '../../../openapi.constants';
import { useExtensionLogs } from '../composables/useExtensionLogs';

import type { IExtensionLogsProps } from './extension-logs.types';

defineOptions({
	name: 'ExtensionLogs',
});

const props = defineProps<IExtensionLogsProps>();

const emit = defineEmits<{
	(e: 'update:live', live: boolean): void;
}>();

const { t } = useI18n();

const { logs, hasMore, isLoading, live, fetchLogs, loadMoreLogs, refreshLogs } = useExtensionLogs({
	extensionType: toRef(() => props.extensionType),
});

const innerLive: Ref<boolean> = useVModel(props, 'live', emit, { defaultValue: false });

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
