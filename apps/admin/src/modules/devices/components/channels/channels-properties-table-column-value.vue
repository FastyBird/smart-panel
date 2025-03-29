<template>
	{{ props.property.value }}
</template>

<script setup lang="ts">
import type { IChannelsPropertiesTableColumnValueProps } from './channels-properties-table-column-value.types';

defineOptions({
	name: 'ChannelsPropertiesTableColumnValue',
});

const props = defineProps<IChannelsPropertiesTableColumnValueProps>();
</script>
