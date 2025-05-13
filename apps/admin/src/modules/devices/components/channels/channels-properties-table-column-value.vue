<template>
	<el-text
		v-if="props.property.dataType === DevicesModuleChannelPropertyData_type.string"
		truncated
	>
		{{ props.property.value }}
	</el-text>
	<template v-else>
		{{ props.property.value }}
	</template>
</template>

<script setup lang="ts">
import { ElText } from 'element-plus';

import { DevicesModuleChannelPropertyData_type } from '../../../../openapi.ts';

import type { IChannelsPropertiesTableColumnValueProps } from './channels-properties-table-column-value.types';

defineOptions({
	name: 'ChannelsPropertiesTableColumnValue',
});

const props = defineProps<IChannelsPropertiesTableColumnValueProps>();
</script>
