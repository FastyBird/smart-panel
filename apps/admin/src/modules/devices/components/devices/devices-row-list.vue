<template>
	<!-- Phone (template 1): a list of rows instead of the table; a row opens the device -->
	<state-view
		v-if="props.loading && props.items.length === 0"
		kind="loading"
		:title="t('devicesModule.texts.devices.loadingDevices')"
		icon="mdi:devices"
	/>

	<state-view
		v-else-if="props.items.length === 0 && props.filtersActive"
		kind="empty"
		:title="t('devicesModule.texts.devices.noFilteredDevices')"
		icon="mdi:filter-multiple"
	>
		<template #action>
			<el-button
				plain
				@click="emit('reset-filters')"
			>
				{{ t('devicesModule.buttons.resetFilters.title') }}
			</el-button>
		</template>
	</state-view>

	<state-view
		v-else-if="props.items.length === 0"
		kind="empty"
		:title="t('devicesModule.texts.devices.noDevices')"
		icon="mdi:devices"
	/>

	<ul
		v-else
		class="m-0 p-0 list-none"
		data-test-id="devices-row-list"
	>
		<li
			v-for="device in props.items"
			:key="device.id"
			class="border-b border-b-solid border-light last:border-b-0"
		>
			<button
				class="flex items-center gap-3 w-full min-h-14 px-3 py-2 border-0 bg-transparent text-left font-inherit cursor-pointer hover:bg-fill-light"
				type="button"
				data-test-id="devices-row"
				@click="emit('detail', device.id)"
			>
				<devices-table-column-icon :device="device" />
				<span class="flex flex-col flex-1 min-w-0">
					<span class="text-[14px] leading-[22px] font-500 text-default truncate">{{ device.name }}</span>
					<span class="text-help truncate">{{ t(`devicesModule.categories.devices.${device.category}`) }}</span>
				</span>
				<status-tag
					:status="deviceStatusTag(device.status?.status)"
					:label="t(`devicesModule.states.${String(device.status?.status ?? DevicesModuleDeviceConnectionStatus.unknown).toLowerCase()}`)"
				/>
			</button>
		</li>
	</ul>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton } from 'element-plus';

import { StateView, StatusTag } from '../../../../common';
import { DevicesModuleDeviceConnectionStatus } from '../../../../openapi.constants';
import { deviceStatusTag } from '../../devices.status';
import type { IDevice } from '../../store/devices.store.types';

import type { IDevicesRowListProps } from './devices-row-list.types';
import DevicesTableColumnIcon from './devices-table-column-icon.vue';

defineOptions({
	name: 'DevicesRowList',
});

const props = defineProps<IDevicesRowListProps>();

const emit = defineEmits<{
	(e: 'detail', id: IDevice['id']): void;
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();
</script>
