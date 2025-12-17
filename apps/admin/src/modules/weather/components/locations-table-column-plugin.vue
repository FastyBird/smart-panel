<template>
	<el-text truncated>
		<el-link
			:type="props.filters.types.includes(props.location.type) ? 'danger' : undefined"
			underline="never"
			class="font-400!"
			@click.stop="emit('filter-by', props.location.type, !props.filters.types.includes(props.location.type))"
		>
			<el-icon class="el-icon--left">
				<icon
					v-if="props.filters.types.includes(props.location.type)"
					icon="mdi:filter-minus"
				/>
				<icon
					v-else
					icon="mdi:filter-plus"
				/>
			</el-icon>

			{{ plugin?.name || props.location.type }}
		</el-link>
	</el-text>
</template>

<script setup lang="ts">
import { ElIcon, ElLink, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { IPluginElement } from '../../../common';
import { useWeatherLocationsPlugin } from '../composables/composables';
import type { IWeatherLocationsFilter } from '../composables/types';
import type { IWeatherLocation } from '../store/locations.store.types';

defineOptions({
	name: 'LocationsTableColumnPlugin',
});

const props = defineProps<{
	location: IWeatherLocation;
	filters: IWeatherLocationsFilter;
}>();

const emit = defineEmits<{
	(e: 'filter-by', value: IPluginElement['type'], add: boolean): void;
}>();

const { plugin } = useWeatherLocationsPlugin({ type: props.location.type });
</script>
