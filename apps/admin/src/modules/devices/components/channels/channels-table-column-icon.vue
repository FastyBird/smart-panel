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

import { useChannelIcon } from '../../composables/composables';

import type { IChannelsTableColumnIconProps } from './channels-table-column-icon.types';

defineOptions({
	name: 'ChannelsTableColumnIcon',
});

const props = defineProps<IChannelsTableColumnIconProps>();

const { icon: iconName } = useChannelIcon({ id: props.channel.id });
</script>
