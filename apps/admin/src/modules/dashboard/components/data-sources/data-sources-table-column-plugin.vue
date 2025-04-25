<template>
	<el-text truncated>
		<el-link
			:type="props.filters.types.includes(props.dataSource.type) ? 'danger' : undefined"
			:underline="false"
			class="font-400!"
			@click.stop="emit('filter-by', props.dataSource.type, !props.filters.types.includes(props.dataSource.type))"
		>
			<el-icon class="el-icon--left">
				<icon
					v-if="props.filters.types.includes(props.dataSource.type)"
					icon="mdi:filter-minus"
				/>
				<icon
					v-else
					icon="mdi:filter-plus"
				/>
			</el-icon>

			{{ plugin?.name || props.dataSource.type }}
		</el-link>
	</el-text>
</template>

<script setup lang="ts">
import { ElIcon, ElLink, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { IPlugin } from '../../../../common';
import { useDataSourcesPlugin } from '../../composables/useDataSourcesPlugin';

import type { IDataSourcesTableColumnPluginProps } from './data-sources-table-column-plugin.types';

defineOptions({
	name: 'DataSourcesTableColumnPlugin',
});

const props = defineProps<IDataSourcesTableColumnPluginProps>();

const emit = defineEmits<{
	(e: 'filter-by', value: IPlugin['type'], add: boolean): void;
}>();

const { plugin } = useDataSourcesPlugin({ type: props.dataSource.type });
</script>
