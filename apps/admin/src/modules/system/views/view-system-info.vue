<template>
	<div
		v-loading="isLoadingSystemInfo || isLoadingThrottleStatus || systemInfo === null"
		:element-loading-text="t('systemModule.texts.loadingSystemInfo')"
	>
		<system-info-detail
			:system-info="systemInfo"
			:throttle-status="throttleStatus"
		/>
	</div>
</template>

<script setup lang="ts">
import { onBeforeMount, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';

import { vLoading } from 'element-plus';

import { SystemInfoDetail } from '../components/components';
import { useSystemInfo, useThrottleStatus } from '../composables/composables';
import { SystemException } from '../system.exceptions';

defineOptions({
	name: 'ViewSystemInfo',
});

const { t } = useI18n();

const { systemInfo, fetchSystemInfo, isLoading: isLoadingSystemInfo } = useSystemInfo();
const { throttleStatus, fetchThrottleStatus, isLoading: isLoadingThrottleStatus } = useThrottleStatus();

onBeforeMount(async (): Promise<void> => {
	fetchSystemInfo().catch((error: unknown): void => {
		const err = error as Error;

		throw new SystemException('Something went wrong', err);
	});

	fetchThrottleStatus().catch((error: unknown): void => {
		const err = error as Error;

		throw new SystemException('Something went wrong', err);
	});
});

watch(
	(): boolean => isLoadingSystemInfo.value,
	(val: boolean): void => {
		if (!val && systemInfo.value === null) {
			throw new SystemException('Something went wrong');
		}
	}
);

useMeta({
	title: t('systemModule.meta.systemInfo.title'),
});
</script>
