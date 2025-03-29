<template>
	<view-header
		:heading="t('configModule.headings.configLanguage')"
		:sub-heading="t('configModule.subHeadings.configLanguage')"
		icon="mdi:translate"
	/>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ViewHeader } from '../../../common';

defineOptions({
	name: 'ViewConfigLanguage',
});

const { t } = useI18n();
</script>
