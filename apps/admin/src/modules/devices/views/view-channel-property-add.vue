<template>
	<view-header
		:title="t('devicesModule.headings.channelsProperties.add')"
		:subtitle="t('devicesModule.subHeadings.channelsProperties.add')"
		icon="mdi:tune"
		left="close"
		:primary="{ label: t('devicesModule.buttons.save.title'), handler: onSubmit }"
		@back="() => (remoteFormChanged ? onDiscard() : onClose())"
	/>

	<app-breadcrumbs :items="breadcrumbs" />

	<div
		v-loading="isLoadingChannel || channel === null"
		:element-loading-text="t('devicesModule.texts.channels.loadingChannel')"
		class="flex flex-col overflow-hidden h-full"
	>
		<el-scrollbar
			v-if="channel !== null"
			class="grow-1 p-2 tp:px-4"
		>
			<component
				:is="element?.components?.channelPropertyAddForm"
				v-if="typeof element?.components?.channelPropertyAddForm !== 'undefined'"
				:id="newPropertyId"
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
				:type="channel.type"
				:channel="channel"
			/>

			<channel-property-add-form
				v-else
				:id="newPropertyId"
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
				:type="channel.type"
				:channel="channel"
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
						:disabled="isLoadingChannel || remoteFormResult !== FormResult.NONE"
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
import { ChannelPropertyAddForm } from '../components/components';
import { useChannel, useChannelSpecification, useChannelsPropertiesPlugins } from '../composables/composables';
import { FormResult, type FormResultType, RouteNames } from '../devices.constants';
import { DevicesApiException, DevicesException } from '../devices.exceptions';
import type { IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas } from '../devices.types';
import type { IChannel } from '../store/channels.store.types';

import type { IViewChannelPropertyAddProps } from './view-channel-property-add.types';

defineOptions({
	name: 'ViewChannelPropertyAdd',
});

const props = defineProps<IViewChannelPropertyAddProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('devicesModule.meta.channelsProperties.add.title'),
});

const { generate: uuidGenerate, validate: validateUuid } = useUuid();

// Template 4: the form sits in a drawer from tablet portrait up and is its own page on phone
const { inDrawer } = useEditDrawer();
const { isPhone } = useSizeClass();

const newPropertyId = uuidGenerate();

const { plugins } = useChannelsPropertiesPlugins();

const flashMessage = useFlashMessage();

const { channel, isLoading: isLoadingChannel, fetchChannel } = useChannel({ id: props.channelId });
const { canAddAnotherProperty } = useChannelSpecification({ id: props.channelId });

if (!validateUuid(props.channelId)) {
	throw new Error('Channel identifier is not valid');
}

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
	return plugins.value.find((plugin) => (plugin.elements ?? []).some((element) => element.type === channel.value?.type)) ?? undefined;
});

const element = computed<IPluginElement<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas> | undefined>(() => {
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
				route: router.resolve({ name: RouteNames.DEVICE_EDIT_CHANNEL, params: { channelId: props.channelId, id: props.device?.id } }),
			});
			items.push({
				label: t('devicesModule.breadcrumbs.channelsProperties.add'),
				route: router.resolve({
					name: RouteNames.DEVICE_CHANNEL_ADD_PROPERTY,
					params: { channelId: props.channelId, id: props.device?.id },
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
				label: t('devicesModule.breadcrumbs.channelsProperties.add'),
				route: router.resolve({ name: RouteNames.CHANNEL_ADD_PROPERTY, params: { id: props.channelId } }),
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
			if (!isLoadingChannel.value && channel.value === null) {
				throw new DevicesException('Channel property not found');
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

	if (!canAddAnotherProperty.value) {
		flashMessage.info(t('devicesModule.messages.channelsProperties.noMoreAllowed'));

		if (isChannelDetailRoute.value) {
			if (inDrawer.value) {
				await router.replace({ name: RouteNames.CHANNEL, params: { id: props.channelId } });
			} else {
				await router.push({ name: RouteNames.CHANNEL, params: { id: props.channelId } });
			}
		} else if (isDeviceDetailRoute.value) {
			if (inDrawer.value) {
				await router.replace({ name: RouteNames.DEVICE, params: { id: channel.value?.device } });
			} else {
				await router.push({ name: RouteNames.DEVICE, params: { id: channel.value?.device } });
			}
		} else {
			// Fallback to channels list for invalid route context
			if (inDrawer.value) {
				await router.replace({ name: RouteNames.CHANNELS });
			} else {
				await router.push({ name: RouteNames.CHANNELS });
			}
		}
	}
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
	(): IChannel | null => channel.value,
	(val: IChannel | null): void => {
		if (!isLoadingChannel.value && val === null) {
			throw new DevicesException('Channel not found');
		}
	}
);

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
					router.replace({
						name: RouteNames.DEVICE,
						params: { id: channel.value?.device },
					});
				} else {
					router.push({
						name: RouteNames.DEVICE,
						params: { id: channel.value?.device },
					});
				}
			} else {
				// Fallback to channels list for invalid route context
				if (inDrawer.value) {
					router.replace({ name: RouteNames.CHANNELS });
				} else {
					router.push({ name: RouteNames.CHANNELS });
				}
			}
		}
	}
);

watch(
	(): boolean => canAddAnotherProperty.value,
	(val: boolean): void => {
		if (!val) {
			flashMessage.info(t('devicesModule.messages.channelsProperties.noMoreAllowed'));

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
