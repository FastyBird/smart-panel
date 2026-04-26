<template>
	<el-text
		v-if="!props.filters"
		truncated
		class="font-400!"
	>
		{{ plugin?.name || props.space.type }}
	</el-text>
	<el-text
		v-else
		truncated
	>
		<el-link
			:type="props.filters.types.includes(props.space.type) ? 'danger' : undefined"
			underline="never"
			class="font-400!"
			@click.stop="emit('filter-by', props.space.type, !props.filters.types.includes(props.space.type))"
		>
			<el-icon class="el-icon--left">
				<icon
					v-if="props.filters.types.includes(props.space.type)"
					icon="mdi:filter-minus"
				/>
				<icon
					v-else
					icon="mdi:filter-plus"
				/>
			</el-icon>

			{{ plugin?.name || props.space.type }}
		</el-link>
	</el-text>
</template>

<script setup lang="ts">
import { ElIcon, ElLink, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { IPluginElement } from '../../../common';
import { useSpacesPlugin } from '../composables';

import type { ISpacesTableColumnPluginProps } from './spaces-table-column-plugin.types';

defineOptions({
	name: 'SpacesTableColumnPlugin',
});

const props = defineProps<ISpacesTableColumnPluginProps>();

const emit = defineEmits<{
	(e: 'filter-by', value: IPluginElement['type'], add: boolean): void;
}>();

const { plugin } = useSpacesPlugin({ type: (): typeof props.space.type => props.space.type });
</script>
