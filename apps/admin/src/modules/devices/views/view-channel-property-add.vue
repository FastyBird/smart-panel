<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				icon="mdi:tune"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('devicesModule.headings.channelsProperties.add') }}
		</template>

		<template #subtitle>
			{{ t('devicesModule.subHeadings.channelsProperties.add') }}
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
		v-loading="isLoadingChannel || channel === null"
		:element-loading-text="t('devicesModule.texts.channels.loadingChannel')"
		class="flex flex-col overflow-hidden h-full"
	>
		<el-scrollbar
			v-if="channel !== null"
			class="grow-1 p-2 md:px-4"
		>
			<channel-property-add-form
				:id="newPropertyId"
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

				<el-button
					:loading="remoteFormResult === FormResult.WORKING"
					:disabled="isLoadingChannel || remoteFormResult !== FormResult.NONE"
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

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, useBreakpoints, useFlashMessage, useUuid } from '../../../common';
import { ChannelPropertyAddForm } from '../components';
import { useChannel, useChannelSpecification } from '../composables';
import { FormResult, type FormResultType, RouteNames } from '../devices.constants';
import { DevicesApiException, DevicesException } from '../devices.exceptions';
import type { IChannel } from '../store';

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

const { isMDDevice, isLGDevice } = useBreakpoints();

const newPropertyId = uuidGenerate();

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
	ElMessageBox.confirm(t('devicesModule.messages.misc.confirmDiscard'), t('devicesModule.headings.misc.discard'), {
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
			if (isLGDevice.value) {
				await router.replace({ name: RouteNames.CHANNEL, params: { id: props.channelId } });
			} else {
				await router.push({ name: RouteNames.CHANNEL, params: { id: props.channelId } });
			}
		} else if (isDeviceDetailRoute.value) {
			if (isLGDevice.value) {
				await router.replace({ name: RouteNames.DEVICE, params: { id: channel.value?.device } });
			} else {
				await router.push({ name: RouteNames.DEVICE, params: { id: channel.value?.device } });
			}
		} else {
			// TODO: Handle invalid route
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
				if (isLGDevice.value) {
					router.replace({ name: RouteNames.CHANNEL_EDIT_PROPERTY, params: { id: props.channelId, propertyId: newPropertyId } });
				} else {
					router.push({ name: RouteNames.CHANNEL_EDIT_PROPERTY, params: { id: props.channelId, propertyId: newPropertyId } });
				}
			} else if (isDeviceDetailRoute.value) {
				if (isLGDevice.value) {
					router.replace({
						name: RouteNames.DEVICE_CHANNEL_EDIT_PROPERTY,
						params: { id: channel.value?.device, channelId: props.channelId, propertyId: newPropertyId },
					});
				} else {
					router.push({
						name: RouteNames.DEVICE_CHANNEL_EDIT_PROPERTY,
						params: { id: channel.value?.device, channelId: props.channelId, propertyId: newPropertyId },
					});
				}
			} else {
				// TODO: Handle invalid route
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
