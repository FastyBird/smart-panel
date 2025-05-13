<template>
	<el-text
		v-if="props.property.dataType === DevicesModuleChannelPropertyData_type.string"
		truncated
	>
		{{ props.property.value }}
	</el-text>
	<template v-else>
		{{ props.property.value !== null ? props.property.value : '-' }}{{ props.property.unit ? ` ${props.property.unit}` : '' }}
	</template>
</template>

<script setup lang="ts">
import { ElText } from 'element-plus';

import { DevicesModuleChannelPropertyData_type } from '../../../../openapi';

import type { IChannelsPropertiesTableColumnValueProps } from './channels-properties-table-column-value.types';

defineOptions({
	name: 'ChannelsPropertiesTableColumnValue',
});

const props = defineProps<IChannelsPropertiesTableColumnValueProps>();
</script>
