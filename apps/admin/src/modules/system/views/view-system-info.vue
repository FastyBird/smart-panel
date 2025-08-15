<template>
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
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { useRoute, useRouter } from 'vue-router';

import { ElDrawer, ElIcon, ElMessageBox, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, ViewError, useBreakpoints } from '../../../common';
import { SystemInfoDetail } from '../components/components';
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

const { isLGDevice } = useBreakpoints();

const { systemInfo, fetchSystemInfo, isLoading: isLoadingSystemInfo } = useSystemInfo();
const { throttleStatus, fetchThrottleStatus, isLoading: isLoadingThrottleStatus } = useThrottleStatus();
const { displays, fetchDisplays, areLoading: areLoadingDisplays } = useDisplaysProfiles();

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);

const isSystemInfoRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.SYSTEM_INFO;
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
