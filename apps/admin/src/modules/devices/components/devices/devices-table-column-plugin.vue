<template>
	<el-text truncated>
		<el-link
			:type="props.filters.types.includes(props.device.type) ? 'danger' : undefined"
			underline="never"
			class="font-400!"
			@click.stop="emit('filter-by', props.device.type, !props.filters.types.includes(props.device.type))"
		>
			<el-icon class="el-icon--left">
				<icon
					v-if="props.filters.types.includes(props.device.type)"
					icon="mdi:filter-minus"
				/>
				<icon
					v-else
					icon="mdi:filter-plus"
				/>
			</el-icon>

			{{ plugin?.name || props.device.type }}
		</el-link>
	</el-text>
</template>

<script setup lang="ts">
import { ElIcon, ElLink, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { IPluginElement } from '../../../../common';
import { useDevicesPlugin } from '../../composables/composables';

import type { IDevicesTableColumnPluginProps } from './devices-table-column-plugin.types';

defineOptions({
	name: 'DevicesTableColumnPlugin',
});

const props = defineProps<IDevicesTableColumnPluginProps>();

const emit = defineEmits<{
	(e: 'filter-by', value: IPluginElement['type'], add: boolean): void;
}>();

const { plugin } = useDevicesPlugin({ type: props.device.type });
</script>
