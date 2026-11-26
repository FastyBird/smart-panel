<template>
	<!-- Template 5's one health banner: a power or temperature problem first, then an update waiting, else all well -->
	<el-alert
		:type="alertType"
		:title="title"
		:description="description"
		:closable="false"
		show-icon
		data-test-id="system-health-banner"
	/>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert } from 'element-plus';

import { useUpdateStatus } from '../../composables/composables';
import type { IThrottleStatus } from '../../store/throttle-status.store.types';
import { throttleProblems } from '../../utils/system.utils';

defineOptions({
	name: 'SystemHealthBanner',
});

const props = defineProps<{
	throttleStatus: IThrottleStatus | null;
}>();

const { t } = useI18n();

const { updateAvailable, latestVersion } = useUpdateStatus();

const problems = computed<(keyof IThrottleStatus)[]>(() => throttleProblems(props.throttleStatus));

const alertType = computed<'success' | 'warning' | 'error' | 'info'>(() => {
	if (problems.value.length > 0) {
		return 'error';
	}

	if (updateAvailable.value && latestVersion.value) {
		return 'info';
	}

	return 'success';
});

const title = computed<string>(() => {
	if (problems.value.length > 0) {
		return t('systemModule.health.problemTitle');
	}

	if (updateAvailable.value && latestVersion.value) {
		return t('systemModule.texts.update.available', { version: latestVersion.value });
	}

	return t('systemModule.health.okTitle');
});

const description = computed<string>(() => {
	if (problems.value.length > 0) {
		return problems.value.map((key) => t(`systemModule.systemInfo.${key}`)).join(' · ');
	}

	if (updateAvailable.value && latestVersion.value) {
		return t('systemModule.health.updateDescription');
	}

	return t('systemModule.health.okDescription');
});
</script>
