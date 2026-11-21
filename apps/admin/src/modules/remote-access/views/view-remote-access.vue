<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		:title="t('remoteAccessModule.headings.remoteAccess')"
		:subtitle="t('remoteAccessModule.subHeadings.remoteAccess')"
		icon="mdi:cloud-lock-outline"
	/>

	<div
		v-loading="isLoading"
		:element-loading-text="t('remoteAccessModule.texts.loadingStatus')"
		class="flex flex-col flex-1 min-h-0 overflow-hidden lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2"
	>
		<el-scrollbar class="flex-1 min-h-0">
			<div class="mt-2">
				<remote-access-status-banner />
			</div>

			<el-card
				shadow="never"
				class="mt-2"
			>
				<template #header>
					{{ t('remoteAccessModule.headings.accessUrls') }}
				</template>

				<access-urls-list />
			</el-card>

			<el-tabs
				v-model="activeTab"
				class="mt-2"
			>
				<el-tab-pane name="providers">
					<template #label>
						<div class="flex items-center gap-2 px-4">
							<icon icon="mdi:lan-connect" />
							{{ t('remoteAccessModule.tabs.providers') }}
						</div>
					</template>

					<provider-cards />
				</el-tab-pane>

				<el-tab-pane name="advisories">
					<template #label>
						<div class="flex items-center gap-2 px-4">
							<icon icon="mdi:shield-alert-outline" />
							{{ t('remoteAccessModule.tabs.advisories') }}
							<el-tag
								v-if="advisories.length > 0"
								size="small"
								:type="advisoriesTagType"
							>
								{{ advisories.length }}
							</el-tag>
						</div>
					</template>

					<el-card
						shadow="never"
						body-class="p-0!"
					>
						<advisories-table />
					</el-card>
				</el-tab-pane>
			</el-tabs>
		</el-scrollbar>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationRaw, useRouter } from 'vue-router';

import { ElCard, ElScrollbar, ElTabPane, ElTabs, ElTag, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBreadcrumbs, ViewHeader, useFlashMessage } from '../../../common';
import { AccessUrlsList, AdvisoriesTable, ProviderCards, RemoteAccessStatusBanner } from '../components/components';
import { useRemoteAccessStatus } from '../composables';
import { RouteNames } from '../remote-access.constants';

defineOptions({
	name: 'ViewRemoteAccess',
});

const router = useRouter();
const { t } = useI18n();

const flashMessage = useFlashMessage();

const { isLoading, advisories, fetchStatus } = useRemoteAccessStatus();

const activeTab = ref<string>('providers');

const advisoriesTagType = computed<'warning' | 'danger'>((): 'warning' | 'danger' => {
	return advisories.value.some((advisory) => advisory.severity === 'critical') ? 'danger' : 'warning';
});

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
