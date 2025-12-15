<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				:icon="channelIcon"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ channel?.name }}
		</template>

		<template
			v-if="channel?.description !== null"
			#subtitle
		>
			{{ channel?.description }}
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
		v-loading="isLoading || channel === null"
		:element-loading-text="t('devicesModule.texts.channels.loadingChannel')"
		class="flex flex-col overflow-hidden h-full"
	>
		<el-scrollbar
			v-if="channel !== null"
			class="grow-1 p-2 md:px-4"
		>
			<component
				:is="element?.components?.channelEditForm"
				v-if="typeof element?.components?.channelEditForm !== 'undefined'"
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
				:channel="channel"
			/>

			<channel-edit-form
				v-else
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
				:channel="channel"
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

				<div
					:id="SUBMIT_FORM_SM"
					class="order-2 inline-block [&>*:first-child:not(:only-child)]:hidden"
				>
					<el-button
						:loading="remoteFormResult === FormResult.WORKING"
						:disabled="isLoading || remoteFormResult !== FormResult.NONE"
						type="primary"
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
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElIcon, ElMessageBox, ElScrollbar, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import {
	AppBarButton,
	AppBarButtonAlign,
	AppBarHeading,
	AppBreadcrumbs,
	type IPlugin,
	type IPluginElement,
	SUBMIT_FORM_SM,
	useBreakpoints,
	useFlashMessage,
	useUuid,
} from '../../../common';
import { ChannelEditForm } from '../components/components';
import { useChannel, useChannelIcon, useChannelsPlugins } from '../composables/composables';
import { FormResult, type FormResultType, RouteNames } from '../devices.constants';
import { DevicesApiException, DevicesException } from '../devices.exceptions';
import type { IChannelPluginsComponents, IChannelPluginsSchemas } from '../devices.types';
import type { IChannel } from '../store/channels.store.types';

import type { IViewChannelEditProps } from './view-channel-edit.types';

defineOptions({
	name: 'ViewChannelEdit',
});

const props = defineProps<IViewChannelEditProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

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
// Store device ID when channel is loaded (for redirect after deletion)
const channelDeviceId = ref<IChannel['device'] | null>(null);
const { icon: channelIcon } = useChannelIcon({ id: props.id });

if (!validateUuid(props.id)) {
	throw new Error('Channel identifier is not valid');
}

const { plugins } = useChannelsPlugins();

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

const plugin = computed<IPlugin<IChannelPluginsComponents, IChannelPluginsSchemas> | undefined>(() => {
	return plugins.value.find((plugin) => (plugin.elements ?? []).some((element) => element.type === channel.value?.type));
});

const element = computed<IPluginElement<IChannelPluginsComponents, IChannelPluginsSchemas> | undefined>(() => {
	return (plugin.value?.elements ?? []).find((element) => element.type === channel.value?.type);
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
				route: router.resolve({ name: RouteNames.DEVICE_EDIT_CHANNEL, params: { channelId: props.id, id: props.device?.id } }),
			});
		} else {
			items.push({
				label: t('devicesModule.breadcrumbs.channels.list'),
				route: router.resolve({ name: RouteNames.CHANNELS }),
			});

			if (isChannelDetailRoute.value) {
				items.push({
					label: t('devicesModule.breadcrumbs.channels.detail', { channel: channel.value?.name }),
					route: router.resolve({ name: RouteNames.CHANNEL, params: { id: props.id } }),
				});
				items.push({
					label: t('devicesModule.breadcrumbs.channels.edit', { channel: channel.value?.name }),
					route: router.resolve({ name: RouteNames.CHANNEL_EDIT, params: { id: props.id } }),
				});
			} else {
				items.push({
					label: t('devicesModule.breadcrumbs.channels.edit', { channel: channel.value?.name }),
					route: router.resolve({ name: RouteNames.CHANNELS_EDIT, params: { id: props.id } }),
				});
			}
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
			if (isDeviceDetailRoute.value) {
				if (isLGDevice.value) {
					router.replace({ name: RouteNames.DEVICE, params: { id: props.device?.id } });
				} else {
					router.push({ name: RouteNames.DEVICE, params: { id: props.device?.id } });
				}
			} else if (isChannelDetailRoute.value) {
				if (isLGDevice.value) {
					router.replace({ name: RouteNames.CHANNEL, params: { id: props.id } });
				} else {
					router.push({ name: RouteNames.CHANNEL, params: { id: props.id } });
				}
			} else {
				if (isLGDevice.value) {
					router.replace({ name: RouteNames.CHANNELS });
				} else {
					router.push({ name: RouteNames.CHANNELS });
				}
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
	if (isDeviceDetailRoute.value) {
		if (isLGDevice.value) {
			router.replace({ name: RouteNames.DEVICE, params: { id: props.device?.id } });
		} else {
			router.push({ name: RouteNames.DEVICE, params: { id: props.device?.id } });
		}
	} else if (isChannelDetailRoute.value) {
		if (isLGDevice.value) {
			router.replace({ name: RouteNames.CHANNEL, params: { id: props.id } });
		} else {
			router.push({ name: RouteNames.CHANNEL, params: { id: props.id } });
		}
	} else {
		if (isLGDevice.value) {
			router.replace({ name: RouteNames.CHANNELS });
		} else {
			router.push({ name: RouteNames.CHANNELS });
		}
	}
};

onBeforeMount(async (): Promise<void> => {
	fetchChannel()
		.then((): void => {
			if (!isLoading.value && channel.value === null && !wasChannelLoaded.value) {
				throw new DevicesException('Channel not found');
			}
			// Mark as loaded if channel was successfully fetched
			if (channel.value !== null) {
				wasChannelLoaded.value = true;
			}
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
	(): boolean => isLoading.value,
	(val: boolean): void => {
		// Only throw error if channel was never loaded (initial load failed)
		if (!val && channel.value === null && !wasChannelLoaded.value) {
			throw new DevicesException('Channel not found');
		}
	}
);

watch(
	(): IChannel | null => channel.value,
	(val: IChannel | null): void => {
		if (val !== null) {
			wasChannelLoaded.value = true;
			// Store device ID for redirect after deletion
			channelDeviceId.value = val.device;
			meta.title = t('devicesModule.meta.channels.edit.title', { channel: channel.value?.name });
		} else if (wasChannelLoaded.value && !isLoading.value) {
			// Channel was previously loaded but is now null - it was deleted
			flashMessage.warning(t('devicesModule.messages.channels.deletedWhileEditing'), { duration: 0 });
			// Redirect based on route context
			if (isDeviceDetailRoute.value) {
				if (isLGDevice.value) {
					router.replace({ name: RouteNames.DEVICE, params: { id: props.device?.id } });
				} else {
					router.push({ name: RouteNames.DEVICE, params: { id: props.device?.id } });
				}
			} else if (isChannelDetailRoute.value) {
				// Channel was deleted - redirect to device if we have device ID, otherwise to channels list
				if (channelDeviceId.value !== null) {
					if (isLGDevice.value) {
						router.replace({ name: RouteNames.DEVICE, params: { id: channelDeviceId.value } });
					} else {
						router.push({ name: RouteNames.DEVICE, params: { id: channelDeviceId.value } });
					}
				} else {
					// Fallback to channels list if device ID is not available
					if (isLGDevice.value) {
						router.replace({ name: RouteNames.CHANNELS });
					} else {
						router.push({ name: RouteNames.CHANNELS });
					}
				}
			} else {
				// Redirect to channels list
				if (isLGDevice.value) {
					router.replace({ name: RouteNames.CHANNELS });
				} else {
					router.push({ name: RouteNames.CHANNELS });
				}
			}
		} else if (!isLoading.value && val === null && !wasChannelLoaded.value) {
			// Channel was never loaded - initial load failed
			throw new DevicesException('Channel not found');
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
