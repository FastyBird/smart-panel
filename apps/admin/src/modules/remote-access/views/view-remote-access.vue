<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:cloud-lock-outline"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('remoteAccessModule.headings.remoteAccess') }}
		</template>

		<template #subtitle>
			{{ t('remoteAccessModule.subHeadings.remoteAccess') }}
		</template>
	</app-bar-heading>

	<view-header
		:heading="t('remoteAccessModule.headings.remoteAccess')"
		:sub-heading="t('remoteAccessModule.subHeadings.remoteAccess')"
		icon="mdi:cloud-lock-outline"
	/>

	<div
		v-loading="isLoading"
		:element-loading-text="t('remoteAccessModule.texts.loadingStatus')"
		class="flex flex-col gap-4"
	>
		<remote-access-status-banner />

		<el-card shadow="never">
			<template #header>
				{{ t('remoteAccessModule.headings.accessUrls') }}
			</template>

			<access-urls-list />
		</el-card>

		<el-card shadow="never">
			<template #header>
				{{ t('remoteAccessModule.headings.providers') }}
			</template>

			<provider-cards />
		</el-card>

		<el-card shadow="never">
			<template #header>
				{{ t('remoteAccessModule.headings.advisories') }}
			</template>

			<advisories-list />
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationRaw, useRouter } from 'vue-router';

import { ElCard, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints, useFlashMessage } from '../../../common';
import { AccessUrlsList, AdvisoriesList, ProviderCards, RemoteAccessStatusBanner } from '../components/components';
import { useRemoteAccessStatus } from '../composables';
import { RouteNames } from '../remote-access.constants';

defineOptions({
	name: 'ViewRemoteAccess',
});

const router = useRouter();
const { t } = useI18n();

const { isMDDevice } = useBreakpoints();

const flashMessage = useFlashMessage();

const { isLoading, fetchStatus } = useRemoteAccessStatus();

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
