<template>
	<el-text truncated>
		<el-link
			:type="props.filters.displays.includes(props.display) ? 'danger' : undefined"
			underline="never"
			class="font-400!"
			@click.stop="emit('filter-by', props.display, !props.filters.displays.includes(props.display))"
		>
			<el-icon class="el-icon--left">
				<icon
					v-if="props.filters.displays.includes(props.display)"
					icon="mdi:filter-minus"
				/>
				<icon
					v-else
					icon="mdi:filter-plus"
				/>
			</el-icon>

			{{ display?.screenWidth }}x{{ display?.screenHeight }}
		</el-link>
	</el-text>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

import { ElIcon, ElLink, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useDisplayProfile } from '../../composables/useDisplayProfile';
import { SystemException } from '../../system.exceptions';

import type { ITableColumnDisplayProfileDisplayProps } from './table-column-display-profile-display.types';

defineOptions({
	name: 'TableColumnDisplayProfileDisplay',
});

const props = defineProps<ITableColumnDisplayProfileDisplayProps>();

const emit = defineEmits<{
	(e: 'filter-by', value: string, add: boolean): void;
}>();

const { display, fetchDisplay, isLoading } = useDisplayProfile({ id: props.display });

onMounted(() => {
	if (!isLoading.value) {
		fetchDisplay().catch((error: unknown): void => {
			const err = error as Error;

			throw new SystemException('Something went wrong', err);
		});
	}
});
</script>
