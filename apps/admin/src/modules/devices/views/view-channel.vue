<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice && isChannelRoute"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:chip"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('devicesModule.headings.channels.detail', { channel: channel?.name }) }}
		</template>

		<template #subtitle>
			{{ t('devicesModule.subHeadings.channels.detail', { channel: channel?.name }) }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="onClose"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>
	</app-bar-button>

	<app-bar-button
		v-if="!isMDDevice && isChannelRoute && canAddAnotherProperty"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="onPropertyAdd"
	>
		<span class="uppercase">{{ t('devicesModule.buttons.add.title') }}</span>
	</app-bar-button>

	<view-header
		:heading="t('devicesModule.headings.channels.detail', { channel: channel?.name })"
		:sub-heading="t('devicesModule.subHeadings.channels.detail', { channel: channel?.name })"
		icon="mdi:chip"
	>
		<template #extra>
			<div class="flex items-center">
				<el-button
					type="primary"
					plain
					class="px-4! ml-2!"
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
					class="px-4! ml-2!"
					@click="onChannelEdit"
				>
					<template #icon>
						<icon icon="mdi:pencil" />
					</template>
				</el-button>
			</div>
		</template>
	</view-header>

	<!-- Channel not found -->
	<div
		v-if="notFound"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2"
	>
		<el-card
			class="mt-2"
			body-class="flex flex-row justify-center"
		>
			<el-result class="h-full max-w-[700px]">
				<template #icon>
					<icon-with-child :size="80">
						<template #primary>
							<icon icon="mdi:chip" />
						</template>
						<template #secondary>
							<icon icon="mdi:help" />
						</template>
					</icon-with-child>
				</template>

				<template #title>
					{{ t('devicesModule.messages.channels.notFound') }}
				</template>

				<template #extra>
					<el-button
						type="primary"
						@click="onClose"
					>
						{{ t('devicesModule.buttons.back.title') }}
					</el-button>
				</template>
			</el-result>
		</el-card>
	</div>

	<div
		v-else-if="isChannelRoute || isLGDevice"
		class="grow-1 flex flex-col gap-2 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden mt-2"
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
		</div>
	</el-drawer>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElCard, ElDrawer, ElIcon, ElMessageBox, ElResult } from 'element-plus';

import { Icon } from '@iconify/vue';

import {
	AppBar,
	AppBarButton,
	AppBarButtonAlign,
	AppBarHeading,
	AppBreadcrumbs,
	IconWithChild,
	ViewError,
	ViewHeader,
	useBreakpoints,
	useFlashMessage,
	useUuid,
} from '../../../common';
import { ListChannelsProperties, ListChannelsPropertiesAdjust } from '../components/components';
import { useChannel, useChannelSpecification, useChannelsPropertiesActions, useChannelsPropertiesDataSource } from '../composables/composables';
import { RouteNames } from '../devices.constants';
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

const { isMDDevice, isLGDevice } = useBreakpoints();

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
			if (isLGDevice.value) {
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

const onChannelEdit = (): void => {
	if (isLGDevice.value) {
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

const onPropertyAdd = (): void => {
	if (isLGDevice.value) {
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

const onPropertyEdit = (id: IChannelProperty['id']): void => {
	if (isLGDevice.value) {
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
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.CHANNELS,
		});
	} else {
		router.push({
			name: RouteNames.CHANNELS,
		});
	}
};

const onAdjustList = (): void => {
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
				// Silently ignore property fetch errors
			});
		})
		.catch((): void => {
			notFound.value = true;
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
			if (isLGDevice.value) {
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
