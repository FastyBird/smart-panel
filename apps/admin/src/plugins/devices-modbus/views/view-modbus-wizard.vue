<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		:heading="t('devicesModbusPlugin.wizard.title')"
		:sub-heading="t('devicesModbusPlugin.wizard.subtitle')"
		icon="mdi:lan-connect"
	/>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { AppBreadcrumbs, ViewHeader } from '../../../common';
import { RouteNames as DevicesRouteNames } from '../../../modules/devices';
import { RouteNames } from '../devices-modbus.constants';

defineOptions({
	name: 'ViewModbusWizard',
});

const { t } = useI18n();
const router = useRouter();

useMeta({
	title: t('devicesModbusPlugin.wizard.title'),
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => [
		{
			label: t('devicesModule.breadcrumbs.devices.list'),
			route: router.resolve({ name: DevicesRouteNames.DEVICES }),
		},
		{
			label: t('devicesModbusPlugin.wizard.breadcrumb'),
			route: router.resolve({ name: RouteNames.WIZARD }),
		},
	]
);
</script>
