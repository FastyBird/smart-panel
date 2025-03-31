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
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="onSave"
	>
		<span class="uppercase">{{ t('configModule.buttons.save.title') }}</span>
	</app-bar-button>

	<view-header
		:heading="t('configModule.headings.config')"
		:sub-heading="t('configModule.subHeadings.config')"
		icon="mdi:cog"
	>
		<template #extra>
			<div class="flex items-center">
				<el-button
					:loading="remoteFormResult === FormResult.WORKING"
					:disabled="remoteFormResult === FormResult.WORKING"
					type="primary"
					@click="onSave"
				>
					{{ t('configModule.buttons.save.title') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<el-tabs
		v-if="isMDDevice"
		v-model="activeTab"
		class="lt-sm:mx-1 sm:mx-2"
		@tab-click="onTabClick"
	>
		<el-tab-pane
			:label="t('configModule.tabs.configAudio')"
			:name="'audio'"
		>
			<template #label>
				<span class="flex flex-row items-center gap-2">
					<el-icon>
						<icon icon="mdi:monitor-speaker" />
					</el-icon>
					<span>{{ t('configModule.tabs.configAudio') }}</span>
				</span>
			</template>

			<router-view
				v-if="route.name === RouteNames.CONFIG_AUDIO"
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
			/>
		</el-tab-pane>

		<el-tab-pane
			:label="t('configModule.tabs.configDisplay')"
			:name="'display'"
		>
			<template #label>
				<span class="flex flex-row items-center gap-2">
					<el-icon>
						<icon icon="mdi:monitor-dashboard" />
					</el-icon>
					<span>{{ t('configModule.tabs.configDisplay') }}</span>
				</span>
			</template>

			<router-view
				v-if="route.name === RouteNames.CONFIG_DISPLAY"
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
			/>
		</el-tab-pane>

		<el-tab-pane
			:label="t('configModule.tabs.configLanguage')"
			:name="'language'"
		>
			<template #label>
				<span class="flex flex-row items-center gap-2">
					<el-icon>
						<icon icon="mdi:translate" />
					</el-icon>
					<span>{{ t('configModule.tabs.configLanguage') }}</span>
				</span>
			</template>

			<router-view
				v-if="route.name === RouteNames.CONFIG_LANGUAGE"
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
			/>
		</el-tab-pane>

		<el-tab-pane
			:label="t('configModule.tabs.configWeather')"
			:name="'weather'"
		>
			<template #label>
				<span class="flex flex-row items-center gap-2">
					<el-icon>
						<icon icon="mdi:weather-partly-cloudy" />
					</el-icon>
					<span>{{ t('configModule.tabs.configWeather') }}</span>
				</span>
			</template>

			<router-view
				v-if="route.name === RouteNames.CONFIG_WEATHER"
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
			/>
		</el-tab-pane>
	</el-tabs>

	<router-view
		v-if="!isMDDevice"
		v-model:remote-form-submit="remoteFormSubmit"
		v-model:remote-form-result="remoteFormResult"
		class="p-2"
	/>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { type RouteLocationRaw, type RouteRecordName, useRoute, useRouter } from 'vue-router';

import { ElButton, ElIcon, ElTabPane, ElTabs, type TabsPaneContext } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../common';
import { FormResult, RouteNames } from '../config.constants';

type PageTabName = 'audio' | 'display' | 'language' | 'weather';

defineOptions({
	name: 'LayoutConfig',
});

const router = useRouter();
const route = useRoute();
const { t } = useI18n();

const { isMDDevice } = useBreakpoints();
const activeTab = ref<PageTabName>('audio');

const mounted = ref<boolean>(false);
const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResult>(FormResult.NONE);

const breadcrumbs = computed<{ label: string; route: RouteLocationRaw }[]>((): { label: string; route: RouteLocationRaw }[] => {
	const items = [
		{
			label: t('configModule.breadcrumbs.config'),
			route: router.resolve({ name: RouteNames.CONFIG }),
		},
	];

	if (route.name === RouteNames.CONFIG_AUDIO) {
		items.push({
			label: t('configModule.breadcrumbs.configAudio'),
			route: router.resolve({ name: RouteNames.CONFIG_AUDIO }),
		});
	}

	if (route.name === RouteNames.CONFIG_DISPLAY) {
		items.push({
			label: t('configModule.breadcrumbs.configDisplay'),
			route: router.resolve({ name: RouteNames.CONFIG_DISPLAY }),
		});
	}

	if (route.name === RouteNames.CONFIG_LANGUAGE) {
		items.push({
			label: t('configModule.breadcrumbs.configLanguage'),
			route: router.resolve({ name: RouteNames.CONFIG_LANGUAGE }),
		});
	}

	if (route.name === RouteNames.CONFIG_WEATHER) {
		items.push({
			label: t('configModule.breadcrumbs.configWeather'),
			route: router.resolve({ name: RouteNames.CONFIG_WEATHER }),
		});
	}

	return items;
});

const onTabClick = (pane: TabsPaneContext): void => {
	switch (pane.paneName) {
		case 'audio':
			router.push({ name: RouteNames.CONFIG_AUDIO });
			break;
		case 'display':
			router.push({ name: RouteNames.CONFIG_DISPLAY });
			break;
		case 'language':
			router.push({ name: RouteNames.CONFIG_LANGUAGE });
			break;
		case 'weather':
			router.push({ name: RouteNames.CONFIG_WEATHER });
			break;
	}
};

const onSave = (): void => {
	remoteFormSubmit.value = true;
};

onMounted((): void => {
	mounted.value = true;

	if (route.name === RouteNames.CONFIG_AUDIO && activeTab.value !== 'audio') {
		activeTab.value = 'audio';
	} else if (route.name === RouteNames.CONFIG_DISPLAY && activeTab.value !== 'display') {
		activeTab.value = 'display';
	} else if (route.name === RouteNames.CONFIG_LANGUAGE && activeTab.value !== 'language') {
		activeTab.value = 'language';
	} else if (route.name === RouteNames.CONFIG_WEATHER && activeTab.value !== 'weather') {
		activeTab.value = 'weather';
	}
});

watch(
	(): RouteRecordName | string | null | undefined => route.name,
	(val: RouteRecordName | string | null | undefined): void => {
		if (mounted.value) {
			if (val === RouteNames.CONFIG_AUDIO && activeTab.value !== 'audio') {
				activeTab.value = 'audio';
			} else if (val === RouteNames.CONFIG_DISPLAY && activeTab.value !== 'display') {
				activeTab.value = 'display';
			} else if (val === RouteNames.CONFIG_LANGUAGE && activeTab.value !== 'language') {
				activeTab.value = 'language';
			} else if (val === RouteNames.CONFIG_WEATHER && activeTab.value !== 'weather') {
				activeTab.value = 'weather';
			}
		}
	}
);
</script>
