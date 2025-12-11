<template>
	<el-link
		:type="props.filters.states.includes(display.status ?? 'unknown') ? 'danger' : undefined"
		underline="never"
		class="font-400!"
		@click.stop="emit('filter-by', display.status ?? 'unknown', !props.filters.states.includes(display.status ?? 'unknown'))"
	>
		<el-icon class="el-icon--left">
			<icon
				v-if="props.filters.states.includes(display.status ?? 'unknown')"
				icon="mdi:filter-minus"
			/>
			<icon
				v-else
				icon="mdi:filter-plus"
			/>
		</el-icon>

		{{ t(`displaysModule.states.${display.status ?? 'unknown'}`) }}
	</el-link>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElIcon, ElLink } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { IDisplay } from '../store/displays.store.types';

import type { IDisplaysTableColumnStateProps } from './displays-table-column-state.types';

defineOptions({
	name: 'DisplaysTableColumnState',
});

const props = defineProps<IDisplaysTableColumnStateProps>();

const emit = defineEmits<{
	(e: 'filter-by', value: IDisplay['status'], add: boolean): void;
}>();

const { t } = useI18n();
</script>
