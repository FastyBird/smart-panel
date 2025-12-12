<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:cog"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('configModule.headings.config') }}
		</template>

		<template #subtitle>
			{{ t('configModule.subHeadings.config') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="router.push('/')"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>

		<span class="uppercase">{{ t('application.buttons.home.title') }}</span>
	</app-bar-button>

	<view-header
		:heading="t('configModule.headings.config')"
		:sub-heading="t('configModule.subHeadings.config')"
		icon="mdi:cog"
	/>

	<el-tabs
		v-if="isMDDevice"
		v-model="activeTab"
		class="lt-sm:mx-1 sm:mx-2 overflow-hidden grow-1"
		@tab-click="onTabClick"
	>
		<el-tab-pane
			:label="t('configModule.tabs.configModules')"
			:name="'modules'"
			class="h-full"
		>
			<template #label>
				<span class="flex flex-row items-center gap-2">
					<el-icon>
						<icon icon="mdi:package-variant" />
					</el-icon>
					<span>{{ t('configModule.tabs.configModules') }}</span>
				</span>
			</template>

			<router-view v-if="isModulesRoute" />
		</el-tab-pane>

		<el-tab-pane
			:label="t('configModule.tabs.configPlugins')"
			:name="'plugins'"
			class="h-full"
		>
			<template #label>
				<span class="flex flex-row items-center gap-2">
					<el-icon>
						<icon icon="mdi:toy-brick" />
					</el-icon>
					<span>{{ t('configModule.tabs.configPlugins') }}</span>
				</span>
			</template>

			<router-view v-if="isPluginsRoute" />
		</el-tab-pane>
	</el-tabs>

	<router-view
		v-if="!isMDDevice"
		class="p-2"
	/>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { type RouteLocationRaw, type RouteRecordName, useRoute, useRouter } from 'vue-router';

import { ElIcon, ElTabPane, ElTabs, type TabsPaneContext } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../common';
import { RouteNames } from '../config.constants';

type PageTabName = 'modules' | 'plugins';

defineOptions({
	name: 'LayoutConfig',
});

const router = useRouter();
const route = useRoute();
const { t } = useI18n();

const { isMDDevice } = useBreakpoints();
const activeTab = ref<PageTabName>('modules');

const mounted = ref<boolean>(false);

const isModulesRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.CONFIG_MODULES || 
		route.name === RouteNames.CONFIG_MODULE_EDIT ||
		route.path.startsWith('/config/modules');
});

const isPluginsRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.CONFIG_PLUGINS || 
		route.name === RouteNames.CONFIG_PLUGIN_EDIT ||
		route.path.startsWith('/config/plugins');
});

const breadcrumbs = computed<{ label: string; route: RouteLocationRaw }[]>((): { label: string; route: RouteLocationRaw }[] => {
	const items = [
		{
			label: t('configModule.breadcrumbs.config'),
			route: router.resolve({ name: RouteNames.CONFIG }),
		},
	];

	if (route.name === RouteNames.CONFIG_PLUGINS || route.name === RouteNames.CONFIG_PLUGIN_EDIT) {
		items.push({
			label: t('configModule.breadcrumbs.configPlugins'),
			route: router.resolve({ name: RouteNames.CONFIG_PLUGINS }),
		});
	}

	if (route.name === RouteNames.CONFIG_MODULES || route.name === RouteNames.CONFIG_MODULE_EDIT) {
		items.push({
			label: t('configModule.breadcrumbs.configModules'),
			route: router.resolve({ name: RouteNames.CONFIG_MODULES }),
		});
	}

	return items;
});

const onTabClick = (pane: TabsPaneContext): void => {
	switch (pane.paneName) {
		case 'plugins':
			router.push({ name: RouteNames.CONFIG_PLUGINS });
			break;
		case 'modules':
			router.push({ name: RouteNames.CONFIG_MODULES });
			break;
	}
};

onMounted((): void => {
	mounted.value = true;

	if ((route.name === RouteNames.CONFIG_PLUGINS || route.name === RouteNames.CONFIG_PLUGIN_EDIT || route.path.startsWith('/config/plugins')) && activeTab.value !== 'plugins') {
		activeTab.value = 'plugins';
	} else if ((route.name === RouteNames.CONFIG_MODULES || route.name === RouteNames.CONFIG_MODULE_EDIT || route.path.startsWith('/config/modules')) && activeTab.value !== 'modules') {
		activeTab.value = 'modules';
	}
});

watch(
	(): RouteRecordName | string | null | undefined => route.name,
	(val: RouteRecordName | string | null | undefined): void => {
		if (!mounted.value) {
			return;
		}

		if (val === RouteNames.CONFIG_PLUGINS || val === RouteNames.CONFIG_PLUGIN_EDIT || route.path.startsWith('/config/plugins')) {
			if (activeTab.value !== 'plugins') {
				activeTab.value = 'plugins';
			}
		} else if (val === RouteNames.CONFIG_MODULES || val === RouteNames.CONFIG_MODULE_EDIT || route.path.startsWith('/config/modules')) {
			if (activeTab.value !== 'modules') {
				activeTab.value = 'modules';
			}
		}
	},
	{ immediate: false }
);

watch(
	(): string => route.path,
	(): void => {
		if (!mounted.value) {
			return;
		}

		if (route.path.startsWith('/config/plugins')) {
			if (activeTab.value !== 'plugins') {
				activeTab.value = 'plugins';
			}
		} else if (route.path.startsWith('/config/modules')) {
			if (activeTab.value !== 'modules') {
				activeTab.value = 'modules';
			}
		}
	},
	{ immediate: false }
);
</script>
