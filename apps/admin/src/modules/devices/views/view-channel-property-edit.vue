<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				:icon="propertyIcon"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ property?.name ?? t(`devicesModule.categories.channelsProperties.${property?.category}`) }}
		</template>

		<template
			v-if="property?.name !== null"
			#subtitle
		>
			{{ t(`devicesModule.categories.channelsProperties.${property?.category}`) }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="() => (remoteFormChanged ? onDiscard() : onClose())"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>
	</app-bar-button>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="onSubmit"
	>
		<span class="uppercase">{{ t('devicesModule.buttons.save.title') }}</span>
	</app-bar-button>

	<app-breadcrumbs :items="breadcrumbs" />

	<div
		v-loading="isLoadingChannel || isLoading || property === null"
		:element-loading-text="
			isLoadingChannel ? t('devicesModule.texts.channels.loadingChannel') : t('devicesModule.texts.channelsProperties.loadingProperty')
		"
		class="flex flex-col overflow-hidden h-full"
	>
		<el-scrollbar
			v-if="property !== null"
			class="grow-1 p-2 md:px-4"
		>
			<component
				:is="plugin?.components?.channelPropertyEditForm"
				v-if="typeof plugin?.components?.channelPropertyEditForm !== 'undefined'"
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
				:property="property"
			/>

			<channel-property-edit-form
				v-else
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
				:property="property"
			/>
		</el-scrollbar>

		<div
			v-if="isMDDevice"
			class="flex flex-row gap-2 justify-end items-center b-t b-t-solid shadow-top z-10 w-full h-[3rem]"
			style="background-color: var(--el-drawer-bg-color)"
		>
			<div class="p-2">
				<el-button
					v-if="remoteFormChanged"
					link
					class="mr-2"
					@click="onDiscard"
				>
					{{ t('devicesModule.buttons.discard.title') }}
				</el-button>
				<el-button
					v-if="!remoteFormChanged"
					link
					class="mr-2"
					@click="onClose"
				>
					{{ t('devicesModule.buttons.close.title') }}
				</el-button>

				<el-button
					:loading="remoteFormResult === FormResult.WORKING"
					:disabled="isLoadingChannel || isLoading || remoteFormResult !== FormResult.NONE"
					type="primary"
					class="order-2"
					@click="onSubmit"
				>
					<template
						v-if="remoteFormResult === FormResult.OK || remoteFormResult === FormResult.ERROR"
						#icon
					>
						<icon
							v-if="remoteFormResult === FormResult.OK"
							icon="mdi:check-circle"
						/>
						<icon
							v-else-if="remoteFormResult === FormResult.ERROR"
							icon="mdi:cross-circle"
						/>
					</template>
					{{ t('devicesModule.buttons.save.title') }}
				</el-button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElIcon, ElMessageBox, ElScrollbar, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, type IPlugin, useBreakpoints, useUuid } from '../../../common';
import { ChannelPropertyEditForm } from '../components/components';
import { useChannel, useChannelProperty, useChannelPropertyIcon, useChannelsPropertiesPlugins } from '../composables/composables';
import { FormResult, type FormResultType, RouteNames } from '../devices.constants';
import { DevicesApiException, DevicesException } from '../devices.exceptions';
import type { IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas } from '../devices.types';
import type { IChannelProperty } from '../store/channels.properties.store.types';
import type { IChannel } from '../store/channels.store.types';

import type { IViewChannelPropertyEditProps } from './view-channel-property-edit.types';

defineOptions({
	name: 'ViewChannelPropertyEdit',
});

const props = defineProps<IViewChannelPropertyEditProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { meta } = useMeta({});

const { validate: validateUuid } = useUuid();

const { isMDDevice, isLGDevice } = useBreakpoints();

const { channel, isLoading: isLoadingChannel, fetchChannel } = useChannel({ id: props.channelId });
const { property, isLoading, fetchProperty } = useChannelProperty({ channelId: props.channelId, id: props.id });
const { icon: propertyIcon } = useChannelPropertyIcon({ id: props.id });

if (!validateUuid(props.channelId)) {
	throw new Error('Channel identifier is not valid');
}

if (!validateUuid(props.id)) {
	throw new Error('Channel property identifier is not valid');
}

const { plugins } = useChannelsPropertiesPlugins();

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormReset = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

const isDeviceDetailRoute = computed<boolean>(
	(): boolean =>
		route.matched.find((matched) => {
			return matched.name === RouteNames.DEVICE;
		}) !== undefined
);

const isChannelDetailRoute = computed<boolean>(
	(): boolean =>
		route.matched.find((matched) => {
			return matched.name === RouteNames.CHANNEL;
		}) !== undefined
);

const plugin = computed<IPlugin<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas> | undefined>(() => {
	return plugins.value.find((plugin) => plugin.type === property.value?.type);
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		const items = [];

		if (isDeviceDetailRoute.value) {
			items.push({
				label: t('devicesModule.breadcrumbs.devices.list'),
				route: router.resolve({ name: RouteNames.DEVICES }),
			});
			items.push({
				label: t('devicesModule.breadcrumbs.devices.detail', { device: props.device?.name }),
				route: router.resolve({ name: RouteNames.DEVICE, params: { id: props.device?.id } }),
			});
			items.push({
				label: t('devicesModule.breadcrumbs.channels.edit', { channel: channel.value?.name }),
				route: router.resolve({ name: RouteNames.DEVICE_EDIT_CHANNEL, params: { channelId: props.channelId, id: props.device?.id } }),
			});
			items.push({
				label: t('devicesModule.breadcrumbs.channelsProperties.edit'),
				route: router.resolve({
					name: RouteNames.DEVICE_CHANNEL_EDIT_PROPERTY,
					params: { propertyId: props.id, channelId: props.channelId, id: props.device?.id },
				}),
			});
		} else {
			items.push({
				label: t('devicesModule.breadcrumbs.channels.list'),
				route: router.resolve({ name: RouteNames.CHANNELS }),
			});
			items.push({
				label: t('devicesModule.breadcrumbs.channels.detail', { channel: channel.value?.name }),
				route: router.resolve({ name: RouteNames.CHANNEL, params: { id: props.channelId } }),
			});
			items.push({
				label: t('devicesModule.breadcrumbs.channelsProperties.edit'),
				route: router.resolve({ name: RouteNames.CHANNEL_EDIT_PROPERTY, params: { propertyId: props.id, id: props.channelId } }),
			});
		}

		return items;
	}
);

const onDiscard = (): void => {
	ElMessageBox.confirm(t('devicesModule.texts.misc.confirmDiscard'), t('devicesModule.headings.misc.discard'), {
		confirmButtonText: t('devicesModule.buttons.yes.title'),
		cancelButtonText: t('devicesModule.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			if (isChannelDetailRoute.value) {
				if (isLGDevice.value) {
					router.replace({ name: RouteNames.CHANNEL, params: { id: props.channelId } });
				} else {
					router.push({ name: RouteNames.CHANNEL, params: { id: props.channelId } });
				}
			} else if (isDeviceDetailRoute.value) {
				if (isLGDevice.value) {
					router.replace({ name: RouteNames.DEVICE, params: { id: channel.value?.device } });
				} else {
					router.push({ name: RouteNames.DEVICE, params: { id: channel.value?.device } });
				}
			} else {
				// TODO: Handle invalid route
			}
		})
		.catch((): void => {
			// Just ignore it
		});
};

const onSubmit = (): void => {
	remoteFormSubmit.value = true;
};

const onClose = (): void => {
	if (isChannelDetailRoute.value) {
		if (isLGDevice.value) {
			router.replace({ name: RouteNames.CHANNEL, params: { id: props.channelId } });
		} else {
			router.push({ name: RouteNames.CHANNEL, params: { id: props.channelId } });
		}
	} else if (isDeviceDetailRoute.value) {
		if (isLGDevice.value) {
			router.replace({ name: RouteNames.DEVICE, params: { id: channel.value?.device } });
		} else {
			router.push({ name: RouteNames.DEVICE, params: { id: channel.value?.device } });
		}
	} else {
		// TODO: Handle invalid route
	}
};

onBeforeMount(async (): Promise<void> => {
	fetchChannel()
		.then((): void => {
			if (!isLoadingChannel.value && channel.value === null) {
				throw new DevicesException('Channel property not found');
			}

			fetchProperty()
				.then((): void => {
					if (!isLoading.value && property.value === null) {
						throw new DevicesException('Channel property not found');
					}
				})
				.catch((error: unknown): void => {
					const err = error as Error;

					if (err instanceof DevicesApiException && err.code === 404) {
						throw new DevicesException('Channel property not found');
					} else {
						throw new DevicesException('Something went wrong', err);
					}
				});
		})
		.catch((error: unknown): void => {
			const err = error as Error;

			if (err instanceof DevicesApiException && err.code === 404) {
				throw new DevicesException('Channel not found');
			} else {
				throw new DevicesException('Something went wrong', err);
			}
		});
});

onMounted((): void => {
	emit('update:remote-form-changed', remoteFormChanged.value);
});

watch(
	(): boolean => isLoadingChannel.value,
	(val: boolean): void => {
		if (!val && channel.value === null) {
			throw new DevicesException('Channel not found');
		}
	}
);

watch(
	(): boolean => isLoading.value,
	(val: boolean): void => {
		if (!val && property.value === null) {
			throw new DevicesException('Channel property not found');
		}
	}
);

watch(
	(): IChannel | null => channel.value,
	(val: IChannel | null): void => {
		if (!isLoadingChannel.value && val === null) {
			throw new DevicesException('Channel not found');
		}
	}
);

watch(
	(): IChannelProperty | null => property.value,
	(val: IChannelProperty | null): void => {
		if (val !== null) {
			meta.title = t('devicesModule.meta.channelsProperties.edit.title', {
				channel: channel.value?.name,
				property: property.value?.name ?? t(`devicesModule.categories.channelsProperties.${property.value?.category}`),
			});
		}

		if (!isLoading.value && val === null) {
			throw new DevicesException('Channel property not found');
		}
	}
);

watch(
	(): boolean => remoteFormChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);
</script>
