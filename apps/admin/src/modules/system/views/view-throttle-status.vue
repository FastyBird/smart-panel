<template>
	<view-header
		:heading="t('systemModule.headings.throttleStatus')"
		:sub-heading="t('systemModule.subHeadings.throttleStatus')"
		icon="mdi:list-status"
	/>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ViewHeader } from '../../../common';

defineOptions({
	name: 'ViewThrottleStatus',
});

const { t } = useI18n();
</script>
