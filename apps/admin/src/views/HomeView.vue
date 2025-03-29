<template>
	<view-header
		:heading="t('application.headings.home')"
		:sub-heading="t('application.subHeadings.home')"
		icon="mdi:monitor-dashboard"
	/>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ViewHeader } from '../common';

defineOptions({
	name: 'HomeView',
});

const { t } = useI18n();
</script>
