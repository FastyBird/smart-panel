<template>
	<health-polling-view
		:waiting-message="t('systemModule.messages.manage.waitingToBoot')"
		:timeout-message="t('systemModule.messages.manage.rebootTakesTooLong')"
		:timeout-ms="2 * 60 * 1000"
		:on-success="onSuccess"
	/>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElNotification } from 'element-plus';

import HealthPollingView from '../components/health-polling-view.vue';

defineOptions({
	name: 'ViewRebooting',
});

const { t } = useI18n();

const onSuccess = (): void => {
	ElNotification.success(t('systemModule.messages.manage.panelBackOnline'));

	window.location.href = '/';
};
</script>
