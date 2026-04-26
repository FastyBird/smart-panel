<template>
	<el-text
		truncated
		class="font-400!"
	>
		{{ plugin?.name || props.space.type }}
	</el-text>
</template>

<script setup lang="ts">
import { ElText } from 'element-plus';

import { useSpacesPlugin } from '../composables';

import type { ISpacesTableColumnPluginProps } from './spaces-table-column-plugin.types';

defineOptions({
	name: 'SpacesTableColumnPlugin',
});

const props = defineProps<ISpacesTableColumnPluginProps>();

const { plugin } = useSpacesPlugin({ type: (): typeof props.space.type => props.space.type });
</script>
