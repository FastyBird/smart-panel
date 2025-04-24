<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice && isDeviceRoute"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:power-plug"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('devicesModule.headings.devices.detail', { device: device?.name }) }}
		</template>

		<template #subtitle>
			{{ t('devicesModule.subHeadings.devices.detail', { device: device?.name }) }}
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
		v-if="!isMDDevice && isDeviceRoute && canAddAnotherChannel"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="onChannelAdd"
	>
		<span class="uppercase">{{ t('devicesModule.buttons.add.title') }}</span>
	</app-bar-button>

	<view-header
		:heading="t('devicesModule.headings.devices.detail', { device: device?.name })"
		:sub-heading="t('devicesModule.subHeadings.devices.detail', { device: device?.name })"
		icon="mdi:power-plug"
	>
		<template #extra>
			<div class="flex items-center">
				<el-button
					type="primary"
					plain
					class="px-4! ml-2!"
					:disabled="!canAddAnotherChannel"
					@click="onChannelAdd"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>

					{{ t('devicesModule.buttons.addChannel.title') }}
				</el-button>
				<el-button
					plain
					class="px-4! ml-2!"
					@click="onDeviceEdit"
				>
					<template #icon>
						<icon icon="mdi:pencil" />
					</template>
				</el-button>

				<el-dropdown
					trigger="click"
					:disabled="controls.length === 0"
				>
					<el-button
						plain
						class="px-4! ml-2!"
					>
						<template #icon>
							<icon icon="mdi:cog" />
						</template>
					</el-button>

					<template #dropdown>
						<el-dropdown-menu>
							<el-dropdown-item
								v-for="control of controls"
								:key="control.id"
							>
								<template #icon>
									<icon icon="mdi:pencil" />
								</template>
								{{ control.name }}
							</el-dropdown-item>
						</el-dropdown-menu>
					</template>
				</el-dropdown>
			</div>
		</template>
	</view-header>

	<el-scrollbar
		v-if="isDeviceRoute || isLGDevice"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2"
		:class="[ns.b()]"
	>
		<el-card
			v-if="device"
			class="mt-2"
			body-class="p-0!"
		>
			<device-detail :device="device" />
		</el-card>

		<el-space
			v-if="sortedChannels"
			direction="vertical"
			size="large"
			class="w-full mt-4 mb-2"
			:class="[ns.e('channels-list')]"
			fill
		>
			<channel-detail
				v-for="channel in sortedChannels"
				:key="channel.id"
				:channel="channel"
				@channel-edit="onChannelEdit"
				@channel-remove="onChannelRemove"
				@property-add="onPropertyAdd"
				@property-edit="onPropertyEdit"
				@property-remove="onPropertyRemove"
			/>
		</el-space>

		<el-card
			v-else
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
							<icon icon="mdi:timer-sand-empty" />
						</template>
					</icon-with-child>
				</template>

				<template #title>
					<el-text class="block">
						{{ t('devicesModule.texts.devices.noChannels') }}
					</el-text>

					<el-button
						type="primary"
						plain
						class="mt-4"
						@click="onChannelAdd"
					>
						<template #icon>
							<icon icon="mdi:plus" />
						</template>

						{{ t('devicesModule.buttons.addChannel.title') }}
					</el-button>
				</template>
			</el-result>
		</el-card>
	</el-scrollbar>

	<router-view
		v-else
		:key="`${props.id}-${device?.id}`"
		v-slot="{ Component }"
	>
		<component
			:is="Component"
			:device="device"
		/>
	</router-view>

	<el-drawer
		v-if="isLGDevice"
		v-model="showDrawer"
		:show-close="false"
		:size="'40%'"
		:with-header="false"
		:before-close="onCloseDrawer"
	>
		<div class="flex flex-col h-full">
			<app-bar menu-button-hidden>
				<template #button-right>
					<app-bar-button
						:align="AppBarButtonAlign.RIGHT"
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
				<view-error>
					<template #icon>
						<icon icon="mdi:power-plug" />
					</template>
					<template #message>
						{{ t('devicesModule.messages.misc.requestError') }}
					</template>

					<suspense>
						<router-view
							:key="`${props.id}-${device?.id}`"
							v-slot="{ Component }"
						>
							<component
								:is="Component"
								v-model:remote-form-changed="remoteFormChanged"
								:device="device"
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

import {
	ElButton,
	ElCard,
	ElDrawer,
	ElDropdown,
	ElDropdownItem,
	ElDropdownMenu,
	ElIcon,
	ElMessageBox,
	ElResult,
	ElScrollbar,
	ElSpace,
	ElText,
	useNamespace,
} from 'element-plus';

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
import type { DevicesModuleChannelCategory } from '../../../openapi';
import { ChannelDetail, DeviceDetail } from '../components/components';
import { useChannels, useChannelsActions, useChannelsPropertiesActions, useDevice, useDeviceSpecification } from '../composables/composables';
import { RouteNames } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import { deviceChannelsSpecificationOrder } from '../devices.mapping';
import type { IChannelProperty } from '../store/channels.properties.store.types';
import type { IChannel } from '../store/channels.store.types';
import type { IDeviceControl } from '../store/devices.controls.store.types';
import type { IDevice } from '../store/devices.store.types';

import type { IViewDeviceProps } from './view-device.types';

defineOptions({
	name: 'ViewDevice',
});

const props = defineProps<IViewDeviceProps>();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { meta } = useMeta({});

const ns = useNamespace('view-device');

const flashMessage = useFlashMessage();

const { validate: validateUuid } = useUuid();

const { isMDDevice, isLGDevice } = useBreakpoints();

const { device, isLoading, fetchDevice } = useDevice({ id: props.id });
const { canAddAnotherChannel } = useDeviceSpecification({ id: props.id });
const { channels, fetchChannels } = useChannels({ deviceId: props.id });
const channelsActions = useChannelsActions();
const channelsPropertiesActions = useChannelsPropertiesActions();

if (!validateUuid(props.id)) {
	throw new Error('Device identifier is not valid');
}

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);

const isDeviceRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.DEVICE;
});

const channelsSortOrder = computed<DevicesModuleChannelCategory[]>((): DevicesModuleChannelCategory[] => {
	if (!device.value) {
		return [];
	}

	return deviceChannelsSpecificationOrder[device.value.category] ?? [];
});

const sortedChannels = computed<IChannel[]>((): IChannel[] => {
	return channels.value
		.slice() // clone array before sorting to avoid side effects
		.sort((a, b) => {
			const indexA = channelsSortOrder.value.indexOf(a.category);
			const indexB = channelsSortOrder.value.indexOf(b.category);

			// Sort by category order first
			if (indexA !== indexB) {
				// -1 if not found to push to end
				return (indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA) - (indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB);
			}

			// Same category → sort by name
			return a.name.localeCompare(b.name);
		});
});

const controls = computed<IDeviceControl[]>((): IDeviceControl[] => {
	// TODO: Load controls
	return [];
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('devicesModule.breadcrumbs.devices.list'),
				route: router.resolve({ name: RouteNames.DEVICES }),
			},
			{
				label: t('devicesModule.breadcrumbs.devices.detail', { device: device.value?.name }),
				route: router.resolve({ name: RouteNames.DEVICE, params: { id: props.id } }),
			},
		];
	}
);

const onCloseDrawer = (done?: () => void): void => {
	if (remoteFormChanged.value) {
		ElMessageBox.confirm(t('devicesModule.texts.misc.confirmDiscard'), t('devicesModule.headings.misc.discard'), {
			confirmButtonText: t('devicesModule.buttons.yes.title'),
			cancelButtonText: t('devicesModule.buttons.no.title'),
			type: 'warning',
		})
			.then((): void => {
				if (isLGDevice.value) {
					router.replace({
						name: RouteNames.DEVICE,
						params: {
							id: props.id,
						},
					});
				} else {
					router.push({
						name: RouteNames.DEVICE,
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
				name: RouteNames.DEVICE,
				params: {
					id: props.id,
				},
			});
		} else {
			router.push({
				name: RouteNames.DEVICE,
				params: {
					id: props.id,
				},
			});
		}

		done?.();
	}
};

const onDeviceEdit = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.DEVICE_EDIT,
			params: {
				id: props.id,
			},
		});
	} else {
		router.push({
			name: RouteNames.DEVICE_EDIT,
			params: {
				id: props.id,
			},
		});
	}
};

const onChannelAdd = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.DEVICE_ADD_CHANNEL,
			params: {
				id: props.id,
			},
		});
	} else {
		router.push({
			name: RouteNames.DEVICE_ADD_CHANNEL,
			params: {
				id: props.id,
			},
		});
	}
};

const onChannelEdit = (id: IChannel['id']): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.DEVICE_EDIT_CHANNEL,
			params: {
				id: props.id,
				channelId: id,
			},
		});
	} else {
		router.push({
			name: RouteNames.DEVICE_EDIT_CHANNEL,
			params: {
				id: props.id,
				channelId: id,
			},
		});
	}
};

const onChannelRemove = (id: IChannel['id']): void => {
	channelsActions.remove(id);
};

const onPropertyAdd = (channelId: IChannel['id']): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.DEVICE_CHANNEL_ADD_PROPERTY,
			params: {
				id: props.id,
				channelId: channelId,
			},
		});
	} else {
		router.push({
			name: RouteNames.DEVICE_CHANNEL_ADD_PROPERTY,
			params: {
				id: props.id,
				channelId: channelId,
			},
		});
	}
};

const onPropertyEdit = (channelId: IChannel['id'], id: IChannelProperty['id']): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.DEVICE_CHANNEL_EDIT_PROPERTY,
			params: {
				id: props.id,
				channelId: channelId,
				propertyId: id,
			},
		});
	} else {
		router.push({
			name: RouteNames.DEVICE_CHANNEL_EDIT_PROPERTY,
			params: {
				id: props.id,
				channelId: channelId,
				propertyId: id,
			},
		});
	}
};

const onPropertyRemove = (_channelId: IChannel['id'], id: IChannelProperty['id']): void => {
	channelsPropertiesActions.remove(id);
};

const onClose = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.DEVICES,
		});
	} else {
		router.push({
			name: RouteNames.DEVICES,
		});
	}
};

onBeforeMount((): void => {
	fetchDevice()
		.then((): void => {
			if (!isLoading.value && device.value === null) {
				throw new DevicesException('Device not found');
			}

			fetchChannels().catch((error: unknown): void => {
				const err = error as Error;

				throw new DevicesException('Something went wrong', err);
			});
		})
		.catch((error: unknown): void => {
			const err = error as Error;

			throw new DevicesException('Something went wrong', err);
		});

	showDrawer.value =
		route.matched.find(
			(matched) =>
				matched.name === RouteNames.DEVICE_EDIT ||
				matched.name === RouteNames.DEVICE_ADD_CHANNEL ||
				matched.name === RouteNames.DEVICE_EDIT_CHANNEL ||
				matched.name === RouteNames.DEVICE_CHANNEL_ADD_PROPERTY ||
				matched.name === RouteNames.DEVICE_CHANNEL_EDIT_PROPERTY
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
					matched.name === RouteNames.DEVICE_EDIT ||
					matched.name === RouteNames.DEVICE_ADD_CHANNEL ||
					matched.name === RouteNames.DEVICE_EDIT_CHANNEL ||
					matched.name === RouteNames.DEVICE_CHANNEL_ADD_PROPERTY ||
					matched.name === RouteNames.DEVICE_CHANNEL_EDIT_PROPERTY
			) !== undefined;
	}
);

watch(
	(): boolean => isLoading.value,
	(val: boolean): void => {
		if (!val && device.value === null) {
			throw new DevicesException('Device not found');
		}
	}
);

watch(
	(): IDevice | null => device.value,
	(val: IDevice | null): void => {
		if (val !== null) {
			meta.title = t('devicesModule.meta.devices.detail.title', { device: device.value?.name });
		}

		if (!isLoading.value && val === null) {
			throw new DevicesException('Device not found');
		}
	}
);

watch(
	(): string => route.path,
	(): void => {
		if (route.matched.find((matched) => matched.name === RouteNames.DEVICE_ADD_CHANNEL) !== undefined && !canAddAnotherChannel) {
			flashMessage.info(t('devicesModule.messages.channels.noMoreAllowed'));

			if (isLGDevice.value) {
				router.replace({
					name: RouteNames.DEVICE,
					params: {
						id: props.id,
					},
				});
			} else {
				router.push({
					name: RouteNames.DEVICE,
					params: {
						id: props.id,
					},
				});
			}
		}
	}
);
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'view-device.scss';
</style>
