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
		class="flex flex-col flex-1 min-h-0 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2"
	>
		<remote-access-status-banner class="mt-2 shrink-0" />

		<el-card
			shadow="never"
			class="mt-2 shrink-0"
		>
			<template #header>
				{{ t('remoteAccessModule.headings.accessUrls') }}
			</template>

			<access-urls-list />
		</el-card>

		<el-card
			shadow="never"
			class="flex-1 min-h-0 flex flex-col mt-2"
			body-class="p-0! flex-1 min-h-0 flex flex-col"
		>
			<el-tabs
				v-model="activeTab"
				:class="['flex-1 min-h-0 flex flex-col', ns.e('tabs')]"
			>
				<el-tab-pane
					name="providers"
					class="h-full overflow-hidden"
				>
					<template #label>
						<div class="flex items-center gap-2 px-4">
							<icon icon="mdi:lan-connect" />
							{{ t('remoteAccessModule.tabs.providers') }}
						</div>
					</template>

					<el-scrollbar class="h-full">
						<div class="p-3">
							<provider-cards />
						</div>
					</el-scrollbar>
				</el-tab-pane>

				<el-tab-pane
					name="advisories"
					class="h-full overflow-hidden"
				>
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

					<advisories-table />
				</el-tab-pane>
			</el-tabs>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationRaw, useRouter } from 'vue-router';

import { ElCard, ElScrollbar, ElTabPane, ElTabs, ElTag, useNamespace, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints, useFlashMessage } from '../../../common';
import { AccessUrlsList, AdvisoriesTable, ProviderCards, RemoteAccessStatusBanner } from '../components/components';
import { useRemoteAccessStatus } from '../composables';
import { RouteNames } from '../remote-access.constants';

defineOptions({
	name: 'ViewRemoteAccess',
});

const router = useRouter();
const { t } = useI18n();

const ns = useNamespace('view-remote-access');

const { isMDDevice } = useBreakpoints();

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

<style lang="scss">
@use 'view-remote-access.scss';
</style>
