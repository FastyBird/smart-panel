<template>
	<app-breadcrumbs
		v-if="!isOnboardingRoute"
		:items="breadcrumbs"
	/>

	<app-bar-heading
		v-if="!isMDDevice && isSpacesListRoute && !isOnboardingRoute"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:home-group"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('spacesModule.headings.list') }}
		</template>

		<template #subtitle>
			{{ t('spacesModule.subHeadings.list') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice && isSpacesListRoute && !isOnboardingRoute"
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
		v-if="!isOnboardingRoute"
		:heading="t('spacesModule.headings.list')"
		:sub-heading="t('spacesModule.subHeadings.list')"
		icon="mdi:home-group"
	>
		<template #extra>
			<div class="flex items-center">
				<el-button
					class="px-4!"
					@click="onOnboarding"
				>
					<el-icon class="mr-1"><icon icon="mdi:wizard-hat" /></el-icon>
					{{ t('spacesModule.buttons.onboarding.title') }}
				</el-button>
				<el-button
					type="primary"
					plain
					class="px-4! ml-2!"
					@click="onAddSpace"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>

					{{ t('spacesModule.buttons.add.title') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<div
		v-if="(isSpacesListRoute || isLGDevice) && !isOnboardingRoute"
		class="grow-1 flex flex-col gap-2 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden mt-2"
	>
		<list-spaces
			v-model:filters="filters"
			v-model:sort-by="sortBy"
			v-model:sort-dir="sortDir"
			v-model:paginate-size="paginateSize"
			v-model:paginate-page="paginatePage"
			:items="spacesPaginated"
			:all-items="spaces"
			:total-rows="totalRows"
			:loading="areLoading"
			:filters-active="filtersActive"
			@detail="onSpaceDetail"
			@edit="onSpaceEdit"
			@remove="onSpaceRemove"
			@add="onAddSpace"
			@adjust-list="onAdjustList"
			@reset-filters="onResetFilters"
		/>
	</div>

	<router-view
		v-if="isOnboardingRoute || (!isSpacesListRoute && !isLGDevice)"
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
				<list-spaces-adjust
					v-if="adjustList"
					v-model:filters="filters"
					:filters-active="filtersActive"
					@reset-filters="onResetFilters"
				/>

				<view-error v-else>
					<template #icon>
						<icon icon="mdi:home-group" />
					</template>
					<template #message>
						{{ t('spacesModule.messages.loadError') }}
					</template>

					<suspense>
						<router-view
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
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElDrawer, ElIcon, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewError, ViewHeader, useBreakpoints, useFlashMessage } from '../../../common';
import { ListSpaces } from '../components/components';
import ListSpacesAdjust from '../components/list-spaces-adjust.vue';
import { useSpacesActions, useSpacesDataSource } from '../composables';
import { RouteNames } from '../spaces.constants';
import type { ISpace } from '../store/spaces.store.types';

defineOptions({
	name: 'ViewSpaces',
});

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const flashMessage = useFlashMessage();

useMeta({
	title: t('spacesModule.meta.spaces.list.title'),
});

const { isMDDevice, isLGDevice } = useBreakpoints();

const {
	fetchSpaces,
	spaces,
	spacesPaginated,
	totalRows,
	filters,
	filtersActive,
	sortBy,
	sortDir,
	paginateSize,
	paginatePage,
	areLoading,
	resetFilter,
} = useSpacesDataSource();
const spacesActions = useSpacesActions();

const showDrawer = ref<boolean>(false);
const adjustList = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);

const isSpacesListRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.SPACES;
});

const isOnboardingRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.SPACES_ONBOARDING;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('spacesModule.breadcrumbs.spaces.list'),
				route: router.resolve({ name: RouteNames.SPACES }),
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
			ElMessageBox.confirm(t('spacesModule.texts.confirmDiscard'), t('spacesModule.headings.discard'), {
				confirmButtonText: t('spacesModule.buttons.yes.title'),
				cancelButtonText: t('spacesModule.buttons.no.title'),
				type: 'warning',
			})
				.then((): void => {
					if (isLGDevice.value) {
						router.replace({
							name: RouteNames.SPACES,
						});
					} else {
						router.push({
							name: RouteNames.SPACES,
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
					name: RouteNames.SPACES,
				});
			} else {
				router.push({
					name: RouteNames.SPACES,
				});
			}

			done?.();
		}
	}
};

const onSpaceDetail = (id: ISpace['id']): void => {
	router.push({
		name: RouteNames.SPACE,
		params: {
			id,
		},
	});
};

const onSpaceEdit = (id: ISpace['id']): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.SPACE_EDIT,
			params: {
				id,
			},
		});
	} else {
		router.push({
			name: RouteNames.SPACE_EDIT,
			params: {
				id,
			},
		});
	}
};

const onSpaceRemove = (id: ISpace['id']): void => {
	spacesActions.remove(id);
};

const onAddSpace = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.SPACES_EDIT,
		});
	} else {
		router.push({
			name: RouteNames.SPACES_EDIT,
		});
	}
};

const onResetFilters = (): void => {
	resetFilter();
};

const onAdjustList = (): void => {
	showDrawer.value = true;
	adjustList.value = true;
};

const onOnboarding = (): void => {
	router.push({
		name: RouteNames.SPACES_ONBOARDING,
	});
};

onBeforeMount((): void => {
	fetchSpaces().catch((): void => {
		flashMessage.error(t('spacesModule.messages.loadError'));
	});

	showDrawer.value =
		route.matched.find(
			(matched) => matched.name === RouteNames.SPACES_EDIT || matched.name === RouteNames.SPACE_EDIT || matched.name === RouteNames.SPACE
		) !== undefined;
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value =
			route.matched.find(
				(matched) => matched.name === RouteNames.SPACES_EDIT || matched.name === RouteNames.SPACE_EDIT || matched.name === RouteNames.SPACE
			) !== undefined;
	}
);
</script>
