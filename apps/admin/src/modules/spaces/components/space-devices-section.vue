<template>
	<el-table
		v-loading="loading"
		:element-loading-text="t('spacesModule.detail.devices.loading')"
		:data="devices"
		table-layout="fixed"
		row-key="id"
	>
			<el-table-column :label="t('spacesModule.onboarding.deviceName')" min-width="200">
				<template #default="{ row }">
					<div class="flex items-center gap-2">
						<el-avatar :size="32">
							<icon :icon="getDeviceCategoryIcon(row.category)" class="w[20px] h[20px]" />
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

			<el-table-column :label="t('devicesModule.table.devices.columns.state.title')" width="100" align="center">
				<template #default="{ row }">
					<el-tag
						:type="row.status?.online ? 'success' : 'danger'"
						size="small"
					>
						{{ row.status?.online ? 'Online' : 'Offline' }}
					</el-tag>
				</template>
			</el-table-column>

			<el-table-column label="" :width="props.spaceType === SpaceType.ZONE ? 110 : 220" align="right">
				<template #default="{ row }">
					<div class="flex items-center gap-2 justify-end">
						<!-- Reassign button only shown for rooms (zones can have multiple assignments) -->
						<el-button
							v-if="props.spaceType === SpaceType.ROOM"
							type="warning"
							plain
							size="small"
							@click="onReassignDevice(row)"
						>
							<template #icon>
								<icon icon="mdi:swap-horizontal" />
							</template>
							{{ t('spacesModule.detail.devices.reassign') }}
						</el-button>
						<el-button
							type="danger"
							plain
							size="small"
							@click="onRemoveDevice(row)"
						>
							<template #icon>
								<icon icon="mdi:close" />
							</template>
							{{ t('spacesModule.detail.devices.remove') }}
						</el-button>
					</div>
				</template>
			</el-table-column>

		<template #empty>
			<div
				v-if="loading"
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:devices" />
							</template>
							<template #secondary>
								<icon icon="mdi:database-refresh" />
							</template>
						</icon-with-child>
					</template>
				</el-result>
			</div>

			<div
				v-else
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:devices" />
							</template>
							<template #secondary>
								<icon icon="mdi:information" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						{{ t('spacesModule.detail.devices.empty') }}
					</template>

					<template #extra>
						<el-button
							type="primary"
							plain
							@click="openAddDialog"
						>
							<template #icon>
								<icon icon="mdi:plus" />
							</template>

							{{ t('spacesModule.detail.devices.add') }}
						</el-button>
					</template>
				</el-result>
			</div>
		</template>
	</el-table>

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
import { onMounted, ref, toRef } from 'vue';

import { Icon } from '@iconify/vue';
import {
	ElAvatar,
	ElButton,
	ElDialog,
	ElMessageBox,
	ElOption,
	ElResult,
	ElSelect,
	ElTable,
	ElTableColumn,
	ElTag,
	vLoading,
} from 'element-plus';
import { useI18n } from 'vue-i18n';

import { IconWithChild, useFlashMessage } from '../../../common';
import type { IDevice } from '../../devices/store/devices.store.types';
import { useSpaceDevices, useSpaces } from '../composables';
import { SpaceType } from '../spaces.constants';

import type { ISpaceDevicesSectionProps } from './space-devices-section.types';

defineOptions({
	name: 'SpaceDevicesSection',
});

const props = defineProps<ISpaceDevicesSectionProps>();

const emit = defineEmits<{
	(e: 'open-add-dialog'): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const { roomSpaces } = useSpaces();

const spaceIdRef = toRef(props, 'spaceId');
const spaceTypeRef = toRef(props, 'spaceType');

const {
	devices,
	loading,
	fetchDevices,
	removeDevice,
	reassignDevice,
} = useSpaceDevices(spaceIdRef, spaceTypeRef);

const showReassignDialog = ref(false);
const selectedDevice = ref<IDevice | null>(null);
const selectedTargetSpace = ref<string | null>(null);
const isReassigning = ref(false);

const getDeviceCategoryIcon = (category: string): string => {
	// Simple category-based icons
	const categoryIcons: Record<string, string> = {
		generic: 'mdi:devices',
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

	return categoryIcons[category] || 'mdi:devices';
};

const openAddDialog = (): void => {
	// Emit event to parent to open dialog
	emit('open-add-dialog');
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

const onRemoveDevice = (device: IDevice): void => {
	ElMessageBox.confirm(
		t('spacesModule.detail.devices.confirmRemove', { name: device.name }),
		t('spacesModule.detail.devices.removeHeading'),
		{
			confirmButtonText: t('spacesModule.buttons.yes.title'),
			cancelButtonText: t('spacesModule.buttons.no.title'),
			type: 'warning',
		}
	)
		.then(async (): Promise<void> => {
			try {
				await removeDevice(device.id);
				flashMessage.success(t('spacesModule.detail.devices.removed', { name: device.name }));
			} catch {
				flashMessage.error(t('spacesModule.messages.saveError'));
			}
		})
		.catch((): void => {
			flashMessage.info(t('spacesModule.detail.devices.removeCanceled'));
		});
};

onMounted(async () => {
	await fetchDevices();
});

// Expose methods for parent component
defineExpose({
	openAddDialog,
	fetchDevices,
});
</script>
