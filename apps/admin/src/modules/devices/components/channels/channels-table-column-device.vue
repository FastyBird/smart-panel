<template>
	<el-link
		:type="props.filters.devices.includes(channel.device) ? 'danger' : undefined"
		:underline="false"
		class="font-400!"
		@click.stop="emit('filter-by', channel.device, !props.filters.devices.includes(channel.device))"
	>
		<el-icon class="el-icon--left">
			<icon
				v-if="props.filters.devices.includes(channel.device)"
				icon="mdi:filter-minus"
			/>
			<icon
				v-else
				icon="mdi:filter-plus"
			/>
		</el-icon>

		{{ device?.name || channel.device }}
	</el-link>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

import { ElIcon, ElLink } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useDevice } from '../../composables';
import type { IDevice } from '../../store';

import type { IChannelsTableColumnDeviceProps } from './channels-table-column-device.types';

defineOptions({
	name: 'ChannelsTableColumnDevice',
});

const props = defineProps<IChannelsTableColumnDeviceProps>();

const emit = defineEmits<{
	(e: 'filter-by', value: IDevice['id'], add: boolean): void;
}>();

const { device, fetchDevice } = useDevice(props.channel.device);

onMounted((): void => {
	fetchDevice().catch(() => {
		// Could be ignored
	});
});
</script>
