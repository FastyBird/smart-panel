<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		v-if="isChannelsListRoute || inDrawer"
		:title="t('devicesModule.headings.channels.list')"
		:subtitle="t('devicesModule.subHeadings.channels.list')"
		icon="mdi:chip"
		:actions="[{ icon: 'mdi:plus', label: t('devicesModule.buttons.add.title'), handler: onChannelCreate }]"
	>
		<template #actions>
			<div class="flex items-center">
				<el-button
					type="primary"
					plain
					class="ml-2!"
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
		v-if="isChannelsListRoute || inDrawer"
		class="grow-1 flex flex-col gap-2 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden mt-2"
	>
		<edit-drawer-layout
			:open="showDrawer"
			:routeless="adjustList"
			:before-close="onCloseDrawer"
			@close="onCloseDrawer()"
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

			<template #form>
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
			</template>
		</edit-drawer-layout>
	</div>

	<router-view
		v-else
		:key="props.id"
		v-slot="{ Component }"
	>
		<component :is="Component" />
	</router-view>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationRaw, type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBreadcrumbs, EditDrawerLayout, ViewError, ViewHeader, provideEditDrawer } from '../../../common';
import { ListChannels, ListChannelsAdjust } from '../components/components';
import { useChannelsActions, useChannelsDataSource, useDiscardGuard } from '../composables/composables';
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

// Template 4: forms open next to this page from tablet portrait up, as their own page on phone. After what its
// getter reads: the provider reads it at once
const { inDrawer } = provideEditDrawer((): boolean => !isChannelsListRoute.value || showDrawer.value);
const { confirmDiscard } = useDiscardGuard();

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

// Next to a docked form the page stays usable: replacing a changed form asks first, as closing it does
const canReplaceOpenForm = async (to?: RouteLocationRaw): Promise<boolean> => {
	// The form asked for is the one already open: nothing to replace, so nothing to ask
	if (to !== undefined && router.resolve(to).path === route.path) {
		return false;
	}

	if (!showDrawer.value || !remoteFormChanged.value || adjustList.value) {
		return true;
	}

	return confirmDiscard();
};

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
					if (inDrawer.value) {
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
			if (inDrawer.value) {
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

const onChannelDetail = async (id: IChannel['id']): Promise<void> => {
	if (!(await canReplaceOpenForm())) {
		return;
	}

	router.push({
		name: RouteNames.CHANNEL,
		params: {
			id,
		},
	});
};

const onChannelEdit = async (id: IChannel['id']): Promise<void> => {
	if (!(await canReplaceOpenForm({ name: RouteNames.CHANNELS_EDIT, params: { id } }))) {
		return;
	}

	if (inDrawer.value) {
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

const onChannelCreate = async (): Promise<void> => {
	if (!(await canReplaceOpenForm({ name: RouteNames.CHANNELS_ADD }))) {
		return;
	}

	if (inDrawer.value) {
		router.replace({
			name: RouteNames.CHANNELS_ADD,
		});
	} else {
		router.push({
			name: RouteNames.CHANNELS_ADD,
		});
	}
};

const onAdjustList = async (): Promise<void> => {
	// A panel without a route: only an open, changed editor needs asking, whatever page is under it
	if (!(await canReplaceOpenForm())) {
		return;
	}

	// Leave an open editor's route first, so closing the adjustment does not leave the URL on a form nobody sees
	if (showDrawer.value && !adjustList.value) {
		// A guard that keeps the editor (or another navigation) leaves the adjustment closed
		if ((await router.replace({ name: RouteNames.CHANNELS })) !== undefined) {
			return;
		}

		await nextTick();
	}

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
		// Another route means another form (the outlet is keyed by it): its changes start from zero. A navigation
		// that does not happen leaves the open form, and what it says about its changes, as it was
		remoteFormChanged.value = false;

		// An Add or Edit picked while the adjustment is open shows its form
		adjustList.value = false;

		showDrawer.value =
			route.matched.find((matched) => matched.name === RouteNames.CHANNELS_ADD || matched.name === RouteNames.CHANNELS_EDIT) !== undefined;
	}
);
</script>
