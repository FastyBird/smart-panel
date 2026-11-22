<template>
	<view-header
		:title="property?.name ?? t(`devicesModule.categories.channelsProperties.${property?.category}`)"
		:subtitle="property?.name !== null ? t(`devicesModule.categories.channelsProperties.${property?.category}`) : undefined"
		:icon="propertyIcon"
		left="close"
		:primary="{ label: t('devicesModule.buttons.save.title'), handler: onSubmit }"
		@back="() => (remoteFormChanged ? onDiscard() : onClose())"
	/>

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
			class="grow-1 p-2 tp:px-4"
		>
			<component
				:is="element?.components?.channelPropertyEditForm"
				v-if="typeof element?.components?.channelPropertyEditForm !== 'undefined'"
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

		<!-- Wherever the phone app bar is not there to carry Save: in a drawer, and on a page kept open past 720 px.
		     Hidden rather than removed, so a plugin's teleported Next button keeps its target through a resize -->
		<form-footer
			v-show="inDrawer || !isPhone"
			:dirty="remoteFormChanged"
			:saving="remoteFormResult === FormResult.WORKING"
			@discard="onDiscard"
			@close="onClose"
		>
			<!-- Plugin add forms with several steps teleport their own primary button (Next) here -->
			<template #primary>
				<div
					:id="SUBMIT_FORM_SM"
					class="order-2 inline-block [&>*:first-child:not(:only-child)]:hidden"
				>
					<el-button
						:loading="remoteFormResult === FormResult.WORKING"
						:disabled="isLoadingChannel || isLoading || remoteFormResult !== FormResult.NONE || !remoteFormChanged"
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
			</template>
		</form-footer>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElMessageBox, ElScrollbar, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import {
	AppBreadcrumbs,
	FormFooter,
	type IPlugin,
	type IPluginElement,
	SUBMIT_FORM_SM,
	ViewHeader,
	useEditDrawer,
	useFlashMessage,
	useSizeClass,
	useUuid,
} from '../../../common';
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
const flashMessage = useFlashMessage();

const { validate: validateUuid } = useUuid();

// Template 4: the form sits in a drawer from tablet portrait up and is its own page on phone
const { inDrawer } = useEditDrawer();
const { isPhone } = useSizeClass();

const { channel, isLoading: isLoadingChannel, fetchChannel } = useChannel({ id: props.channelId });
const { property, isLoading, fetchProperty } = useChannelProperty({ channelId: props.channelId, id: props.id });

// Track if entities were previously loaded to detect deletion
const wasChannelLoaded = ref<boolean>(false);
const wasPropertyLoaded = ref<boolean>(false);
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
	return plugins.value.find((plugin) => (plugin.elements ?? []).some((element) => element.type === property.value?.type));
});

const element = computed<IPluginElement<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas> | undefined>(() => {
	return (plugin.value?.elements ?? []).find((element) => element.type === property.value?.type);
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
				if (inDrawer.value) {
					router.replace({ name: RouteNames.CHANNEL, params: { id: props.channelId } });
				} else {
					router.push({ name: RouteNames.CHANNEL, params: { id: props.channelId } });
				}
			} else if (isDeviceDetailRoute.value) {
				if (inDrawer.value) {
					router.replace({ name: RouteNames.DEVICE, params: { id: channel.value?.device } });
				} else {
					router.push({ name: RouteNames.DEVICE, params: { id: channel.value?.device } });
				}
			} else {
				// Fallback to channels list for invalid route context
				if (inDrawer.value) {
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
	if (isChannelDetailRoute.value) {
		if (inDrawer.value) {
			router.replace({ name: RouteNames.CHANNEL, params: { id: props.channelId } });
		} else {
			router.push({ name: RouteNames.CHANNEL, params: { id: props.channelId } });
		}
	} else if (isDeviceDetailRoute.value) {
		if (inDrawer.value) {
			router.replace({ name: RouteNames.DEVICE, params: { id: channel.value?.device } });
		} else {
			router.push({ name: RouteNames.DEVICE, params: { id: channel.value?.device } });
		}
	} else {
		// Fallback to channels list for invalid route context
		if (inDrawer.value) {
			router.replace({ name: RouteNames.CHANNELS });
		} else {
			router.push({ name: RouteNames.CHANNELS });
		}
	}
};

onBeforeMount(async (): Promise<void> => {
	fetchChannel()
		.then((): void => {
			// Mark channel as loaded if successfully fetched
			if (channel.value !== null) {
				wasChannelLoaded.value = true;
			}
			if (!isLoadingChannel.value && channel.value === null && !wasChannelLoaded.value) {
				throw new DevicesException('Channel property not found');
			}

			fetchProperty()
				.then((): void => {
					// Mark property as loaded if successfully fetched
					if (property.value !== null) {
						wasPropertyLoaded.value = true;
					}
					if (!isLoading.value && property.value === null && !wasPropertyLoaded.value) {
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
	(): FormResultType => remoteFormResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			if (isChannelDetailRoute.value) {
				if (inDrawer.value) {
					router.replace({ name: RouteNames.CHANNEL, params: { id: props.channelId } });
				} else {
					router.push({ name: RouteNames.CHANNEL, params: { id: props.channelId } });
				}
			} else if (isDeviceDetailRoute.value) {
				if (inDrawer.value) {
					router.replace({ name: RouteNames.DEVICE, params: { id: channel.value?.device } });
				} else {
					router.push({ name: RouteNames.DEVICE, params: { id: channel.value?.device } });
				}
			}
		}
	}
);

watch(
	(): boolean => isLoadingChannel.value,
	(val: boolean): void => {
		// Only throw error if channel was never loaded (initial load failed)
		if (!val && channel.value === null && !wasChannelLoaded.value) {
			throw new DevicesException('Channel not found');
		}
	}
);

watch(
	(): boolean => isLoading.value,
	(val: boolean): void => {
		// Only throw error if property was never loaded (initial load failed)
		if (!val && property.value === null && !wasPropertyLoaded.value) {
			throw new DevicesException('Channel property not found');
		}
	}
);

watch(
	(): IChannel | null => channel.value,
	(val: IChannel | null): void => {
		if (val !== null) {
			wasChannelLoaded.value = true;
		} else if (wasChannelLoaded.value && !isLoadingChannel.value) {
			// Channel was previously loaded but is now null - it was deleted
			flashMessage.warning(t('devicesModule.messages.channels.deletedWhileEditing'), { duration: 0 });
			// Redirect to channels list
			if (inDrawer.value) {
				router.replace({ name: RouteNames.CHANNELS });
			} else {
				router.push({ name: RouteNames.CHANNELS });
			}
		} else if (!isLoadingChannel.value && val === null && !wasChannelLoaded.value) {
			// Channel was never loaded - initial load failed
			throw new DevicesException('Channel not found');
		}
	}
);

watch(
	(): IChannelProperty | null => property.value,
	(val: IChannelProperty | null): void => {
		if (val !== null) {
			wasPropertyLoaded.value = true;
			meta.title = t('devicesModule.meta.channelsProperties.edit.title', {
				channel: channel.value?.name,
				property: property.value?.name ?? t(`devicesModule.categories.channelsProperties.${property.value?.category}`),
			});
		} else if (wasPropertyLoaded.value && !isLoading.value) {
			// Property was previously loaded but is now null - it was deleted
			flashMessage.warning(t('devicesModule.messages.channelsProperties.deletedWhileEditing'), { duration: 0 });
			// Redirect to channel detail
			if (isChannelDetailRoute.value) {
				if (inDrawer.value) {
					router.replace({ name: RouteNames.CHANNEL, params: { id: props.channelId } });
				} else {
					router.push({ name: RouteNames.CHANNEL, params: { id: props.channelId } });
				}
			} else if (isDeviceDetailRoute.value && channel.value?.device) {
				if (inDrawer.value) {
					router.replace({ name: RouteNames.DEVICE, params: { id: channel.value.device } });
				} else {
					router.push({ name: RouteNames.DEVICE, params: { id: channel.value.device } });
				}
			} else {
				// Fallback to channels list
				if (inDrawer.value) {
					router.replace({ name: RouteNames.CHANNELS });
				} else {
					router.push({ name: RouteNames.CHANNELS });
				}
			}
		} else if (!isLoading.value && val === null && !wasPropertyLoaded.value) {
			// Property was never loaded - initial load failed
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
