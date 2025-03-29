<template>
	<view-header
		:heading="t('configModule.headings.configAudio')"
		:sub-heading="t('configModule.subHeadings.configAudio')"
		icon="mdi:monitor-speaker"
	/>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ViewHeader } from '../../../common';

defineOptions({
	name: 'ViewConfigAudio',
});

const { t } = useI18n();
</script>
