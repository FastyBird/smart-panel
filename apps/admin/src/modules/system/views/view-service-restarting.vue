<template>
	<health-polling-view
		:waiting-message="t('systemModule.messages.manage.waitingServiceToBoot')"
		:timeout-message="t('systemModule.messages.manage.serviceRestartTakesTooLong')"
		:timeout-ms="30 * 1000"
		:on-success="onSuccess"
		:wait-for-unhealthy="true"
	/>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElNotification } from 'element-plus';

import HealthPollingView from '../components/health-polling-view.vue';

defineOptions({
	name: 'ViewServiceRestarting',
});

const { t } = useI18n();

const onSuccess = (): void => {
	ElNotification.success(t('systemModule.messages.manage.panelBackOnline'));

	window.location.href = '/';
};
</script>
