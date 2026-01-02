<template>
	<el-card
		shadow="never"
		header-class="px-3! py-3! font-bold"
	>
		<template #header>
			{{ t('statsModule.headings.quickLinks') }}
		</template>

		<div class="flex flex-row items-center justify-between">
			<el-button
				class="px-4!"
				@click="onOpenSpaces"
			>
				{{ t('statsModule.buttons.spaces.title') }}
			</el-button>

			<el-button
				class="px-4!"
				@click="onOpenPages"
			>
				{{ t('statsModule.buttons.pages.title') }}
			</el-button>

			<el-button
				class="px-4!"
				@click="onOpenDevices"
			>
				{{ t('statsModule.buttons.devices.title') }}
			</el-button>

			<el-button
				class="px-4!"
				@click="onOpenConfig"
			>
				{{ t('statsModule.buttons.config.title') }}
			</el-button>

			<el-button
				class="px-4!"
				@click="onOpenDocs"
			>
				{{ t('statsModule.buttons.docs.title') }}
			</el-button>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton, ElCard } from 'element-plus';

import { RouteNames as SpacesModuleRouteNames } from '../../spaces';
import { RouteNames as ConfigModuleRouteNames } from '../../config';
import { RouteNames as DashboardModuleRouteNames } from '../../dashboard';
import { RouteNames as DevicesModuleRouteNames } from '../../devices';

defineOptions({
	name: 'QuickLinks',
});

const router = useRouter();

const { t } = useI18n();

const onOpenSpaces = (): void => {
	router.push({
		name: SpacesModuleRouteNames.SPACES,
	});
};

const onOpenPages = (): void => {
	router.push({
		name: DashboardModuleRouteNames.PAGES,
	});
};

const onOpenDevices = (): void => {
	router.push({
		name: DevicesModuleRouteNames.DEVICES,
	});
};

const onOpenConfig = (): void => {
	router.push({
		name: ConfigModuleRouteNames.CONFIG,
	});
};

const onOpenDocs = (): void => {
	window.open('https://smart-panel.fastybird.com/docs', '_blank', 'noopener,noreferrer');
};
</script>
