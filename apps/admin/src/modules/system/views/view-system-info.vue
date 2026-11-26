<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		:title="t('systemModule.headings.system.system')"
		:subtitle="t('systemModule.subHeadings.system')"
		icon="mdi:wrench-outline"
		:actions="[{ icon: 'mdi:refresh', label: t('systemModule.buttons.refresh.title'), handler: onRefresh }]"
	>
		<template #actions>
			<el-button
				plain
				:loading="refreshing"
				data-test-id="system-info-refresh"
				@click="onRefresh"
			>
				<template #icon>
					<icon icon="mdi:refresh" />
				</template>

				{{ t('systemModule.buttons.refresh.title') }}
			</el-button>
		</template>
	</view-header>

	<state-view
		v-if="systemInfo === null && failed"
		kind="error"
		icon="mdi:cellphone-information"
		:title="t('systemModule.messages.misc.systemInfoError')"
		class="flex-1"
		data-test-id="system-info-error"
	>
		<template #action>
			<el-button
				plain
				@click="onRefresh"
			>
				{{ t('systemModule.buttons.retry.title') }}
			</el-button>
		</template>
	</state-view>

	<state-view
		v-else-if="systemInfo === null"
		kind="loading"
		:title="t('systemModule.texts.system.loadingSystemInfo')"
		class="flex-1"
	/>

	<!-- Template 5, settings and status: the health banner, then one card per section -->
	<settings-layout
		v-else
		:sections="sections"
	>
		<template #banner>
			<system-health-banner :throttle-status="throttleStatus" />
		</template>

		<settings-section
			id="software"
			:title="t('systemModule.headings.update.title')"
			icon="mdi:update"
		>
			<update-status />
		</settings-section>

		<system-info-detail
			:system-info="systemInfo"
			:throttle-status="throttleStatus"
		/>

		<settings-section
			id="manage"
			:title="t('systemModule.headings.manage.manageSystem')"
			icon="mdi:cog-outline"
		>
			<manage-system />
		</settings-section>

		<settings-section
			id="about"
			:title="t('systemModule.headings.system.about')"
			icon="mdi:information-outline"
		>
			<about-application />
		</settings-section>
	</settings-layout>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationRaw, useRouter } from 'vue-router';

import { ElButton } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBreadcrumbs, SettingsLayout, type SettingsLayoutSection, SettingsSection, StateView, ViewHeader, useFlashMessage } from '../../../common';
import { AboutApplication, ManageSystem, SystemHealthBanner, SystemInfoDetail, UpdateStatus } from '../components/components';
import { useSystemInfo, useThrottleStatus } from '../composables/composables';
import { RouteNames } from '../system.constants';

defineOptions({
	name: 'ViewSystemInfo',
});

const router = useRouter();
const { t } = useI18n();
const flashMessage = useFlashMessage();

const { systemInfo, fetchSystemInfo } = useSystemInfo();
const { throttleStatus, fetchThrottleStatus } = useThrottleStatus();

// The system information could not be read; the throttle status is optional, a board without it shows N/A
const failed = ref<boolean>(false);

const refreshing = ref<boolean>(false);

const sections = computed<SettingsLayoutSection[]>((): SettingsLayoutSection[] => [
	{ id: 'software', label: t('systemModule.headings.update.title'), icon: 'mdi:update' },
	{ id: 'hardware', label: t('systemModule.headings.system.hardware'), icon: 'mdi:chip' },
	{ id: 'power', label: t('systemModule.headings.system.power'), icon: 'mdi:flash-alert-outline' },
	{ id: 'os', label: t('systemModule.headings.system.os'), icon: 'mdi:server-outline' },
	{ id: 'network', label: t('systemModule.headings.system.network'), icon: 'mdi:local-area-network' },
	{ id: 'manage', label: t('systemModule.headings.manage.manageSystem'), icon: 'mdi:cog-outline' },
	{ id: 'about', label: t('systemModule.headings.system.about'), icon: 'mdi:information-outline' },
]);

const breadcrumbs = computed<{ label: string; route: RouteLocationRaw }[]>((): { label: string; route: RouteLocationRaw }[] => {
	return [
		{
			label: t('systemModule.breadcrumbs.system.system'),
			route: router.resolve({ name: RouteNames.SYSTEM }),
		},
		{
			label: t('systemModule.breadcrumbs.system.systemInfo'),
			route: router.resolve({ name: RouteNames.SYSTEM_INFO }),
		},
	];
});

const load = async (): Promise<void> => {
	failed.value = false;

	const [info] = await Promise.allSettled([fetchSystemInfo(), fetchThrottleStatus()]);

	failed.value = info.status === 'rejected';

	// Information read before stays on screen; the failed refresh says so
	if (failed.value && systemInfo.value !== null) {
		flashMessage.error(t('systemModule.messages.misc.systemInfoError'));
	}
};

const onRefresh = (): void => {
	if (refreshing.value) {
		return;
	}

	refreshing.value = true;

	load().finally((): void => {
		refreshing.value = false;
	});
};

onBeforeMount((): void => {
	void load();
});

useMeta({
	title: t('systemModule.meta.system.systemInfo.title'),
});
</script>
