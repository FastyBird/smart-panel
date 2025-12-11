<template>
	<el-avatar :size="32">
		<icon
			icon="mdi:monitor"
			class="w[20px] h[20px]"
		/>
	</el-avatar>
</template>

<script setup lang="ts">
import { ElAvatar } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { IDisplaysTableColumnIconProps } from './displays-table-column-icon.types';

defineOptions({
	name: 'DisplaysTableColumnIcon',
});

defineProps<IDisplaysTableColumnIconProps>();
</script>
