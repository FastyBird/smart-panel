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

const { enabled, advisories, hasExternalUrl } = useRemoteAccessStatus();

const criticalCount = computed<number>((): number => advisories.value.filter((advisory) => advisory.severity === 'critical').length);

const warningCount = computed<number>((): number => advisories.value.filter((advisory) => advisory.severity === 'warning').length);

// The state matrix, in priority order: disabled first (nothing else matters until it is turned
// on), then "enabled but not reachable yet" (no external URL published at all - worth flagging
// ahead of any posture advisory, since there is nothing to have a posture about yet), then any
// advisory (critical -> error, warning -> warning), and only once none of those apply, healthy.
const alertType = computed<'success' | 'warning' | 'error' | 'info'>((): 'success' | 'warning' | 'error' | 'info' => {
	if (!enabled.value) {
		return 'info';
	}

	if (!hasExternalUrl.value) {
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

	if (!hasExternalUrl.value) {
		return t('remoteAccessModule.status.banner.noExternalUrlTitle');
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

	if (!hasExternalUrl.value) {
		return t('remoteAccessModule.status.banner.noExternalUrlDescription');
	}

	if (advisories.value.length > 0) {
		return t('remoteAccessModule.status.banner.advisoriesDescription');
	}

	return t('remoteAccessModule.status.banner.okDescription');
});
</script>
