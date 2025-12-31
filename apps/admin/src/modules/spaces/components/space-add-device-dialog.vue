<template>
	<el-dialog
		v-model="visible"
		:title="t('spacesModule.detail.devices.selectDevice')"
		class="max-w-[700px]"
		@close="onClose"
	>
		<el-input
			v-model="searchQuery"
			:placeholder="t('devicesModule.fields.devices.search.placeholder')"
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
			table-layout="fixed"
			row-key="id"
		>
			<template #empty>
				<div
					v-if="availableDevices.length === 0"
					class="h-full w-full leading-normal"
				>
					<el-result class="h-full w-full">
						<template #icon>
							<icon-with-child :size="80">
								<template #primary>
									<icon icon="mdi:power-plug" />
								</template>
								<template #secondary>
									<icon icon="mdi:information" />
								</template>
							</icon-with-child>
						</template>

						<template #title>
							{{ t('spacesModule.detail.devices.noAvailable') }}
						</template>
					</el-result>
				</div>

				<div
					v-else-if="searchQuery.trim() && filteredAvailableDevices.length === 0"
					class="h-full w-full leading-normal"
				>
					<el-result class="h-full w-full">
						<template #icon>
							<icon-with-child :size="80">
								<template #primary>
									<icon icon="mdi:power-plug" />
								</template>
								<template #secondary>
									<icon icon="mdi:filter-multiple" />
								</template>
							</icon-with-child>
						</template>

						<template #title>
							<el-text class="block">
								{{ t('devicesModule.texts.devices.noFilteredDevices') }}
							</el-text>
						</template>
					</el-result>
				</div>
			</template>
			<el-table-column :label="t('spacesModule.onboarding.deviceName')" min-width="200">
				<template #default="{ row }">
					<div class="flex items-center gap-2">
						<el-avatar :size="32">
							<icon :icon="getDeviceIcon(row)" class="w[20px] h[20px]" />
						</el-avatar>
						<div>
							<template v-if="row.description">
								<strong class="block text-sm">{{ row.name }}</strong>
								<el-text
									size="small"
									class="block leading-4"
									truncated
								>
									{{ row.description }}
								</el-text>
							</template>
							<template v-else>
								<div class="font-medium">{{ row.name }}</div>
							</template>
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

			<el-table-column label="" width="150" align="right">
				<template #default="{ row }">
					<!-- For rooms: show "Reassign" if device has a room, "Assign" otherwise -->
					<!-- For zones: always show "Assign" since zone membership doesn't change room ownership -->
					<el-button
						:type="props.spaceType === SpaceType.ROOM && row.roomId ? 'warning' : 'default'"
						plain
						size="small"
						:loading="assigningDeviceId === row.id"
						@click="onAssignDevice(row)"
					>
						<template #icon>
							<icon :icon="props.spaceType === SpaceType.ROOM && row.roomId ? 'mdi:swap-horizontal' : 'mdi:plus'" />
						</template>
						{{ props.spaceType === SpaceType.ROOM && row.roomId ? t('spacesModule.detail.devices.reassign') : t('spacesModule.detail.devices.assign') }}
					</el-button>
				</template>
			</el-table-column>
		</el-table>

		<template #footer>
			<el-button @click="onClose">
				{{ t('spacesModule.buttons.close.title') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAvatar, ElButton, ElDialog, ElInput, ElResult, ElTable, ElTableColumn, ElTag, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { IconWithChild, useFlashMessage } from '../../../common';
import { useDevices } from '../../devices/composables/composables';
import type { IDevice } from '../../devices/store/devices.store.types';
import { useSpaceDevices, useSpaces } from '../composables';
import { SpaceType } from '../spaces.constants';

import type { ISpaceAddDeviceDialogProps } from './space-add-device-dialog.types';

defineOptions({
	name: 'SpaceAddDeviceDialog',
});

const props = defineProps<ISpaceAddDeviceDialogProps>();

const emit = defineEmits<{
	(e: 'update:visible', visible: boolean): void;
	(e: 'device-added'): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const { devices: allDevices } = useDevices();
const { findById } = useSpaces();

const searchQuery = ref('');
const assigningDeviceId = ref<string | null>(null);

const {
	devices: spaceDevices,
	addDevice,
} = useSpaceDevices(
	computed(() => props.spaceId),
	computed(() => props.spaceType)
);

// Get IDs of devices already in this space (for zones, uses fetched zone device IDs)
const spaceDeviceIds = computed(() => new Set(spaceDevices.value.map((d) => d.id)));

// Get available devices (not assigned to current space)
const availableDevices = computed(() => {
	return allDevices.value
		.filter((device) => {
			// For zones, filter out devices already in this zone
			if (props.spaceType === SpaceType.ZONE) {
				return !spaceDeviceIds.value.has(device.id);
			}
			// For rooms, filter by roomId
			return device.roomId !== props.spaceId;
		})
		.sort((a, b) => a.name.localeCompare(b.name));
});

// Filter available devices by search query
const filteredAvailableDevices = computed(() => {
	const filtered = !searchQuery.value.trim()
		? availableDevices.value
		: availableDevices.value.filter((device) => {
			const query = searchQuery.value.toLowerCase();
			return device.name.toLowerCase().includes(query) ||
				device.description?.toLowerCase().includes(query);
		});

	return filtered.sort((a, b) => a.name.localeCompare(b.name));
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
	const space = findById(spaceId);
	return space?.name || 'Unknown';
};

const visible = computed({
	get: () => props.visible,
	set: (val) => emit('update:visible', val),
});

const onClose = (): void => {
	visible.value = false;
	searchQuery.value = '';
	assigningDeviceId.value = null;
};

const onAssignDevice = async (device: IDevice): Promise<void> => {
	assigningDeviceId.value = device.id;
	try {
		await addDevice(device.id);
		flashMessage.success(t('spacesModule.messages.edited', { space: device.name }));
		emit('device-added');
	} catch {
		flashMessage.error(t('spacesModule.messages.saveError'));
	} finally {
		assigningDeviceId.value = null;
	}
};

watch(
	() => props.visible,
	(val) => {
		if (!val) {
			searchQuery.value = '';
			assigningDeviceId.value = null;
		}
	}
);
</script>

