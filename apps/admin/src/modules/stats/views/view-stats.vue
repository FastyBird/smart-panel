<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		:heading="t('statsModule.headings.stats')"
		:sub-heading="t('statsModule.subHeadings.stats')"
		icon="mdi:monitor-dashboard"
	/>

	<div class="p-4">
		<el-row :gutter="20">
			<el-col :span="9">
				<div class="grid gap-2">
					<system-information
						:system-info="systemInfo"
						:config-app="configApp"
						:loading="isLoadingSystemInfo || isLoadingAppConfig"
					/>

					<weather-day />

					<quick-links />
				</div>
			</el-col>

			<el-col :span="15">
				<application-overview
					:api-module-section="apiModuleSection"
					:websocket-module-section="websocketModuleSection"
					:loading="isLoadingStats"
				/>

				<el-row
					class="mt-2 mb-2"
					:gutter="10"
				>
					<el-col :span="8">
						<stats-cpu
							:system-module-section="systemModuleSection"
							:system-info="systemInfo"
							:loading="isLoadingStats || isLoadingSystemInfo"
							class="h-full"
						/>
					</el-col>

					<el-col :span="8">
						<stats-memory
							:system-module-section="systemModuleSection"
							:system-info="systemInfo"
							:loading="isLoadingStats || isLoadingSystemInfo"
							class="h-full"
						/>
					</el-col>

					<el-col :span="8">
						<stats-uptime
							:system-module-section="systemModuleSection"
							:loading="isLoadingStats"
							class="h-full"
						/>
					</el-col>
				</el-row>

				<el-card
					shadow="never"
					class="mb-2"
				>
					<el-row :gutter="16">
						<el-col
							:xs="24"
							:sm="12"
							:md="8"
						>
							<stats-dashboard
								:dashboard-module-section="dashboardModuleSection"
								:loading="isLoadingStats"
							/>
						</el-col>

						<el-col
							:xs="24"
							:sm="12"
							:md="8"
						>
							<stats-devices
								:devices-module-section="devicesModuleSection"
								:loading="isLoadingStats"
							/>
						</el-col>

						<el-col
							:xs="24"
							:sm="12"
							:md="8"
						>
							<stats-devices-communication
								:devices-module-section="devicesModuleSection"
								:loading="isLoadingStats"
							/>
						</el-col>
					</el-row>
				</el-card>

				<application-logs
					v-model:filters="systemLogsFilters"
					:system-logs="systemLogs"
					:filters-active="systemLogsFiltersActive"
					:loading="areLoadingSystemLogs"
					@refresh="refreshSystemLogs"
					@reset="systemLogsResetFilter"
					@detail="openSystemLogs"
				/>
			</el-col>
		</el-row>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationRaw, useRouter } from 'vue-router';

import { ElCard, ElCol, ElRow } from 'element-plus';

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
