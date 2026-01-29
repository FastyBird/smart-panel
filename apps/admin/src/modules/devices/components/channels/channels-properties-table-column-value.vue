<template>
	<el-text
		v-if="props.property.dataType === DevicesModuleChannelPropertyDataType.string"
		truncated
	>
		{{ displayValue }}
	</el-text>
	<template v-else>
		{{ displayValue !== null ? displayValue : '-' }}{{ props.property.unit ? ` ${props.property.unit}` : '' }}
		<span v-if="trendIcon" :title="trendLabel">{{ trendIcon }}</span>
	</template>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { ElText } from 'element-plus';

import { DevicesModuleChannelPropertyDataType } from '../../../../openapi.constants';

import type { IChannelsPropertiesTableColumnValueProps } from './channels-properties-table-column-value.types';

defineOptions({
	name: 'ChannelsPropertiesTableColumnValue',
});

const props = defineProps<IChannelsPropertiesTableColumnValueProps>();

const displayValue = computed(() => {
	const val = props.property.value;
	if (val !== null && typeof val === 'object' && 'value' in val) {
		return val.value;
	}
	return val;
});

const trendIcon = computed(() => {
	const val = props.property.value;
	if (val !== null && typeof val === 'object' && 'trend' in val) {
		switch (val.trend) {
			case 'rising':
				return '↑';
			case 'falling':
				return '↓';
			case 'stable':
				return '→';
		}
	}
	return null;
});

const trendLabel = computed(() => {
	const val = props.property.value;
	if (val !== null && typeof val === 'object' && 'trend' in val) {
		return val.trend ?? '';
	}
	return '';
});
</script>
