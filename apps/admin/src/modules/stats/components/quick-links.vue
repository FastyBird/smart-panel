<template>
	<!-- Template 6: the Quick links panel -->
	<el-card
		shadow="never"
		body-class="flex flex-col gap-3 p-4!"
		data-test-id="quick-links"
	>
		<span class="text-card-title">{{ t('statsModule.headings.quickLinks') }}</span>

		<div class="grid grid-cols-2 gap-2">
			<el-button
				class="ml-0!"
				@click="onOpenSpaces"
			>
				<template #icon>
					<icon icon="mdi:home-group" />
				</template>
				{{ t('statsModule.buttons.spaces.title') }}
			</el-button>

			<el-button
				class="ml-0!"
				@click="onOpenPages"
			>
				<template #icon>
					<icon icon="mdi:view-dashboard" />
				</template>
				{{ t('statsModule.buttons.pages.title') }}
			</el-button>

			<el-button
				class="ml-0!"
				@click="onOpenDevices"
			>
				<template #icon>
					<icon icon="mdi:devices" />
				</template>
				{{ t('statsModule.buttons.devices.title') }}
			</el-button>

			<el-button
				class="ml-0!"
				@click="onOpenConfig"
			>
				<template #icon>
					<icon icon="mdi:cog" />
				</template>
				{{ t('statsModule.buttons.config.title') }}
			</el-button>

			<el-button
				class="ml-0!"
				@click="onOpenDocs"
			>
				<template #icon>
					<icon icon="mdi:book-open-page-variant" />
				</template>
				{{ t('statsModule.buttons.docs.title') }}
			</el-button>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton, ElCard } from 'element-plus';

import { Icon } from '@iconify/vue';

import { RouteNames as ConfigModuleRouteNames } from '../../config';
import { RouteNames as DashboardModuleRouteNames } from '../../dashboard';
import { RouteNames as DevicesModuleRouteNames } from '../../devices';
import { RouteNames as SpacesModuleRouteNames } from '../../spaces';

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
