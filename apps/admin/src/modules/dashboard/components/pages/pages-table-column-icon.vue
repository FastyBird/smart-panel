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

import { usePageIcon } from '../../composables/composables';

import type { IPagesTableColumnIconProps } from './pages-table-column-icon.types';

defineOptions({
	name: 'PagesTableColumnIcon',
});

const props = defineProps<IPagesTableColumnIconProps>();

const { icon: iconName } = usePageIcon({ id: props.page.id });
</script>
