<template>
	<el-avatar :size="32">
		<icon
			:icon="iconName"
			class="w[20px] h[20px]"
		/>
	</el-avatar>
</template>

<script setup lang="ts">
import { ElAvatar } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useChannelPropertyIcon } from '../../composables';

import type { IChannelsPropertiesTableColumnIconProps } from './channels-properties-table-column-icon.types';

defineOptions({
	name: 'ChannelsPropertiesTableColumnIcon',
});

const props = defineProps<IChannelsPropertiesTableColumnIconProps>();

const { icon: iconName } = useChannelPropertyIcon({ id: props.property.id });
</script>
