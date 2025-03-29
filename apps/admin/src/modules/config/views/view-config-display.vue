<template>
	<view-header
		:heading="t('configModule.headings.configDisplay')"
		:sub-heading="t('configModule.subHeadings.configDisplay')"
		icon="mdi:monitor-dashboard"
	/>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ViewHeader } from '../../../common';

defineOptions({
	name: 'ViewConfigDisplay',
});

const { t } = useI18n();
</script>
