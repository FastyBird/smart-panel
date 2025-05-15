<template>
	<el-text truncated>
		<el-link
			:type="props.filters.types.includes(props.page.type) ? 'danger' : undefined"
			underline="never"
			class="font-400!"
			@click.stop="emit('filter-by', props.page.type, !props.filters.types.includes(props.page.type))"
		>
			<el-icon class="el-icon--left">
				<icon
					v-if="props.filters.types.includes(props.page.type)"
					icon="mdi:filter-minus"
				/>
				<icon
					v-else
					icon="mdi:filter-plus"
				/>
			</el-icon>

			{{ plugin?.name || props.page.type }}
		</el-link>
	</el-text>
</template>

<script setup lang="ts">
import { ElIcon, ElLink, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { IPlugin } from '../../../../common';
import { usePagesPlugin } from '../../composables/usePagesPlugin';

import type { IPagesTableColumnPluginProps } from './pages-table-column-plugin.types';

defineOptions({
	name: 'PagesTableColumnPlugin',
});

const props = defineProps<IPagesTableColumnPluginProps>();

const emit = defineEmits<{
	(e: 'filter-by', value: IPlugin['type'], add: boolean): void;
}>();

const { plugin } = usePagesPlugin({ type: props.page.type });
</script>
