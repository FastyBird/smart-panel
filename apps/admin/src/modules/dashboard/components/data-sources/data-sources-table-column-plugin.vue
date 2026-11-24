<template>
	<span class="block text-card-title truncate">{{ plugin?.name || props.dataSource.type }}</span>
</template>

<script setup lang="ts">
import { useDataSourcesPlugin } from '../../composables/useDataSourcesPlugin';

import type { IDataSourcesTableColumnPluginProps } from './data-sources-table-column-plugin.types';

defineOptions({
	name: 'DataSourcesTableColumnPlugin',
});

const props = defineProps<IDataSourcesTableColumnPluginProps>();

const { plugin } = useDataSourcesPlugin({ type: props.dataSource.type });
</script>
