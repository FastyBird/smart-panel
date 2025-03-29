<template>
	<view-header
		:heading="t('systemModule.headings.systemInfo')"
		:sub-heading="t('systemModule.subHeadings.systemInfo')"
		icon="mdi:cellphone-information"
	/>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ViewHeader } from '../../../common';

defineOptions({
	name: 'ViewSystemInfo',
});

const { t } = useI18n();
</script>
