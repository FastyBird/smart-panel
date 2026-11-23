<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		:title="t('remoteAccessModule.headings.remoteAccess')"
		:subtitle="t('remoteAccessModule.subHeadings.remoteAccess')"
		icon="mdi:cloud-lock-outline"
	/>

	<state-view
		v-if="isLoading && status === null"
		kind="loading"
		:title="t('remoteAccessModule.texts.loadingStatus')"
		class="flex-1"
	/>

	<!-- Template 5, settings and status: the health banner, then one card per section -->
	<settings-layout
		v-else
		:sections="sections"
	>
		<template #banner>
			<remote-access-status-banner />
		</template>

		<settings-section
			id="access-urls"
			:title="t('remoteAccessModule.headings.accessUrls')"
			icon="mdi:link-variant"
		>
			<access-urls-list />
		</settings-section>

		<settings-section
			id="providers"
			:title="t('remoteAccessModule.tabs.providers')"
			icon="mdi:lan-connect"
		>
			<provider-cards />
		</settings-section>

		<settings-section
			id="advisories"
			:title="t('remoteAccessModule.tabs.advisories')"
			icon="mdi:shield-alert-outline"
		>
			<template
				v-if="advisories.length > 0"
				#actions
			>
				<status-tag
					:status="advisoriesStatus"
					:label="String(advisories.length)"
					data-test-id="advisories-count"
				/>
			</template>

			<advisories-list />
		</settings-section>
	</settings-layout>
</template>

<script setup lang="ts">
import { computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationRaw, useRouter } from 'vue-router';

import {
	AppBreadcrumbs,
	type SettingsLayoutSection,
	SettingsLayout,
	SettingsSection,
	StateView,
	StatusTag,
	type StatusTagStatus,
	ViewHeader,
	useFlashMessage,
} from '../../../common';
import { AccessUrlsList, AdvisoriesList, ProviderCards, RemoteAccessStatusBanner } from '../components/components';
import { useRemoteAccessStatus } from '../composables';
import { RouteNames } from '../remote-access.constants';

defineOptions({
	name: 'ViewRemoteAccess',
});

const router = useRouter();
const { t } = useI18n();

const flashMessage = useFlashMessage();

const { status, isLoading, advisories, fetchStatus } = useRemoteAccessStatus();

const advisoriesStatus = computed<StatusTagStatus>(() => (advisories.value.some((advisory) => advisory.severity === 'critical') ? 'critical' : 'warn'));

const sections = computed<SettingsLayoutSection[]>(() => [
	{ id: 'access-urls', label: t('remoteAccessModule.headings.accessUrls'), icon: 'mdi:link-variant' },
	{ id: 'providers', label: t('remoteAccessModule.tabs.providers'), icon: 'mdi:lan-connect' },
	{ id: 'advisories', label: t('remoteAccessModule.tabs.advisories'), icon: 'mdi:shield-alert-outline', count: advisories.value.length },
]);

const breadcrumbs = computed<{ label: string; route: RouteLocationRaw }[]>((): { label: string; route: RouteLocationRaw }[] => {
	return [
		{
			label: t('remoteAccessModule.breadcrumbs.remoteAccess'),
			route: router.resolve({ name: RouteNames.REMOTE_ACCESS }),
		},
	];
});

onBeforeMount(async (): Promise<void> => {
	try {
		await fetchStatus();
	} catch {
		flashMessage.error(t('remoteAccessModule.messages.requestError'));
	}
});

useMeta({
	title: t('remoteAccessModule.meta.remoteAccess.title'),
});
</script>
