<template>
	<div v-loading="loading">
		<el-table
			v-if="devices.length > 0"
			:data="devices"
			style="width: 100%"
		>
			<el-table-column :label="t('spacesModule.onboarding.deviceName')" min-width="200">
				<template #default="{ row }">
					<div class="flex items-center gap-2">
						<el-avatar :size="32">
							<icon :icon="getDeviceIcon(row)" class="w[20px] h[20px]" />
						</el-avatar>
						<div>
							<div class="font-medium">{{ row.name }}</div>
							<div v-if="row.description" class="text-xs text-gray-500">
								{{ row.description }}
							</div>
						</div>
					</div>
				</template>
			</el-table-column>

			<el-table-column :label="t('spacesModule.table.columns.category')" width="150">
				<template #default="{ row }">
					<el-tag size="small" type="info">
						{{ row.category }}
					</el-tag>
				</template>
			</el-table-column>

			<el-table-column label="" width="100" align="center">
				<template #default="{ row }">
					<el-tag
						:type="row.status?.online ? 'success' : 'danger'"
						size="small"
					>
						{{ row.status?.online ? 'Online' : 'Offline' }}
					</el-tag>
				</template>
			</el-table-column>

			<el-table-column :label="t('spacesModule.table.columns.actions')" width="120" align="right">
				<template #default="{ row }">
					<el-dropdown trigger="click">
						<el-button link>
							<icon icon="mdi:dots-vertical" />
						</el-button>
						<template #dropdown>
							<el-dropdown-menu>
								<el-dropdown-item @click="onReassignDevice(row)">
									<icon icon="mdi:swap-horizontal" class="mr-2" />
									{{ t('spacesModule.detail.devices.reassign') }}
								</el-dropdown-item>
								<el-dropdown-item divided @click="onRemoveDevice(row)">
									<icon icon="mdi:close" class="mr-2 text-red-500" />
									<span class="text-red-500">{{ t('spacesModule.detail.devices.remove') }}</span>
								</el-dropdown-item>
							</el-dropdown-menu>
						</template>
					</el-dropdown>
				</template>
			</el-table-column>
		</el-table>

		<el-empty
			v-else
			:description="t('spacesModule.detail.devices.empty')"
			:image-size="60"
		>
			<el-button type="primary" @click="openAddDialog">
				{{ t('spacesModule.detail.devices.add') }}
			</el-button>
		</el-empty>
	</div>

	<!-- Add Device Dialog -->
	<el-dialog
		v-model="showAddDialog"
		:title="t('spacesModule.detail.devices.selectDevice')"
		width="600px"
	>
		<el-input
			v-model="searchQuery"
			:placeholder="t('spacesModule.fields.search.placeholder')"
			clearable
			class="mb-4"
		>
			<template #prefix>
				<icon icon="mdi:magnify" />
			</template>
		</el-input>

		<el-table
			:data="filteredAvailableDevices"
			max-height="400px"
			@row-click="onSelectDevice"
		>
			<el-table-column :label="t('spacesModule.onboarding.deviceName')" min-width="200">
				<template #default="{ row }">
					<div class="flex items-center gap-2">
						<el-avatar :size="32">
							<icon :icon="getDeviceIcon(row)" class="w[20px] h[20px]" />
						</el-avatar>
						<div>
							<div class="font-medium">{{ row.name }}</div>
							<div v-if="row.description" class="text-xs text-gray-500">
								{{ row.description }}
							</div>
						</div>
					</div>
				</template>
			</el-table-column>

			<el-table-column :label="t('spacesModule.onboarding.assignedSpace')" width="150">
				<template #default="{ row }">
					<el-tag v-if="row.roomId" size="small" type="warning">
						{{ getSpaceName(row.roomId) }}
					</el-tag>
					<span v-else class="text-gray-400 text-sm">-</span>
				</template>
			</el-table-column>
		</el-table>

		<template #footer>
			<el-button @click="showAddDialog = false">
				{{ t('spacesModule.buttons.cancel.title') }}
			</el-button>
		</template>
	</el-dialog>

	<!-- Reassign Device Dialog -->
	<el-dialog
		v-model="showReassignDialog"
		:title="t('spacesModule.detail.devices.reassign')"
		width="400px"
	>
		<p class="mb-4">{{ t('spacesModule.detail.devices.selectRoom') }}</p>

		<el-select
			v-model="selectedTargetSpace"
			:placeholder="t('spacesModule.onboarding.selectSpace')"
			clearable
			class="w-full"
		>
			<el-option
				v-for="space in roomSpaces"
				:key="space.id"
				:label="space.name"
				:value="space.id"
				:disabled="space.id === props.spaceId"
			/>
		</el-select>

		<template #footer>
			<el-button @click="showReassignDialog = false">
				{{ t('spacesModule.buttons.cancel.title') }}
			</el-button>
			<el-button type="primary" :loading="isReassigning" @click="confirmReassign">
				{{ t('spacesModule.buttons.save.title') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, toRef } from 'vue';

import { Icon } from '@iconify/vue';
import {
	ElAvatar,
	ElButton,
	ElDialog,
	ElDropdown,
	ElDropdownItem,
	ElDropdownMenu,
	ElEmpty,
	ElInput,
	ElMessageBox,
	ElOption,
	ElSelect,
	ElTable,
	ElTableColumn,
	ElTag,
	vLoading,
} from 'element-plus';
import { useI18n } from 'vue-i18n';

import { injectStoresManager, useFlashMessage } from '../../../common';
import type { IDevice } from '../../devices/store/devices.store.types';
import { devicesStoreKey } from '../../devices/store/keys';
import { useSpaceDevices } from '../composables';
import { SpaceType } from '../spaces.constants';
import { spacesStoreKey } from '../store';

import type { ISpaceDevicesSectionProps } from './space-devices-section.types';

defineOptions({
	name: 'SpaceDevicesSection',
});

const props = defineProps<ISpaceDevicesSectionProps>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const storesManager = injectStoresManager();
const devicesStore = storesManager.getStore(devicesStoreKey);
const spacesStore = storesManager.getStore(spacesStoreKey);

const spaceIdRef = toRef(props, 'spaceId');
const spaceTypeRef = toRef(props, 'spaceType');

const {
	devices,
	loading,
	fetchDevices,
	addDevice,
	removeDevice,
	reassignDevice,
} = useSpaceDevices(spaceIdRef, spaceTypeRef);

const showAddDialog = ref(false);
const showReassignDialog = ref(false);
const searchQuery = ref('');
const selectedDevice = ref<IDevice | null>(null);
const selectedTargetSpace = ref<string | null>(null);
const isReassigning = ref(false);

// Get all room-type spaces for reassignment
const roomSpaces = computed(() => {
	return spacesStore.findAll().filter((space) => space.type === SpaceType.ROOM);
});

// Get available devices (not assigned to current space)
const availableDevices = computed(() => {
	return devicesStore.findAll().filter((device) => {
		if (device.draft) return false;
		// Show all devices that are not in the current space
		return device.roomId !== props.spaceId;
	});
});

// Filter available devices by search query
const filteredAvailableDevices = computed(() => {
	if (!searchQuery.value.trim()) {
		return availableDevices.value;
	}

	const query = searchQuery.value.toLowerCase();
	return availableDevices.value.filter((device) =>
		device.name.toLowerCase().includes(query) ||
		device.description?.toLowerCase().includes(query)
	);
});

const getDeviceIcon = (device: IDevice): string => {
	// Simple category-based icons
	const categoryIcons: Record<string, string> = {
		generic: 'mdi:power-plug',
		lighting: 'mdi:lightbulb',
		switcher: 'mdi:toggle-switch',
		thermostat: 'mdi:thermostat',
		sensor: 'mdi:gauge',
		valve: 'mdi:pipe-valve',
		media: 'mdi:cast',
		camera: 'mdi:camera',
		door: 'mdi:door',
		lock: 'mdi:lock',
		window_covering: 'mdi:blinds',
	};

	return categoryIcons[device.category] || 'mdi:power-plug';
};

const getSpaceName = (spaceId: string): string => {
	const space = spacesStore.findById(spaceId);
	return space?.name || 'Unknown';
};

const openAddDialog = (): void => {
	showAddDialog.value = true;
};

const onSelectDevice = async (device: IDevice): Promise<void> => {
	try {
		await addDevice(device.id);
		showAddDialog.value = false;
		flashMessage.success(t('spacesModule.messages.edited', { space: device.name }));
	} catch {
		flashMessage.error(t('spacesModule.messages.saveError'));
	}
};

const onReassignDevice = (device: IDevice): void => {
	selectedDevice.value = device;
	selectedTargetSpace.value = null;
	showReassignDialog.value = true;
};

const confirmReassign = async (): Promise<void> => {
	if (!selectedDevice.value) return;

	isReassigning.value = true;

	try {
		await reassignDevice(selectedDevice.value.id, selectedTargetSpace.value);
		showReassignDialog.value = false;
		flashMessage.success(t('spacesModule.messages.edited', { space: selectedDevice.value.name }));
	} catch {
		flashMessage.error(t('spacesModule.messages.saveError'));
	} finally {
		isReassigning.value = false;
	}
};

const onRemoveDevice = async (device: IDevice): Promise<void> => {
	try {
		await ElMessageBox.confirm(
			t('spacesModule.detail.devices.confirmRemove', { name: device.name }),
			{
				type: 'warning',
			}
		);

		await removeDevice(device.id);
		flashMessage.success(t('spacesModule.messages.edited', { space: device.name }));
	} catch (error) {
		// User cancelled or error occurred
		if (error !== 'cancel') {
			flashMessage.error(t('spacesModule.messages.saveError'));
		}
	}
};

onMounted(async () => {
	await fetchDevices();
});

// Expose methods for parent component
defineExpose({
	openAddDialog,
});
</script>
