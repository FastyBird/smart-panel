<template>
	<template v-if="!notFound">
		<app-breadcrumbs :items="breadcrumbs" />

		<view-header
			v-if="isDeviceRoute || inDrawer"
			:title="t('devicesModule.headings.devices.detail', { device: device?.name })"
			:subtitle="t('devicesModule.subHeadings.devices.detail', { device: device?.name })"
			icon="mdi:devices"
			:actions="[
				...(isDeviceRoute && canAddAnotherChannel ? [{ icon: 'mdi:plus', label: t('devicesModule.buttons.add.title'), handler: onChannelAdd }] : []),
			]"
			@back="onClose"
		>
			<template #actions>
				<div class="flex items-center">
					<el-button
						type="primary"
						plain
						class="ml-2!"
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
						class="ml-2!"
						@click="onDeviceEdit"
					>
						<template #icon>
							<icon icon="mdi:pencil" />
						</template>
					</el-button>
					<el-button
						plain
						class="ml-2!"
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
							class="ml-2!"
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
		v-else-if="isDeviceRoute || inDrawer"
		class="flex flex-col flex-1 min-h-0 lt-sm:mx-1 sm:mx-2 mb-2"
		:class="[ns.b()]"
	>
		<edit-drawer-layout
			:open="showDrawer"
			:before-close="onCloseDrawer"
			@close="onCloseDrawer()"
		>
			<!-- Device info card (above tabs) -->
			<!-- Keyed: its composables read the device id once, so another device needs a fresh summary -->
			<device-detail
				v-if="device"
				:key="device.id"
				:device="device"
			/>

			<!-- Tabs -->
			<el-tabs
				v-model="activeTab"
				:class="['flex-1 min-h-0 flex flex-col mt-2', ns.e('tabs')]"
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
						<template v-if="device">
							<component
								:is="section.component"
								v-for="section in categorySections"
								:key="`${section.id}:${device.id}`"
								:device="device"
								:active="activeTab === 'overview'"
							/>
						</template>

						<el-space
							v-if="sortedChannels.length > 0"
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
							shadow="never"
						>
							<state-view
								kind="empty"
								icon="mdi:chip"
								:title="t('devicesModule.texts.devices.noChannels')"
							>
								<template #action>
									<el-button
										type="primary"
										plain
										@click="onChannelAdd"
									>
										<template #icon>
											<icon icon="mdi:plus" />
										</template>

										{{ t('devicesModule.buttons.addChannel.title') }}
									</el-button>
								</template>
							</state-view>
						</el-card>
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
						<el-card
							shadow="never"
							body-class="p-0!"
						>
							<el-table
								:data="validationIssues"
								class="w-full"
							>
								<el-table-column
									:label="t('devicesModule.validation.table.severity')"
									prop="severity"
									:width="100"
								>
									<template #default="scope">
										<status-tag
											:status="scope.row.severity === 'error' ? 'danger' : 'warn'"
											:label="
												scope.row.severity === 'error' ? t('devicesModule.validation.severity.error') : t('devicesModule.validation.severity.warning')
											"
										/>
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
											class="text-muted"
										>
											-
										</span>
									</template>
								</el-table-column>
							</el-table>
						</el-card>
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
				<el-tab-pane
					v-for="tab in deviceDetailTabs"
					:key="tab.id"
					:name="`plugin:${tab.id}`"
					lazy
					class="h-full overflow-hidden"
				>
					<template #label>
						<!-- Plugin tabs: icon and a label of at most 16 characters (spec section 7) -->
						<div
							:title="t(tab.label)"
							class="flex items-center gap-2 px-4"
						>
							<icon :icon="tab.icon" />
							<span class="max-w-[16ch] truncate">{{ t(tab.label) }}</span>
						</div>
					</template>
					<el-scrollbar class="h-full">
						<component
							:is="tab.component"
							v-if="device && activeTab === `plugin:${tab.id}`"
							:key="device.id"
							:device="device"
						/>
					</el-scrollbar>
				</el-tab-pane>
			</el-tabs>

			<template #form>
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
			</template>
		</edit-drawer-layout>
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
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import {
	ElButton,
	ElCard,
	ElDropdown,
	ElDropdownItem,
	ElDropdownMenu,
	ElMessageBox,
	ElScrollbar,
	ElSpace,
	ElTabPane,
	ElTable,
	ElTableColumn,
	ElTabs,
	ElTag,
	useNamespace,
} from 'element-plus';

import { Icon } from '@iconify/vue';

import {
	AppBreadcrumbs,
	EditDrawerLayout,
	EntityNotFound,
	StateView,
	StatusTag,
	ViewError,
	ViewHeader,
	provideEditDrawer,
	useFlashMessage,
	useUuid,
} from '../../../common';
import type { DevicesModuleChannelCategory } from '../../../openapi.constants';
import { ChannelDetail, DeviceDetail, DeviceLogs } from '../components/components';
import {
	useChannels,
	useChannelsActions,
	useChannelsPropertiesActions,
	useDevice,
	useDeviceCategorySections,
	useDeviceControls,
	useDeviceLogs,
	useDeviceSpecification,
	useDeviceValidation,
	useDevicesPlugins,
	useDiscardGuard,
} from '../composables/composables';
import { RouteNames } from '../devices.constants';
import { DevicesApiException } from '../devices.exceptions';
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

const deviceId = computed(() => props.id);

const { device, isLoading, fetchDevice } = useDevice({ id: deviceId });
const { getElement: getDevicePluginElement } = useDevicesPlugins();
const categorySections = useDeviceCategorySections(device);
const deviceDetailTabs = computed(() =>
	device.value
		? (getDevicePluginElement(device.value.type)?.components?.deviceDetailTabs ?? []).filter((tab) => !tab.visible || tab.visible(device.value!))
		: []
);
const { issues: validationIssues, fetchValidation } = useDeviceValidation({ id: deviceId });

// Single shared logs composable — used for both the alert badge and the device-logs component
const sharedDeviceLogs = useDeviceLogs({
	deviceId: computed(() => props.id),
});
const { alertCount, hasAlerts, fetchLogs } = sharedDeviceLogs;

// Track if device was previously loaded to detect deletion
const wasDeviceLoaded = ref<boolean>(false);
const notFound = ref<boolean>(false);
const { canAddAnotherChannel } = useDeviceSpecification({ id: deviceId });
const { channels, fetchChannels } = useChannels({ deviceId });
const { controls, fetchControls } = useDeviceControls({ deviceId });
const channelsActions = useChannelsActions();
const channelsPropertiesActions = useChannelsPropertiesActions();

if (!validateUuid(props.id)) {
	notFound.value = true;
}

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);

// Tabs state
const availableTabs = computed(() => [
	'overview',
	'logs',
	...(validationIssues.value.length ? ['validation'] : []),
	...deviceDetailTabs.value.map((tab) => `plugin:${tab.id}`),
]);
const activeTab = computed<string>({
	get: () => (typeof route.query?.tab === 'string' && availableTabs.value.includes(route.query.tab) ? route.query.tab : 'overview'),
	set: (tab) => {
		void router.replace({ query: { ...route.query, tab: tab === 'overview' ? undefined : tab } });
	},
});
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

// Template 4: forms open next to this page from tablet portrait up, as their own page on phone. After what its
// getter reads: the provider reads it at once
const { inDrawer } = provideEditDrawer((): boolean => !isDeviceRoute.value);
const { confirmDiscard } = useDiscardGuard();

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

// Next to a docked form the page stays usable: replacing a changed form asks first, as closing it does
const canReplaceOpenForm = async (): Promise<boolean> => {
	if (!showDrawer.value || !remoteFormChanged.value) {
		return true;
	}

	return confirmDiscard();
};

const onCloseDrawer = (done?: () => void): void => {
	if (remoteFormChanged.value) {
		ElMessageBox.confirm(t('devicesModule.texts.misc.confirmDiscard'), t('devicesModule.headings.misc.discard'), {
			confirmButtonText: t('devicesModule.buttons.yes.title'),
			cancelButtonText: t('devicesModule.buttons.no.title'),
			type: 'warning',
		})
			.then((): void => {
				if (inDrawer.value) {
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
		if (inDrawer.value) {
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

const onDeviceEdit = async (): Promise<void> => {
	if (!(await canReplaceOpenForm())) {
		return;
	}

	if (inDrawer.value) {
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

const onDeviceControl = async (): Promise<void> => {
	if (!(await canReplaceOpenForm())) {
		return;
	}

	if (inDrawer.value) {
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

const onChannelAdd = async (): Promise<void> => {
	if (!(await canReplaceOpenForm())) {
		return;
	}

	if (inDrawer.value) {
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

const onChannelEdit = async (id: IChannel['id']): Promise<void> => {
	if (!(await canReplaceOpenForm())) {
		return;
	}

	if (inDrawer.value) {
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

const onPropertyAdd = async (channelId: IChannel['id']): Promise<void> => {
	if (!(await canReplaceOpenForm())) {
		return;
	}

	if (inDrawer.value) {
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

const onPropertyEdit = async (channelId: IChannel['id'], id: IChannelProperty['id']): Promise<void> => {
	if (!(await canReplaceOpenForm())) {
		return;
	}

	if (inDrawer.value) {
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
	if (inDrawer.value) {
		router.replace({
			name: RouteNames.DEVICES,
		});
	} else {
		router.push({
			name: RouteNames.DEVICES,
		});
	}
};

let loadGeneration = 0;

const loadDevice = (): void => {
	const generation = ++loadGeneration;
	notFound.value = false;
	wasDeviceLoaded.value = false;

	fetchDevice()
		.then((): void => {
			if (generation !== loadGeneration) {
				return;
			}

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
			if (generation !== loadGeneration) {
				return;
			}

			if (error instanceof DevicesApiException && error.code === 404) {
				notFound.value = true;
			} else {
				flashMessage.error(t('devicesModule.messages.devices.notLoaded'));
				notFound.value = true;
			}
		});
};

onBeforeMount((): void => {
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

watch(
	deviceId,
	(): void => {
		loadDevice();
	},
	{ immediate: true }
);

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
			if (inDrawer.value) {
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

			if (inDrawer.value) {
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
