<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #prepend>
			<user-avatar
				:size="32"
				:email="sessionStore.profile?.email"
			/>
		</template>

		<template #title>
			{{ t('authModule.headings.yourProfile') }}
		</template>

		<template #subtitle>
			{{ sessionStore.profile?.email || sessionStore.profile?.username }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="onSave"
	>
		<span class="uppercase">{{ t('devicesModule.buttons.save.title') }}</span>
	</app-bar-button>

	<view-header
		:heading="t('authModule.headings.yourProfile')"
		:sub-heading="sessionStore.profile?.email || sessionStore.profile?.username"
	>
		<template #icon>
			<user-avatar
				:size="32"
				:email="sessionStore.profile?.email"
			/>
		</template>

		<template #extra>
			<div class="flex items-center">
				<el-button
					:loading="remoteFormResult === FormResult.WORKING"
					:disabled="remoteFormResult === FormResult.WORKING"
					type="primary"
					@click="onSave"
				>
					{{ t('authModule.buttons.save.title') }}
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
			:label="t('authModule.tabs.general')"
			:name="'general'"
		>
			<template #label>
				<span class="flex flex-row items-center gap-2">
					<el-icon>
						<icon icon="mdi:user-edit" />
					</el-icon>
					<span>{{ t('authModule.tabs.general') }}</span>
				</span>
			</template>

			<router-view
				v-if="route.name === RouteNames.PROFILE_GENERAL"
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
			/>
		</el-tab-pane>

		<el-tab-pane
			:label="t('authModule.tabs.security')"
			:name="'security'"
		>
			<template #label>
				<span class="flex flex-row items-center gap-2">
					<el-icon>
						<icon icon="mdi:user-lock" />
					</el-icon>
					<span>{{ t('authModule.tabs.security') }}</span>
				</span>
			</template>

			<router-view
				v-if="route.name === RouteNames.PROFILE_SECURITY"
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

import {
	AppBarButton,
	AppBarButtonAlign,
	AppBarHeading,
	AppBreadcrumbs,
	UserAvatar,
	ViewHeader,
	injectStoresManager,
	useBreakpoints,
} from '../../../common';
import { FormResult, RouteNames } from '../auth.constants';
import { sessionStoreKey } from '../store';

type PageTabName = 'general' | 'security';

defineOptions({
	name: 'LayoutProfile',
});

const router = useRouter();
const route = useRoute();
const { t } = useI18n();

const storesManager = injectStoresManager();

const sessionStore = storesManager.getStore(sessionStoreKey);

const { isMDDevice } = useBreakpoints();
const activeTab = ref<PageTabName>(route.name === RouteNames.PROFILE_GENERAL ? 'general' : 'security');

const mounted = ref<boolean>(false);
const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResult>(FormResult.NONE);

const breadcrumbs = computed<{ label: string; route: RouteLocationRaw }[]>((): { label: string; route: RouteLocationRaw }[] => {
	const items = [
		{
			label: t('authModule.breadcrumbs.profile'),
			route: { name: RouteNames.PROFILE },
		},
	];

	if (route.name === RouteNames.PROFILE_GENERAL) {
		items.push({
			label: t('authModule.breadcrumbs.general'),
			route: { name: RouteNames.PROFILE_GENERAL },
		});
	}

	if (route.name === RouteNames.PROFILE_SECURITY) {
		items.push({
			label: t('authModule.breadcrumbs.security'),
			route: { name: RouteNames.PROFILE_SECURITY },
		});
	}

	return items;
});

const onTabClick = (pane: TabsPaneContext): void => {
	switch (pane.paneName) {
		case 'general':
			router.push({ name: RouteNames.PROFILE_GENERAL });
			break;
		case 'security':
			router.push({ name: RouteNames.PROFILE_SECURITY });
			break;
	}
};

const onSave = (): void => {
	remoteFormSubmit.value = true;
};

onMounted((): void => {
	mounted.value = true;
});

watch(
	(): RouteRecordName | string | null | undefined => route.name,
	(val: RouteRecordName | string | null | undefined): void => {
		if (mounted.value) {
			if (val === RouteNames.PROFILE_GENERAL && activeTab.value !== 'general') {
				activeTab.value = 'general';
			} else if (val === RouteNames.PROFILE_SECURITY && activeTab.value !== 'security') {
				activeTab.value = 'security';
			}
		}
	}
);
</script>
