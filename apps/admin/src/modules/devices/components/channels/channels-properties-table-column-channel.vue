<template>
	<el-link
		v-if="props.withFilters"
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
	<el-text
		v-else
		class="font-400!"
	>
		{{ channel?.name || property.channel }}
	</el-text>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

import { ElIcon, ElLink, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useChannel } from '../../composables/composables';
import type { IChannel } from '../../store/channels.store.types';

import type { IChannelsPropertiesTableColumnChannelProps } from './channels-properties-table-column-channel.types';

defineOptions({
	name: 'ChannelsPropertiesTableColumnChannel',
});

const props = withDefaults(defineProps<IChannelsPropertiesTableColumnChannelProps>(), {
	withFilters: true,
});

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
