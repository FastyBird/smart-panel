<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice && isChannelsListRoute"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:chip"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('devicesModule.headings.channels.list') }}
		</template>

		<template #subtitle>
			{{ t('devicesModule.subHeadings.channels.list') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice && isChannelsListRoute"
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

	<app-bar-button
		v-if="!isMDDevice && isChannelsListRoute"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="onChannelCreate"
	>
		<span class="uppercase">{{ t('devicesModule.buttons.add.title') }}</span>
	</app-bar-button>

	<view-header
		:heading="t('devicesModule.headings.channels.list')"
		:sub-heading="t('devicesModule.subHeadings.channels.list')"
		icon="mdi:chip"
	>
		<template #extra>
			<div class="flex items-center">
				<el-button
					type="primary"
					plain
					class="px-4! ml-2!"
					@click="onChannelCreate"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>

					{{ t('devicesModule.buttons.add.title') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<div
		v-if="isChannelsListRoute || isLGDevice"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden"
	>
		<list-channels
			v-model:filters="filters"
			v-model:sort-by="sortBy"
			v-model:sort-dir="sortDir"
			v-model:paginate-size="paginateSize"
			v-model:paginate-page="paginatePage"
			:items="channelsPaginated"
			:all-items="channels"
			:total-rows="totalRows"
			:loading="areLoading"
			:filters-active="filtersActive"
			@detail="onChannelDetail"
			@edit="onChannelEdit"
			@remove="onChannelRemove"
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
				<list-channels-adjust
					v-if="adjustList"
					v-model:filters="filters"
					:filters-active="filtersActive"
					@reset-filters="onResetFilters"
				/>

				<view-error v-else>
					<template #icon>
						<icon icon="mdi:chip" />
					</template>
					<template #message>
						{{ t('devicesModule.messages.misc.requestError') }}
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
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElDrawer, ElIcon, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewError, ViewHeader, useBreakpoints } from '../../../common';
import { ListChannels, ListChannelsAdjust } from '../components/components';
import { useChannelsActions, useChannelsDataSource } from '../composables/composables';
import { RouteNames } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import type { IChannel } from '../store/channels.store.types';

import type { IViewChannelsProps } from './view-channels.types';

defineOptions({
	name: 'ViewChannels',
});

const props = defineProps<IViewChannelsProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('devicesModule.meta.channels.list.title'),
});

const { isMDDevice, isLGDevice } = useBreakpoints();

const {
	fetchChannels,
	channels,
	channelsPaginated,
	totalRows,
	filters,
	filtersActive,
	sortBy,
	sortDir,
	paginateSize,
	paginatePage,
	areLoading,
	resetFilter,
} = useChannelsDataSource();
const channelsActions = useChannelsActions();

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);
const adjustList = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);

const isChannelsListRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.CHANNELS;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('devicesModule.breadcrumbs.channels.list'),
				route: router.resolve({ name: RouteNames.CHANNELS }),
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
			ElMessageBox.confirm(t('devicesModule.texts.misc.confirmDiscard'), t('devicesModule.headings.misc.discard'), {
				confirmButtonText: t('devicesModule.buttons.yes.title'),
				cancelButtonText: t('devicesModule.buttons.no.title'),
				type: 'warning',
			})
				.then((): void => {
					if (isLGDevice.value) {
						router.replace({
							name: RouteNames.CHANNELS,
						});
					} else {
						router.push({
							name: RouteNames.CHANNELS,
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
					name: RouteNames.CHANNELS,
				});
			} else {
				router.push({
					name: RouteNames.CHANNELS,
				});
			}

			done?.();
		}
	}
};

const onChannelDetail = (id: IChannel['id']): void => {
	router.push({
		name: RouteNames.CHANNEL,
		params: {
			id,
		},
	});
};

const onChannelEdit = (id: IChannel['id']): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.CHANNELS_EDIT,
			params: {
				id,
			},
		});
	} else {
		router.push({
			name: RouteNames.CHANNELS_EDIT,
			params: {
				id,
			},
		});
	}
};

const onChannelRemove = (id: IChannel['id']): void => {
	channelsActions.remove(id);
};

const onResetFilters = (): void => {
	resetFilter();
};

const onChannelCreate = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.CHANNELS_ADD,
		});
	} else {
		router.push({
			name: RouteNames.CHANNELS_ADD,
		});
	}
};

const onAdjustList = (): void => {
	showDrawer.value = true;
	adjustList.value = true;
};

onBeforeMount((): void => {
	fetchChannels().catch((error: unknown): void => {
		const err = error as Error;

		throw new DevicesException('Something went wrong', err);
	});

	showDrawer.value =
		route.matched.find((matched) => matched.name === RouteNames.CHANNELS_ADD || matched.name === RouteNames.CHANNELS_EDIT) !== undefined;
});

onMounted((): void => {
	mounted.value = true;
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value =
			route.matched.find((matched) => matched.name === RouteNames.CHANNELS_ADD || matched.name === RouteNames.CHANNELS_EDIT) !== undefined;
	}
);
</script>
