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

import { useSceneIcon } from '../../composables/composables';

import type { IScenesTableColumnIconProps } from './scenes-table-column-icon.types';

defineOptions({
	name: 'ScenesTableColumnIcon',
});

const props = defineProps<IScenesTableColumnIconProps>();

const { icon: iconName } = useSceneIcon({ id: props.scene.id });
</script>
