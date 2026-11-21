<template>
	<template v-if="!notFound">
		<app-breadcrumbs :items="breadcrumbs" />

		<view-header
			v-if="isChannelRoute || inDrawer"
			:title="t('devicesModule.headings.channels.detail', { channel: channel?.name })"
			:subtitle="t('devicesModule.subHeadings.channels.detail', { channel: channel?.name })"
			icon="mdi:chip"
			:actions="[
				...(isChannelRoute && canAddAnotherProperty
					? [{ icon: 'mdi:plus', label: t('devicesModule.buttons.add.title'), handler: onPropertyAdd }]
					: []),
			]"
			@back="onClose"
		>
			<template #actions>
				<div class="flex items-center">
					<el-button
						type="primary"
						plain
						class="ml-2!"
						:disabled="!canAddAnotherProperty"
						@click="onPropertyAdd"
					>
						<template #icon>
							<icon icon="mdi:plus" />
						</template>

						{{ t('devicesModule.buttons.addProperty.title') }}
					</el-button>

					<el-button
						plain
						class="ml-2!"
						@click="onChannelEdit"
					>
						<template #icon>
							<icon icon="mdi:pencil" />
						</template>
					</el-button>
				</div>
			</template>
		</view-header>
	</template>

	<!-- Channel not found -->
	<entity-not-found
		v-if="notFound"
		icon="mdi:chip"
		:message="t('devicesModule.messages.channels.notFound')"
		:button-label="t('devicesModule.buttons.back.title')"
		@back="onClose"
	/>

	<div
		v-else-if="isChannelRoute || inDrawer"
		class="grow-1 flex flex-col gap-2 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden mt-2"
	>
		<edit-drawer-layout
			:open="showDrawer"
			:before-close="onCloseDrawer"
			@close="onCloseDrawer()"
		>
			<list-channels-properties
				v-model:filters="filters"
				v-model:sort-by="sortBy"
				v-model:sort-dir="sortDir"
				v-model:paginate-size="paginateSize"
				v-model:paginate-page="paginatePage"
				:items="propertiesPaginated"
				:all-items="properties"
				:total-rows="totalRows"
				:loading="areLoading"
				:filters-active="filtersActive"
				@edit="onPropertyEdit"
				@remove="onPropertyRemove"
				@adjust-list="onAdjustList"
				@reset-filters="onResetFilters"
			/>

			<template #form>
				<template v-if="showDrawer">
					<list-channels-properties-adjust
						v-if="adjustList"
						v-model:filters="filters"
						:filters-active="filtersActive"
						@reset-filters="onResetFilters"
					/>

					<view-error v-else>
						<template #icon>
							<icon icon="mdi:tune" />
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
									:channel="channel"
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
		<component
			:is="Component"
			:channel="channel"
		/>
	</router-view>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import {
	AppBreadcrumbs,
	EditDrawerLayout,
	EntityNotFound,
	ViewError,
	ViewHeader,
	provideEditDrawer,
	useFlashMessage,
	useUuid,
} from '../../../common';
import { ListChannelsProperties, ListChannelsPropertiesAdjust } from '../components/components';
import {
	useChannel,
	useChannelSpecification,
	useChannelsPropertiesActions,
	useChannelsPropertiesDataSource,
	useDiscardGuard,
} from '../composables/composables';
import { RouteNames } from '../devices.constants';
import { DevicesApiException } from '../devices.exceptions';
import type { IChannelProperty } from '../store/channels.properties.store.types';
import type { IChannel } from '../store/channels.store.types';

import type { IViewChannelProps } from './view-channel.types';

defineOptions({
	name: 'ViewChannel',
});

const props = defineProps<IViewChannelProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { meta } = useMeta({});
const flashMessage = useFlashMessage();

const { validate: validateUuid } = useUuid();

// Template 4: forms open next to this page from tablet portrait up, as their own page on phone
const { inDrawer } = provideEditDrawer((): boolean => !isChannelRoute.value || showDrawer.value);
const { confirmDiscard } = useDiscardGuard();

const { channel, isLoading, fetchChannel } = useChannel({ id: props.id });

// Track if channel was previously loaded to detect deletion
const wasChannelLoaded = ref<boolean>(false);
const notFound = ref<boolean>(false);
const { canAddAnotherProperty } = useChannelSpecification({ id: props.id });
const {
	properties,
	propertiesPaginated,
	totalRows,
	filters,
	filtersActive,
	sortBy,
	sortDir,
	paginateSize,
	paginatePage,
	areLoading,
	fetchProperties,
	resetFilter,
} = useChannelsPropertiesDataSource({ channelId: props.id });
const propertiesActions = useChannelsPropertiesActions();

if (!validateUuid(props.id)) {
	notFound.value = true;
}

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);
const adjustList = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);

const isChannelRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.CHANNEL;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('devicesModule.breadcrumbs.channels.list'),
				route: router.resolve({ name: RouteNames.CHANNELS }),
			},
			{
				label: t('devicesModule.breadcrumbs.channels.detail', { channel: channel.value?.name }),
				route: router.resolve({ name: RouteNames.CHANNEL }),
			},
		];
	}
);

// Next to a docked form the page stays usable: replacing a changed form asks first, as closing it does
const canReplaceOpenForm = async (): Promise<boolean> => {
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
							name: RouteNames.CHANNEL,
							params: {
								id: props.id,
							},
						});
					} else {
						router.push({
							name: RouteNames.CHANNEL,
							params: {
								id: props.id,
							},
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
					name: RouteNames.CHANNEL,
					params: {
						id: props.id,
					},
				});
			} else {
				router.push({
					name: RouteNames.CHANNEL,
					params: {
						id: props.id,
					},
				});
			}

			done?.();
		}
	}
};

const onChannelEdit = async (): Promise<void> => {
	if (!(await canReplaceOpenForm())) {
		return;
	}

	if (inDrawer.value) {
		router.replace({
			name: RouteNames.CHANNEL_EDIT,
			params: {
				id: props.id,
			},
		});
	} else {
		router.push({
			name: RouteNames.CHANNEL_EDIT,
			params: {
				id: props.id,
			},
		});
	}
};

const onPropertyAdd = async (): Promise<void> => {
	if (!(await canReplaceOpenForm())) {
		return;
	}

	if (inDrawer.value) {
		router.replace({
			name: RouteNames.CHANNEL_ADD_PROPERTY,
			params: {
				id: props.id,
			},
		});
	} else {
		router.push({
			name: RouteNames.CHANNEL_ADD_PROPERTY,
			params: {
				id: props.id,
			},
		});
	}
};

const onPropertyEdit = async (id: IChannelProperty['id']): Promise<void> => {
	if (!(await canReplaceOpenForm())) {
		return;
	}

	if (inDrawer.value) {
		router.replace({
			name: RouteNames.CHANNEL_EDIT_PROPERTY,
			params: {
				id: props.id,
				propertyId: id,
			},
		});
	} else {
		router.push({
			name: RouteNames.CHANNEL_EDIT_PROPERTY,
			params: {
				id: props.id,
				propertyId: id,
			},
		});
	}
};

const onPropertyRemove = (id: IChannelProperty['id']): void => {
	propertiesActions.remove(id);
};

const onResetFilters = (): void => {
	resetFilter();
};

const onClose = (): void => {
	if (inDrawer.value) {
		router.replace({
			name: RouteNames.CHANNELS,
		});
	} else {
		router.push({
			name: RouteNames.CHANNELS,
		});
	}
};

const onAdjustList = async (): Promise<void> => {
	if (!(await canReplaceOpenForm())) {
		return;
	}

	// Leave an open editor's route first, so closing the adjustment does not leave the URL on a form nobody sees
	if (showDrawer.value && !adjustList.value) {
		await router.replace({ name: RouteNames.CHANNEL, params: { id: props.id } });
		await nextTick();
	}

	showDrawer.value = true;
	adjustList.value = true;
};

onBeforeMount((): void => {
	if (notFound.value) {
		return;
	}

	fetchChannel()
		.then((): void => {
			if (!isLoading.value && channel.value === null && !wasChannelLoaded.value) {
				notFound.value = true;
				return;
			}
			// Mark as loaded if channel was successfully fetched
			if (channel.value !== null) {
				wasChannelLoaded.value = true;
			}

			fetchProperties().catch((): void => {
				flashMessage.error(t('devicesModule.messages.channelsProperties.notLoadedForChannel'));
			});
		})
		.catch((error: unknown): void => {
			if (error instanceof DevicesApiException && error.code === 404) {
				notFound.value = true;
			} else {
				flashMessage.error(t('devicesModule.messages.channels.notLoaded'));
				notFound.value = true;
			}
		});

	showDrawer.value =
		route.matched.find(
			(matched) =>
				matched.name === RouteNames.CHANNEL_EDIT ||
				matched.name === RouteNames.CHANNEL_ADD_PROPERTY ||
				matched.name === RouteNames.CHANNEL_EDIT_PROPERTY
		) !== undefined;
});

onMounted((): void => {
	mounted.value = true;
});

watch(
	(): string => route.path,
	(): void => {
		// An Add or Edit picked while the adjustment is open shows its form
		adjustList.value = false;

		showDrawer.value =
			route.matched.find(
				(matched) =>
					matched.name === RouteNames.CHANNEL_EDIT ||
					matched.name === RouteNames.CHANNEL_ADD_PROPERTY ||
					matched.name === RouteNames.CHANNEL_EDIT_PROPERTY
			) !== undefined;
	}
);

watch(
	(): boolean => isLoading.value,
	(val: boolean): void => {
		if (!val && channel.value === null && !wasChannelLoaded.value) {
			notFound.value = true;
		}
	}
);

watch(
	(): IChannel | null => channel.value,
	(val: IChannel | null): void => {
		if (val !== null) {
			wasChannelLoaded.value = true;
			meta.title = t('devicesModule.meta.channels.detail.title', { channel: channel.value?.name });
		} else if (wasChannelLoaded.value && !isLoading.value) {
			// Channel was previously loaded but is now null - it was deleted
			flashMessage.warning(t('devicesModule.messages.channels.deletedWhileEditing'), { duration: 0 });
			// Redirect to channels list (we can't access device ID from deleted channel)
			if (inDrawer.value) {
				router.replace({ name: RouteNames.CHANNELS });
			} else {
				router.push({ name: RouteNames.CHANNELS });
			}
		} else if (!isLoading.value && val === null && !wasChannelLoaded.value) {
			notFound.value = true;
		}
	}
);
</script>
