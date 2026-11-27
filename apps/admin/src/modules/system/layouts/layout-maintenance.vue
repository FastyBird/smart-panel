<template>
	<!-- Template 10, standalone: the screens shown while the system restarts, resets or is off. Outside the shell, as
	     the backend may be down -->
	<standalone-layout
		:title="screen.title"
		:subtitle="screen.subtitle"
	>
		<router-view />
	</standalone-layout>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

import { StandaloneLayout } from '../../../common';
import { RouteNames } from '../system.constants';

defineOptions({
	name: 'LayoutMaintenance',
});

const { t } = useI18n();
const route = useRoute();

const screen = computed<{ title: string; subtitle?: string }>((): { title: string; subtitle?: string } => {
	switch (route.name) {
		case RouteNames.FACTORY_RESET:
			return { title: t('systemModule.maintenance.factoryReset.title'), subtitle: t('systemModule.maintenance.waitingSubtitle') };
		case RouteNames.REBOOTING:
			return { title: t('systemModule.maintenance.rebooting.title'), subtitle: t('systemModule.maintenance.waitingSubtitle') };
		case RouteNames.SERVICE_RESTARTING:
			return { title: t('systemModule.maintenance.serviceRestarting.title'), subtitle: t('systemModule.maintenance.waitingSubtitle') };
		default:
			return { title: t('systemModule.maintenance.poweredOff.title') };
	}
});
</script>
