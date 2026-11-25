<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		:title="t('statsModule.headings.stats')"
		:subtitle="t('statsModule.subHeadings.stats')"
		icon="mdi:monitor-dashboard"
	/>

	<!-- Template 6: stat tiles, then the panels two to one -->
	<div
		class="page-pad flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto box-border [&>*]:shrink-0"
		data-test-id="overview"
	>
		<!-- Two tiles per row on phone; from tablet portrait the row takes as many 150 px tiles as fit -->
		<div
			class="grid grid-cols-2 tp:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4"
			data-test-id="overview-tiles"
		>
			<stats-devices
				:devices-module-section="devicesModuleSection"
				:loading="isLoadingStats"
			/>

			<stats-devices-communication
				:devices-module-section="devicesModuleSection"
				:loading="isLoadingStats"
			/>

			<stats-spaces :loading="isLoadingStats" />

			<stats-dashboard
				:dashboard-module-section="dashboardModuleSection"
				:loading="isLoadingStats"
			/>

			<stats-cpu
				:system-module-section="systemModuleSection"
				:system-info="systemInfo"
				:loading="isLoadingStats || isLoadingSystemInfo"
			/>

			<stats-memory
				:system-module-section="systemModuleSection"
				:system-info="systemInfo"
				:loading="isLoadingStats || isLoadingSystemInfo"
			/>

			<stats-uptime
				:system-module-section="systemModuleSection"
				:loading="isLoadingStats"
			/>
		</div>

		<div class="grid grid-cols-1 tl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">
			<div class="flex flex-col gap-4 min-w-0">
				<application-overview
					:api-module-section="apiModuleSection"
					:websocket-module-section="websocketModuleSection"
					:loading="isLoadingStats"
				/>

				<application-logs
					v-model:filters="systemLogsFilters"
					:system-logs="systemLogs"
					:filters-active="systemLogsFiltersActive"
					:loading="areLoadingSystemLogs"
					@refresh="refreshSystemLogs"
					@reset="systemLogsResetFilter"
					@detail="openSystemLogs"
				/>
			</div>

			<div class="flex flex-col gap-4 min-w-0">
				<system-information
					:system-info="systemInfo"
					:config-app="configApp"
					:loading="isLoadingSystemInfo || isLoadingAppConfig"
				/>

				<weather-day />

				<quick-links />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationRaw, useRouter } from 'vue-router';

import { AppBreadcrumbs, ViewHeader } from '../../../common';
import { useConfigApp } from '../../config';
import { RouteNames as SystemModuleRouteNames, useSystemInfo, useSystemLogsDataSource } from '../../system';
import { WeatherDay } from '../../weather';
import {
	ApplicationLogs,
	ApplicationOverview,
	QuickLinks,
	StatsCpu,
	StatsDashboard,
	StatsDevices,
	StatsDevicesCommunication,
	StatsMemory,
	StatsSpaces,
	StatsUptime,
	SystemInformation,
} from '../components/components';
import { useStats } from '../composables/useStats';
import type {
	IApiModuleSection,
	IDashboardModuleSection,
	IDevicesModuleSection,
	ISystemModuleSection,
	IWebSocketModuleSection,
} from '../schemas/sections.types';
import { RouteNames } from '../stats.constants';
import { StatsException } from '../stats.exceptions';

const router = useRouter();

const { t } = useI18n();

const { stats, fetchStats, isLoading: isLoadingStats } = useStats();
const { systemInfo, fetchSystemInfo, isLoading: isLoadingSystemInfo } = useSystemInfo();
const { configApp, fetchConfigApp, isLoading: isLoadingAppConfig } = useConfigApp();
const {
	systemLogs,
	fetchSystemLogs,
	areLoading: areLoadingSystemLogs,
	refreshSystemLogs,
	resetFilter: systemLogsResetFilter,
	filters: systemLogsFilters,
	filtersActive: systemLogsFiltersActive,
} = useSystemLogsDataSource({ syncQuery: false });

const apiModuleSection = computed<IApiModuleSection | undefined>((): IApiModuleSection | undefined => {
	return stats.value?.['api-module'];
});

const websocketModuleSection = computed<IWebSocketModuleSection | undefined>((): IWebSocketModuleSection | undefined => {
	return stats.value?.['websocket-module'];
});

const systemModuleSection = computed<ISystemModuleSection | undefined>((): ISystemModuleSection | undefined => {
	return stats.value?.['system-module'];
});

const dashboardModuleSection = computed<IDashboardModuleSection | undefined>((): IDashboardModuleSection | undefined => {
	return stats.value?.['dashboard-module'];
});

const devicesModuleSection = computed<IDevicesModuleSection | undefined>((): IDevicesModuleSection | undefined => {
	return stats.value?.['devices-module'];
});

const openSystemLogs = (): void => {
	router.push({ name: SystemModuleRouteNames.SYSTEM_LOGS });
};

const breadcrumbs = computed<{ label: string; route: RouteLocationRaw }[]>((): { label: string; route: RouteLocationRaw }[] => {
	return [
		{
			label: t('statsModule.breadcrumbs.stats'),
			route: router.resolve({ name: RouteNames.STATS }),
		},
	];
});

onBeforeMount(async (): Promise<void> => {
	fetchStats().catch((error: unknown): void => {
		const err = error as Error;

		throw new StatsException('Something went wrong', err);
	});

	fetchSystemInfo().catch((error: unknown): void => {
		const err = error as Error;

		throw new StatsException('Something went wrong', err);
	});

	fetchConfigApp().catch((error: unknown): void => {
		const err = error as Error;

		throw new StatsException('Something went wrong', err);
	});

	fetchSystemLogs().catch((error: unknown): void => {
		const err = error as Error;

		throw new StatsException('Something went wrong', err);
	});
});

useMeta({
	title: t('statsModule.meta.stats.title'),
});
</script>
