<template>
	<view-header
		:heading="t('configModule.headings.configWeather')"
		:sub-heading="t('configModule.subHeadings.configWeather')"
		icon="mdi:weather-partly-cloudy"
	/>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ViewHeader } from '../../../common';

defineOptions({
	name: 'ViewConfigWeather',
});

const { t } = useI18n();
</script>
