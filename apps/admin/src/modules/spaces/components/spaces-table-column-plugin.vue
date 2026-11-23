<template>
	<span class="block text-body truncate">{{ plugin?.name || props.space.type }}</span>
</template>

<script setup lang="ts">
import { useSpacesPlugin } from '../composables';

import type { ISpacesTableColumnPluginProps } from './spaces-table-column-plugin.types';

defineOptions({
	name: 'SpacesTableColumnPlugin',
});

const props = defineProps<ISpacesTableColumnPluginProps>();

const { plugin } = useSpacesPlugin({ type: (): typeof props.space.type => props.space.type });
</script>
