<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice && isDisplaysListRoute"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:monitor"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('displaysModule.headings.list') }}
		</template>

		<template #subtitle>
			{{ t('displaysModule.subHeadings.list') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice && isDisplaysListRoute"
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
		:heading="t('displaysModule.headings.list')"
		:sub-heading="t('displaysModule.subHeadings.list')"
		icon="mdi:monitor"
	>
		<template #extra>
			<el-button
				v-if="permitJoinAvailable"
				:loading="permitJoinActivating"
				:disabled="permitJoinActive"
				type="primary"
				@click="onPermitJoin"
			>
				<template v-if="permitJoinActive">
					{{ t('displaysModule.buttons.permitJoin.active', { seconds: permitJoinRemainingSeconds }) }}
				</template>
				<template v-else>
					{{ t('displaysModule.buttons.permitJoin.title') }}
				</template>
			</el-button>
		</template>
	</view-header>

	<div
		v-if="isDisplaysListRoute || isLGDevice"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden"
	>
		<list-displays
			v-model:filters="filters"
			v-model:sort-by="sortBy"
			v-model:sort-dir="sortDir"
			v-model:paginate-size="paginateSize"
			v-model:paginate-page="paginatePage"
			:items="displaysPaginated"
			:all-items="displays"
			:total-rows="totalRows"
			:loading="areLoading"
			:filters-active="filtersActive"
			@detail="onDisplayDetail"
			@edit="onDisplayEdit"
			@remove="onDisplayRemove"
			@adjust-list="onAdjustList"
			@reset-filters="onResetFilters"
		/>
	</div>

	<router-view
		v-else
		:key="props.id"
		v-slot="{ Component }"
	>
		<component :is="Component" />
	</router-view>

	<el-drawer
		v-if="isLGDevice"
		v-model="showDrawer"
		:show-close="false"
		:size="adjustList ? '300px' : '40%'"
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
				<list-displays-adjust
					v-if="adjustList"
					v-model:filters="filters"
					:filters-active="filtersActive"
					@reset-filters="onResetFilters"
				/>

				<view-error v-else>
					<template #icon>
						<icon icon="mdi:monitor" />
					</template>
					<template #message>
						{{ t('displaysModule.messages.loadError') }}
					</template>

					<suspense>
						<router-view
							:key="props.id"
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
import { computed, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElDrawer, ElIcon, ElMessage, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewError, ViewHeader, useBreakpoints } from '../../../common';
import { ListDisplays, ListDisplaysAdjust } from '../components/components';
import { useDisplaysActions, useDisplaysDataSource } from '../composables/composables';
import { RouteNames } from '../displays.constants';
import { DisplaysException } from '../displays.exceptions';
import type { IDisplay } from '../store/displays.store.types';

import type { IViewDisplaysProps } from './view-displays.types';

defineOptions({
	name: 'ViewDisplays',
});

const props = defineProps<IViewDisplaysProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('displaysModule.meta.displays.list.title'),
});

const { isMDDevice, isLGDevice } = useBreakpoints();

const {
	fetchDisplays,
	displays,
	displaysPaginated,
	totalRows,
	filters,
	filtersActive,
	sortBy,
	sortDir,
	paginateSize,
	paginatePage,
	areLoading,
	resetFilter,
} = useDisplaysDataSource();
const displayActions = useDisplaysActions();

const {
	isAvailable: permitJoinAvailable,
	isActive: permitJoinActive,
	remainingTimeSeconds: permitJoinRemainingSeconds,
	activating: permitJoinActivating,
	fetchStatus: fetchPermitJoinStatus,
	activate: activatePermitJoin,
} = usePermitJoin();

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);
const adjustList = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);

const isDisplaysListRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.DISPLAYS;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('displaysModule.breadcrumbs.displays.list'),
				route: router.resolve({ name: RouteNames.DISPLAYS }),
			},
		];
	}
);

const onCloseDrawer = (done?: () => void): void => {
	if (adjustList.value) {
		showDrawer.value = false;
		adjustList.value = false;

		done?.();
	} else {
		if (remoteFormChanged.value) {
			ElMessageBox.confirm(t('displaysModule.texts.confirmDiscard'), t('displaysModule.headings.discard'), {
				confirmButtonText: t('displaysModule.buttons.yes.title'),
				cancelButtonText: t('displaysModule.buttons.no.title'),
				type: 'warning',
			})
				.then((): void => {
					if (isLGDevice.value) {
						router.replace({
							name: RouteNames.DISPLAYS,
						});
					} else {
						router.push({
							name: RouteNames.DISPLAYS,
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
					name: RouteNames.DISPLAYS,
				});
			} else {
				router.push({
					name: RouteNames.DISPLAYS,
				});
			}

			done?.();
		}
	}
};

const onDisplayDetail = (id: IDisplay['id']): void => {
	router.push({
		name: RouteNames.DISPLAY,
		params: {
			id,
		},
	});
};

const onDisplayEdit = (id: IDisplay['id']): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.DISPLAYS_EDIT,
			params: {
				id,
			},
		});
	} else {
		router.push({
			name: RouteNames.DISPLAYS_EDIT,
			params: {
				id,
			},
		});
	}
};

const onDisplayRemove = (id: IDisplay['id']): void => {
	displayActions.remove(id);
};

const onResetFilters = (): void => {
	resetFilter();
};

const onAdjustList = (): void => {
	showDrawer.value = true;
	adjustList.value = true;
};

onBeforeMount((): void => {
	fetchDisplays().catch((error: unknown): void => {
		const err = error as Error;

		throw new DisplaysException('Something went wrong', err);
	});

	showDrawer.value = route.matched.find((matched) => matched.name === RouteNames.DISPLAYS_EDIT) !== undefined;
});

const onPermitJoin = async (): Promise<void> => {
	try {
		await activatePermitJoin();
		ElMessage.success(t('displaysModule.messages.permitJoinActivated'));

		// Start countdown timer
		startPermitJoinCountdown();
	} catch (error: unknown) {
		if (error instanceof DisplaysException) {
			ElMessage.error(error.message);
		} else {
			ElMessage.error(t('displaysModule.messages.permitJoinError'));
		}
	}
};

let permitJoinCountdownInterval: ReturnType<typeof setInterval> | null = null;

const startPermitJoinCountdown = (): void => {
	if (permitJoinCountdownInterval) {
		clearInterval(permitJoinCountdownInterval);
	}

	permitJoinCountdownInterval = setInterval(async () => {
		await fetchPermitJoinStatus();

		if (!permitJoinActive.value) {
			if (permitJoinCountdownInterval) {
				clearInterval(permitJoinCountdownInterval);
				permitJoinCountdownInterval = null;
			}
		}
	}, 1000);
};

onMounted(async (): Promise<void> => {
	mounted.value = true;

	if (isDisplaysListRoute.value) {
		await fetchPermitJoinStatus();

		// Start countdown if permit join is active
		if (permitJoinActive.value) {
			startPermitJoinCountdown();
		}
	}
});

onBeforeUnmount((): void => {
	if (permitJoinCountdownInterval) {
		clearInterval(permitJoinCountdownInterval);
		permitJoinCountdownInterval = null;
	}
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value = route.matched.find((matched) => matched.name === RouteNames.DISPLAYS_EDIT) !== undefined;
	}
);
</script>
