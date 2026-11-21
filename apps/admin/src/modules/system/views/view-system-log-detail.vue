<template>
	<view-header
		:title="t('systemModule.headings.systemLogs.detail')"
		:subtitle="t('systemModule.subHeadings.systemLogs.detail')"
		icon="mdi:note-text-outline"
		@back="onClose"
	/>

	<app-breadcrumbs :items="breadcrumbs" />

	<div
		v-loading="isLoading || systemLog === null"
		:element-loading-text="t('systemModule.texts.systemLogs.loadingLogs')"
		class="flex flex-col overflow-hidden h-full"
	>
		<el-scrollbar
			v-if="systemLog !== null"
			class="grow-1 p-2 md:px-4"
		>
			<system-log-detail :system-log="systemLog" />
		</el-scrollbar>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElScrollbar, vLoading } from 'element-plus';

import { AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../common';
import { SystemLogDetail } from '../components/components';
import { useSystemLog } from '../composables/useSystemLog';
import type { ILogEntry } from '../store/logs-entries.store.types';
import { RouteNames } from '../system.constants';
import { SystemException } from '../system.exceptions';

import type { IViewSystemLogDetailProps } from './view-system-log-detail.types';

defineOptions({
	name: 'ViewSystemLogDetail',
});

const props = defineProps<IViewSystemLogDetailProps>();

const router = useRouter();
const { t } = useI18n();

const { isLGDevice } = useBreakpoints();

const { systemLog, isLoading } = useSystemLog({ id: props.id });

const mounted = ref<boolean>(false);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
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
		];
	}
);

const onClose = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.SYSTEM_LOGS,
		});
	} else {
		router.push({
			name: RouteNames.SYSTEM_LOGS,
		});
	}
};

onMounted((): void => {
	mounted.value = true;
});

watch(
	(): boolean => isLoading.value,
	(val: boolean): void => {
		if (!val && systemLog.value === null) {
			throw new SystemException('System log not found');
		}
	}
);

watch(
	(): ILogEntry | null => systemLog.value,
	(val: ILogEntry | null): void => {
		if (!isLoading.value && val === null) {
			throw new SystemException('System log not found');
		}
	}
);

useMeta({
	title: t('systemModule.meta.systemLogs.detail.title'),
});
</script>
