<template>
	<el-link
		:type="props.filters.channels.includes(property.channel) ? 'danger' : undefined"
		:underline="false"
		class="font-400!"
		@click.stop="emit('filter-by', property.channel, !props.filters.channels.includes(property.channel))"
	>
		<el-icon class="el-icon--left">
			<icon
				v-if="props.filters.channels.includes(property.channel)"
				icon="mdi:filter-minus"
			/>
			<icon
				v-else
				icon="mdi:filter-plus"
			/>
		</el-icon>

		{{ channel?.name || property.channel }}
	</el-link>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

import { ElIcon, ElLink } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useChannel } from '../../composables';
import type { IChannel } from '../../store';

import type { IChannelsPropertiesTableColumnChannelProps } from './channels-properties-table-column-channel.types';

defineOptions({
	name: 'ChannelsPropertiesTableColumnChannel',
});

const props = defineProps<IChannelsPropertiesTableColumnChannelProps>();

const emit = defineEmits<{
	(e: 'filter-by', value: IChannel['id'], add: boolean): void;
}>();

const { channel, fetchChannel } = useChannel({ id: props.property.channel });

onMounted((): void => {
	fetchChannel().catch(() => {
		// Could be ignored
	});
});
</script>
