<template>
	<el-avatar :size="32">
		<icon
			:icon="iconName"
			class="w[20px] h[20px]"
		/>
	</el-avatar>
</template>

<script setup lang="ts">
import { ElAvatar } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useDeviceIcon } from '../../composables';

import type { IDevicesTableColumnIconProps } from './devices-table-column-icon.types';

defineOptions({
	name: 'DevicesTableColumnIcon',
});

const props = defineProps<IDevicesTableColumnIconProps>();

const { icon: iconName } = useDeviceIcon({ id: props.device.id });
</script>
