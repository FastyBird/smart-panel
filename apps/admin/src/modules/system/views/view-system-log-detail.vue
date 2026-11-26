<template>
	<div
		class="flex flex-col flex-1 min-h-0"
		data-test-id="view-system-log-detail"
	>
		<!-- One log entry. In the logs' right pane from tablet landscape; below it its own page, with the header leading
		     back to the list. The logs, its parent route, read the entries -->
		<template v-if="!props.inPane">
			<app-breadcrumbs :items="breadcrumbs" />

			<view-header
				:title="t('systemModule.headings.systemLogs.detail')"
				:subtitle="t('systemModule.subHeadings.systemLogs.detail')"
				:back="backRoute"
				icon="mdi:note-text-outline"
			/>
		</template>

		<div :class="props.inPane ? 'flex flex-col flex-1 min-h-0' : 'page-pad flex flex-col flex-1 min-h-0 box-border'">
			<div :class="['flex flex-col flex-1 min-h-0 overflow-y-auto', props.inPane ? '' : 'bg-surface border border-solid border-light rounded-lg']">
				<div
					v-if="systemLog"
					class="p-4 tp:p-5"
				>
					<system-log-detail :system-log="systemLog" />
				</div>

				<state-view
					v-else-if="isLoading"
					kind="loading"
					icon="mdi:note-text-outline"
					:title="t('systemModule.texts.systemLogs.loadingLog')"
				/>

				<state-view
					v-else
					kind="not-found"
					icon="mdi:note-remove-outline"
					:title="t('systemModule.texts.systemLogs.logNotFound')"
					data-test-id="system-log-not-found"
				>
					<template #action>
						<el-button
							plain
							@click="router.push(backRoute)"
						>
							{{ t('systemModule.buttons.backToLogs.title') }}
						</el-button>
					</template>
				</state-view>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationRaw, useRoute, useRouter } from 'vue-router';

import { ElButton } from 'element-plus';

import { AppBreadcrumbs, StateView, ViewHeader } from '../../../common';
import { SystemLogDetail } from '../components/components';
import { useSystemLog } from '../composables/useSystemLog';
import { RouteNames } from '../system.constants';

import type { IViewSystemLogDetailProps } from './view-system-log-detail.types';

defineOptions({
	name: 'ViewSystemLogDetail',
});

const props = withDefaults(defineProps<IViewSystemLogDetailProps>(), {
	inPane: false,
});

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

// The parent keys this view by the id, so a new entry is a new instance
const { systemLog, isLoading } = useSystemLog({ id: props.id });

// The query carries the list's filters, so the list reads the same when the entry is left again
const backRoute = computed<RouteLocationRaw>((): RouteLocationRaw => ({ name: RouteNames.SYSTEM_LOGS, query: route.query }));

const breadcrumbs = computed<{ label: string; route: RouteLocationRaw }[]>((): { label: string; route: RouteLocationRaw }[] => [
	{
		label: t('systemModule.breadcrumbs.system.system'),
		route: router.resolve({ name: RouteNames.SYSTEM }),
	},
	{
		label: t('systemModule.breadcrumbs.systemLogs.list'),
		route: router.resolve({ name: RouteNames.SYSTEM_LOGS }),
	},
	{
		label: t('systemModule.breadcrumbs.systemLogs.detail'),
		route: router.resolve({ name: RouteNames.SYSTEM_LOG_DETAIL, params: { id: props.id } }),
	},
]);

useMeta({
	title: t('systemModule.meta.systemLogs.detail.title'),
});
</script>
