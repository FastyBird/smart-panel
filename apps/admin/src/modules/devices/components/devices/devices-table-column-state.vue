<template>
	<el-link
		:type="props.filters.states.includes(device.status.status) ? 'danger' : undefined"
		underline="never"
		class="font-400!"
		@click.stop="emit('filter-by', device.status.status, !props.filters.states.includes(device.status.status))"
	>
		<el-icon class="el-icon--left">
			<icon
				v-if="props.filters.states.includes(device.status.status)"
				icon="mdi:filter-minus"
			/>
			<icon
				v-else
				icon="mdi:filter-plus"
			/>
		</el-icon>

		{{ t(`devicesModule.states.${device.status.status}`) }}
	</el-link>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElIcon, ElLink } from 'element-plus';

import { Icon } from '@iconify/vue';

import { DevicesModuleDeviceStatusStatus } from '../../../../openapi';

import type { IDevicesTableColumnStateProps } from './devices-table-column-state.types';

defineOptions({
	name: 'DevicesTableColumnState',
});

const props = defineProps<IDevicesTableColumnStateProps>();

const emit = defineEmits<{
	(e: 'filter-by', value: DevicesModuleDeviceStatusStatus, add: boolean): void;
}>();

const { t } = useI18n();
</script>
