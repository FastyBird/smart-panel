<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		:heading="t('devicesModbusPlugin.endpoints.title')"
		:sub-heading="t('devicesModbusPlugin.endpoints.subtitle')"
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
	name: 'ViewModbusEndpoints',
});

const { t } = useI18n();
const router = useRouter();

useMeta({
	title: t('devicesModbusPlugin.endpoints.title'),
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => [
		{
			label: t('devicesModule.breadcrumbs.devices.list'),
			route: router.resolve({ name: DevicesRouteNames.DEVICES }),
		},
		{
			label: t('devicesModbusPlugin.endpoints.breadcrumb'),
			route: router.resolve({ name: RouteNames.ENDPOINTS }),
		},
	]
);
</script>
