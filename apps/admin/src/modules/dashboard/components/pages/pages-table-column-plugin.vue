<template>
	<span class="block text-body truncate">{{ plugin?.name || props.page.type }}</span>
</template>

<script setup lang="ts">
import { usePagesPlugin } from '../../composables/usePagesPlugin';

import type { IPagesTableColumnPluginProps } from './pages-table-column-plugin.types';

defineOptions({
	name: 'PagesTableColumnPlugin',
});

const props = defineProps<IPagesTableColumnPluginProps>();

const { plugin } = usePagesPlugin({ type: props.page.type });
</script>
