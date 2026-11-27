<template>
	<state-view
		kind="empty"
		icon="mdi:power"
		:title="t('systemModule.subHeadings.poweredOff')"
		:description="t('systemModule.texts.manage.poweredOff')"
		data-test-id="maintenance-powered-off"
	/>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { StateView } from '../../../common';

defineOptions({
	name: 'ViewPowerOff',
});

const { t } = useI18n();
</script>
