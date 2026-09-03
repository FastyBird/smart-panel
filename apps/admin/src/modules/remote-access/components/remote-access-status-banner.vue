<template>
	<el-alert
		:type="alertType"
		:title="title"
		:description="description"
		:closable="false"
		show-icon
	/>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert } from 'element-plus';

import { useRemoteAccessStatus } from '../composables';

defineOptions({
	name: 'RemoteAccessStatusBanner',
});

const { t } = useI18n();

const { enabled, advisories } = useRemoteAccessStatus();

const criticalCount = computed<number>((): number => advisories.value.filter((advisory) => advisory.severity === 'critical').length);

const warningCount = computed<number>((): number => advisories.value.filter((advisory) => advisory.severity === 'warning').length);

const alertType = computed<'success' | 'warning' | 'error' | 'info'>((): 'success' | 'warning' | 'error' | 'info' => {
	if (!enabled.value) {
		return 'info';
	}

	if (criticalCount.value > 0) {
		return 'error';
	}

	if (warningCount.value > 0) {
		return 'warning';
	}

	return 'success';
});

const title = computed<string>((): string => {
	if (!enabled.value) {
		return t('remoteAccessModule.status.banner.disabledTitle');
	}

	if (advisories.value.length > 0) {
		return t('remoteAccessModule.status.banner.advisoriesTitle', { count: advisories.value.length });
	}

	return t('remoteAccessModule.status.banner.okTitle');
});

const description = computed<string>((): string => {
	if (!enabled.value) {
		return t('remoteAccessModule.status.banner.disabledDescription');
	}

	if (advisories.value.length > 0) {
		return t('remoteAccessModule.status.banner.advisoriesDescription');
	}

	return t('remoteAccessModule.status.banner.okDescription');
});
</script>
