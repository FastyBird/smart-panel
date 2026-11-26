<template>
	<state-view
		v-if="props.items.length === 0 && props.failed && !props.loading"
		kind="error"
		icon="mdi:console"
		:title="t('systemModule.texts.systemLogs.loadError')"
		data-test-id="system-logs-error"
	>
		<template #action>
			<el-button
				plain
				@click="emit('retry')"
			>
				{{ t('systemModule.buttons.retry.title') }}
			</el-button>
		</template>
	</state-view>

	<state-view
		v-else-if="props.items.length === 0 && props.loading"
		kind="loading"
		icon="mdi:console"
		:title="t('systemModule.texts.systemLogs.loadingLogs')"
	/>

	<state-view
		v-else-if="props.items.length === 0 && props.filtersActive"
		kind="empty"
		icon="mdi:filter-off-outline"
		:title="t('systemModule.texts.systemLogs.noFilteredLogs')"
		data-test-id="system-logs-no-matches"
	>
		<template #action>
			<el-button
				plain
				@click="emit('reset-filters')"
			>
				{{ t('systemModule.buttons.resetFilters.title') }}
			</el-button>
		</template>
	</state-view>

	<state-view
		v-else-if="props.items.length === 0 && !props.hasMore"
		kind="empty"
		icon="mdi:console"
		:title="t('systemModule.texts.systemLogs.noLogs')"
		data-test-id="system-logs-empty"
	/>

	<!-- A chronological feed, newest first, so it pages with Load more -->
	<div
		v-else
		class="flex flex-col"
	>
		<ul
			:aria-label="t('systemModule.headings.systemLogs.list')"
			class="flex flex-col m-0 p-0 list-none"
			data-test-id="system-logs-list"
		>
			<li
				v-for="entry in props.items"
				:key="entry.id"
				class="border-b border-b-solid border-light"
			>
				<button
					type="button"
					:aria-current="props.activeId === entry.id ? 'true' : undefined"
					:class="[
						'flex flex-col gap-1 w-full px-4 py-2.5 border-0 text-left font-inherit cursor-pointer',
						props.activeId === entry.id ? 'bg-primary-soft' : 'bg-transparent hover:bg-fill-light',
					]"
					:data-entry-id="entry.id"
					data-test-id="system-logs-row"
					@click="emit('open', entry.id)"
				>
					<span class="flex items-center gap-2 min-w-0 w-full">
						<status-tag
							:status="logLevelStatus(entry.type)"
							:label="t(`systemModule.levels.${entry.type}`)"
						/>
						<span class="text-help truncate">{{ t(`systemModule.sources.${entry.source}`) }}</span>
						<span class="flex-1" />
						<time
							:datetime="entry.ts"
							:title="formatFull(entry.ts)"
							class="text-caption tabular-nums shrink-0"
						>
							{{ formatRelative(entry.ts) }}
						</time>
					</span>

					<span class="text-body line-clamp-2 break-words">
						<span
							v-if="entry.tag"
							class="text-secondary"
						>
							[{{ entry.tag }}]
						</span>
						{{ entry.message ?? t('systemModule.texts.systemLogs.noMessage') }}
					</span>
				</button>
			</li>
		</ul>

		<div class="flex justify-center py-3">
			<el-button
				v-if="props.hasMore"
				:loading="props.loading"
				data-test-id="system-logs-load-more"
				@click="emit('load-more')"
			>
				{{ t('systemModule.buttons.loadMore.title') }}
			</el-button>
			<span
				v-else
				class="text-caption"
			>
				{{ t('systemModule.texts.systemLogs.noMoreEntries') }}
			</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton } from 'element-plus';

import { formatTimeAgo } from '@vueuse/core';

import { StateView, StatusTag } from '../../../../common';
import type { ILogEntry } from '../../store/logs-entries.store.types';
import { logLevelStatus } from '../../utils/system.utils';

import type { ISystemLogsListProps } from './system-logs-list.types';

defineOptions({
	name: 'SystemLogsList',
});

const props = withDefaults(defineProps<ISystemLogsListProps>(), {
	activeId: null,
	failed: false,
});

const emit = defineEmits<{
	(e: 'open', id: ILogEntry['id']): void;
	(e: 'reset-filters'): void;
	(e: 'load-more'): void;
	(e: 'retry'): void;
}>();

const { t } = useI18n();

const formatRelative = (iso: string): string => formatTimeAgo(new Date(iso));

const formatFull = (iso: string): string => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(iso));
</script>
