<template>
	<el-link
		:type="props.filters.states.includes(state) ? 'danger' : undefined"
		underline="never"
		class="font-400!"
		@click.stop="emit('filter-by', state, !props.filters.states.includes(state))"
	>
		<el-icon class="el-icon--left">
			<icon
				v-if="props.filters.states.includes(state)"
				icon="mdi:filter-minus"
			/>
			<icon
				v-else
				icon="mdi:filter-plus"
			/>
		</el-icon>

		{{ t(`devicesModule.states.${state}`) }}
	</el-link>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElIcon, ElLink } from 'element-plus';

import { Icon } from '@iconify/vue';

import { DevicesModuleDeviceStatusStatus } from '../../../../openapi';
import { useDeviceState } from '../../composables/composables';

import type { IDevicesTableColumnStateProps } from './devices-table-column-state.types';

defineOptions({
	name: 'DevicesTableColumnState',
});

const props = defineProps<IDevicesTableColumnStateProps>();

const emit = defineEmits<{
	(e: 'filter-by', value: DevicesModuleDeviceStatusStatus, add: boolean): void;
}>();

const { t } = useI18n();

const { state } = useDeviceState({ device: props.device });
</script>
