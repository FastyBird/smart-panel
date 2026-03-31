<template>
	<template v-if="!notFound">
		<app-breadcrumbs :items="breadcrumbs" />

		<app-bar-heading
			v-if="!isMDDevice && isDeviceRoute"
			teleport
		>
			<template #icon>
				<icon
					icon="mdi:devices"
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
			icon="mdi:devices"
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
					<el-button
						plain
						class="px-4! ml-2!"
						@click="onDeviceControl"
					>
						<template #icon>
							<icon icon="mdi:tune-variant" />
						</template>
					</el-button>

					<el-dropdown
						v-if="controls.length !== 0"
						trigger="click"
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
	</template>

	<!-- Device not found -->
	<entity-not-found
		v-if="notFound"
		icon="mdi:devices"
		:message="t('devicesModule.messages.devices.notFound')"
		:button-label="t('devicesModule.buttons.back.title')"
		@back="onClose"
	/>

	<div
		v-else-if="isDeviceRoute || isLGDevice"
		class="flex flex-col flex-1 min-h-0 lt-sm:mx-1 sm:mx-2 mb-2"
		:class="[ns.b()]"
	>
		<!-- Device info card (above tabs) -->
		<device-detail
			v-if="device"
			:device="device"
		/>

		<!-- Tabs card -->
		<el-card
			shadow="never"
			class="flex-1 min-h-0 flex flex-col mt-2"
			body-class="p-0! flex-1 min-h-0 flex flex-col"
		>
			<el-tabs
				v-model="activeTab"
				:class="['flex-1 min-h-0 flex flex-col', ns.e('tabs')]"
			>
				<el-tab-pane
					name="overview"
					class="h-full overflow-hidden"
				>
					<template #label>
						<div class="flex items-center gap-2 px-4">
							<icon icon="mdi:information-outline" />
							{{ t('devicesModule.labels.overview') }}
						</div>
					</template>

					<el-scrollbar class="h-full">
						<div class="p-2">
							<el-space
								v-if="sortedChannels"
								direction="vertical"
								size="large"
								class="w-full mb-2"
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
						</div>
					</el-scrollbar>
				</el-tab-pane>

				<el-tab-pane
					v-if="validationIssues.length > 0"
					name="validation"
					class="h-full overflow-hidden"
				>
					<template #label>
						<div class="flex items-center gap-2 px-4">
							<icon icon="mdi:alert-circle-outline" />
							{{ t('devicesModule.labels.validation') }}
							<el-tag
								type="danger"
								size="small"
							>
								{{ validationIssues.length }}
							</el-tag>
						</div>
					</template>

					<el-scrollbar class="h-full">
						<el-table
							:data="validationIssues"
							size="small"
							class="w-full"
						>
							<el-table-column
								:label="t('devicesModule.validation.table.severity')"
								prop="severity"
								:width="100"
							>
								<template #default="scope">
									<el-tag
										:type="scope.row.severity === 'error' ? 'danger' : 'warning'"
										size="small"
									>
										{{ scope.row.severity === 'error' ? t('devicesModule.validation.severity.error') : t('devicesModule.validation.severity.warning') }}
									</el-tag>
								</template>
							</el-table-column>
							<el-table-column
								:label="t('devicesModule.validation.table.type')"
								prop="type"
								:width="150"
							>
								<template #default="scope">
									{{ t(`devicesModule.validation.issueTypes.${scope.row.type}`, scope.row.type) }}
								</template>
							</el-table-column>
							<el-table-column
								:label="t('devicesModule.validation.table.message')"
								prop="message"
							/>
							<el-table-column
								:label="t('devicesModule.validation.table.channel')"
								prop="channelCategory"
								:width="150"
							>
								<template #default="scope">
									<template v-if="scope.row.channelCategory">
										{{ t(`devicesModule.categories.channels.${scope.row.channelCategory}`, scope.row.channelCategory) }}
									</template>
									<span
										v-else
										class="text-gray-400"
									>
										-
									</span>
								</template>
							</el-table-column>
						</el-table>
					</el-scrollbar>
				</el-tab-pane>

				<el-tab-pane
					name="logs"
					class="h-full overflow-hidden"
				>
					<template #label>
						<div class="flex items-center gap-2 px-4">
							<icon icon="mdi:console" />
							{{ t('devicesModule.labels.logs') }}
							<el-tag
								v-if="hasAlerts"
								type="danger"
								size="small"
							>
								{{ alertCount }}
							</el-tag>
						</div>
					</template>

					<device-logs
						v-if="device"
						v-model:live="logsLive"
						:device-id="device.id"
						:logs="sharedDeviceLogs.logs"
						:has-more="sharedDeviceLogs.hasMore"
						:is-loading="sharedDeviceLogs.isLoading"
						:live-ref="sharedDeviceLogs.live"
						:fetch-logs="sharedDeviceLogs.fetchLogs"
						:load-more-logs="sharedDeviceLogs.loadMoreLogs"
						:refresh-logs="sharedDeviceLogs.refreshLogs"
					/>
				</el-tab-pane>
			</el-tabs>
		</el-card>
	</div>

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
				<view-error>
					<template #icon>
						<icon icon="mdi:devices" />
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
	ElTabPane,
	ElTable,
	ElTableColumn,
	ElTabs,
	ElTag,
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
	EntityNotFound,
	IconWithChild,
	ViewError,
	ViewHeader,
	useBreakpoints,
	useFlashMessage,
	useUuid,
} from '../../../common';
import type { DevicesModuleChannelCategory } from '../../../openapi.constants';
import { ChannelDetail, DeviceDetail, DeviceLogs } from '../components/components';
import { useChannels, useChannelsActions, useChannelsPropertiesActions, useDevice, useDeviceControls, useDeviceLogs, useDeviceSpecification, useDeviceValidation } from '../composables/composables';
import { DevicesApiException } from '../devices.exceptions';
import { RouteNames } from '../devices.constants';
import { deviceChannelsSpecificationOrder } from '../devices.mapping';
import type { IChannelProperty } from '../store/channels.properties.store.types';
import type { IChannel } from '../store/channels.store.types';
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
const flashMessage = useFlashMessage();

const ns = useNamespace('view-device');

const { validate: validateUuid } = useUuid();

const { isMDDevice, isLGDevice } = useBreakpoints();

const { device, isLoading, fetchDevice } = useDevice({ id: props.id });
const { issues: validationIssues, fetchValidation } = useDeviceValidation({ id: props.id });

// Single shared logs composable — used for both the alert badge and the device-logs component
const sharedDeviceLogs = useDeviceLogs({
	deviceId: computed(() => props.id),
});
const { alertCount, hasAlerts, fetchLogs } = sharedDeviceLogs;

// Track if device was previously loaded to detect deletion
const wasDeviceLoaded = ref<boolean>(false);
const notFound = ref<boolean>(false);
const { canAddAnotherChannel } = useDeviceSpecification({ id: props.id });
const { channels, fetchChannels } = useChannels({ deviceId: props.id });
const { controls, fetchControls } = useDeviceControls({ deviceId: props.id });
const channelsActions = useChannelsActions();
const channelsPropertiesActions = useChannelsPropertiesActions();

if (!validateUuid(props.id)) {
	notFound.value = true;
}

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);

// Tabs state
const activeTab = ref<string>('overview');
const logsLive = ref<boolean>(false);

// Fall back to 'overview' if the active tab becomes unavailable
watch(validationIssues, (issues) => {
	if (activeTab.value === 'validation' && issues.length === 0) {
		activeTab.value = 'overview';
	}
});

// Stop live polling when leaving the logs tab
watch(activeTab, (tab) => {
	if (tab !== 'logs' && logsLive.value) {
		logsLive.value = false;
		sharedDeviceLogs.live.value = false;
	}
});

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

const onDeviceControl = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.DEVICE_CONTROL,
			params: {
				id: props.id,
			},
		});
	} else {
		router.push({
			name: RouteNames.DEVICE_CONTROL,
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
	if (notFound.value) {
		return;
	}

	fetchDevice()
		.then((): void => {
			if (!isLoading.value && device.value === null && !wasDeviceLoaded.value) {
				notFound.value = true;
				return;
			}
			// Mark as loaded if device was successfully fetched
			if (device.value !== null) {
				wasDeviceLoaded.value = true;
			}

			fetchChannels().catch((): void => {
				flashMessage.error(t('devicesModule.messages.channels.notLoadedForDevice'));
			});

			// Fetch validation data for this device
			fetchValidation().catch((): void => {
				// Silently ignore validation fetch errors - validation is non-critical
			});

			// Fetch device controls
			fetchControls().catch((): void => {
				// Silently ignore controls fetch errors - controls are optional
			});

			// Fetch device logs for alert badge
			fetchLogs().catch((): void => {
				// Silently ignore logs fetch errors - alerts badge is non-critical
			});
		})
		.catch((error: unknown): void => {
			if (error instanceof DevicesApiException && error.code === 404) {
				notFound.value = true;
			} else {
				flashMessage.error(t('devicesModule.messages.devices.notLoaded'));
				notFound.value = true;
			}
		});

	showDrawer.value =
		route.matched.find(
			(matched) =>
				matched.name === RouteNames.DEVICE_EDIT ||
				matched.name === RouteNames.DEVICE_CONTROL ||
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
					matched.name === RouteNames.DEVICE_CONTROL ||
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
		if (!val && device.value === null && !wasDeviceLoaded.value) {
			notFound.value = true;
		}
	}
);

watch(
	(): IDevice | null => device.value,
	(val: IDevice | null): void => {
		if (val !== null) {
			wasDeviceLoaded.value = true;
			meta.title = t('devicesModule.meta.devices.detail.title', { device: device.value?.name });
		} else if (wasDeviceLoaded.value && !isLoading.value) {
			// Device was previously loaded but is now null - it was deleted
			flashMessage.warning(t('devicesModule.messages.devices.deletedWhileEditing'), { duration: 0 });
			// Redirect to devices list
			if (isLGDevice.value) {
				router.replace({ name: RouteNames.DEVICES });
			} else {
				router.push({ name: RouteNames.DEVICES });
			}
		} else if (!isLoading.value && val === null && !wasDeviceLoaded.value) {
			notFound.value = true;
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
