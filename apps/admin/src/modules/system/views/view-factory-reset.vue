<template>
	<health-polling-view
		:waiting-message="t('systemModule.texts.manage.factoryResetWaiting')"
		:timeout-message="t('systemModule.texts.manage.factoryResetTimeout')"
		:timeout-ms="3 * 60 * 1000"
		:on-success="onSuccess"
	/>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import HealthPollingView from '../components/health-polling-view.vue';

defineOptions({
	name: 'ViewFactoryReset',
});

const { t } = useI18n();

const onSuccess = (): void => {
	window.location.href = '/sign/in';
};
</script>
