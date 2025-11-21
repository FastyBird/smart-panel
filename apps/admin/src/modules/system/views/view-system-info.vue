<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:hammer"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('systemModule.headings.system.system') }}
		</template>

		<template #subtitle>
			{{ t('systemModule.subHeadings.system') }}
		</template>
	</app-bar-heading>

	<view-header
		:heading="t('systemModule.headings.system.system')"
		:sub-heading="t('systemModule.subHeadings.system')"
		icon="mdi:hammer"
	>
		<template #extra>
			<div class="flex items-center">
				<el-button
					plain
					class="px-4! ml-2!"
					@click="onAboutInfo"
				>
					<template #icon>
						<icon icon="mdi:about" />
					</template>

					{{ t('systemModule.buttons.about.title') }}
				</el-button>
				<el-button
					type="danger"
					plain
					class="px-4! ml-2!"
					@click="onManageSystem"
				>
					<template #icon>
						<icon icon="mdi:volume-control" />
					</template>

					{{ t('systemModule.buttons.manage.title') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<div
		v-if="isSystemInfoRoute || isLGDevice"
		v-loading="isLoadingSystemInfo || isLoadingThrottleStatus || areLoadingDisplays || systemInfo === null"
		:element-loading-text="t('systemModule.texts.system.loadingSystemInfo')"
	>
		<system-info-detail
			:system-info="systemInfo"
			:throttle-status="throttleStatus"
			:displays="displays"
			@edit-display="onDisplayEdit"
		/>
	</div>

	<router-view
		v-else
		:key="props.display"
		v-slot="{ Component }"
	>
		<component :is="Component" />
	</router-view>

	<el-drawer
		v-if="isLGDevice"
		v-model="showDrawer"
		:show-close="false"
		:size="'40%'"
		:with-header="false"
		:before-close="onCloseDrawer"
	>
		<div class="flex flex-col h-full">
			<app-bar menu-button-hidden>
				<template #button-right>
					<app-bar-button
						:align="AppBarButtonAlign.RIGHT"
						class="mr-2"
						@click="() => onCloseDrawer()"
					>
						<template #icon>
							<el-icon>
								<icon icon="mdi:close" />
							</el-icon>
						</template>
					</app-bar-button>
				</template>
			</app-bar>

			<template v-if="showDrawer">
				<view-error>
					<template #icon>
						<icon icon="mdi:monitor-edit" />
					</template>
					<template #message>
						{{ t('systemModule.messages.misc.requestError') }}
					</template>

					<suspense>
						<router-view
							:key="props.display"
							v-slot="{ Component }"
						>
							<component
								:is="Component"
								v-model:remote-form-changed="remoteFormChanged"
							/>
						</router-view>
					</suspense>
				</view-error>
			</template>
		</div>
	</el-drawer>

	<el-dialog
		v-model="showAboutInfo"
		:title="t('systemModule.headings.system.about')"
	>
		<about-application />

		<template #footer>
			<el-button
				link
				@click="showAboutInfo = false"
			>
				{{ t('usersModule.buttons.close.title') }}
			</el-button>
		</template>
	</el-dialog>

	<el-dialog
		v-model="showManageSystem"
		:title="t('systemModule.headings.manage.manageSystem')"
	>
		<manage-system @close="showManageSystem = false" />

		<template #footer>
			<el-button
				link
				@click="showManageSystem = false"
			>
				{{ t('usersModule.buttons.close.title') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationRaw, useRoute, useRouter } from 'vue-router';

import { ElButton, ElDialog, ElDrawer, ElIcon, ElMessageBox, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewError, ViewHeader, useBreakpoints } from '../../../common';
import { AboutApplication, ManageSystem, SystemInfoDetail } from '../components/components';
import { useDisplaysProfiles, useSystemInfo, useThrottleStatus } from '../composables/composables';
import type { IDisplayProfile } from '../store/displays-profiles.store.types';
import { RouteNames } from '../system.constants';
import { SystemException } from '../system.exceptions';

import type { IViewSystemInfoProps } from './view-system-info.types';

defineOptions({
	name: 'ViewSystemInfo',
});

const props = defineProps<IViewSystemInfoProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const { isMDDevice, isLGDevice } = useBreakpoints();

const { systemInfo, fetchSystemInfo, isLoading: isLoadingSystemInfo } = useSystemInfo();
const { throttleStatus, fetchThrottleStatus, isLoading: isLoadingThrottleStatus } = useThrottleStatus();
const { displays, fetchDisplays, areLoading: areLoadingDisplays } = useDisplaysProfiles();

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);

const showAboutInfo = ref<boolean>(false);

const showManageSystem = ref<boolean>(false);

const isSystemInfoRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.SYSTEM_INFO;
});

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

const onCloseDrawer = (done?: () => void): void => {
	if (remoteFormChanged.value) {
		ElMessageBox.confirm(t('systemModule.texts.misc.confirmDiscard'), t('systemModule.headings.misc.discard'), {
			confirmButtonText: t('systemModule.buttons.yes.title'),
			cancelButtonText: t('systemModule.buttons.no.title'),
			type: 'warning',
		})
			.then((): void => {
				if (isLGDevice.value) {
					router.replace({
						name: RouteNames.SYSTEM_INFO,
					});
				} else {
					router.push({
						name: RouteNames.SYSTEM_INFO,
					});
				}

				done?.();
			})
			.catch((): void => {
				// Just ignore it
			});
	} else {
		if (isLGDevice.value) {
			router.replace({
				name: RouteNames.SYSTEM_INFO,
			});
		} else {
			router.push({
				name: RouteNames.SYSTEM_INFO,
			});
		}

		done?.();
	}
};

const onDisplayEdit = (id: IDisplayProfile['id']): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.DISPLAY_EDIT,
			params: {
				display: id,
			},
		});
	} else {
		router.push({
			name: RouteNames.DISPLAY_EDIT,
			params: {
				display: id,
			},
		});
	}
};

const onAboutInfo = (): void => {
	showAboutInfo.value = true;
};

const onManageSystem = (): void => {
	showManageSystem.value = true;
};

onBeforeMount(async (): Promise<void> => {
	fetchSystemInfo().catch((error: unknown): void => {
		const err = error as Error;

		throw new SystemException('Something went wrong', err);
	});

	fetchThrottleStatus().catch((error: unknown): void => {
		const err = error as Error;

		throw new SystemException('Something went wrong', err);
	});

	fetchDisplays().catch((error: unknown): void => {
		const err = error as Error;

		throw new SystemException('Something went wrong', err);
	});

	showDrawer.value = route.matched.find((matched) => matched.name === RouteNames.DISPLAY_EDIT) !== undefined;
});

onMounted((): void => {
	mounted.value = true;
});

watch(
	(): boolean => isLoadingSystemInfo.value,
	(val: boolean): void => {
		if (!val && systemInfo.value === null) {
			throw new SystemException('Something went wrong');
		}
	}
);

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value = route.matched.find((matched) => matched.name === RouteNames.DISPLAY_EDIT) !== undefined;
	}
);

useMeta({
	title: t('systemModule.meta.system.systemInfo.title'),
});
</script>
