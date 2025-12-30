<template>
	<div class="flex w-full">
		<el-form
			ref="filterFormEl"
			:inline="true"
			:model="innerFilters"
			:class="[ns.b()]"
			class="grow-1"
		>
			<el-input
				v-model="innerFilters.search"
				:placeholder="t('devicesModule.fields.devices.search.placeholder')"
				class="max-w[280px] p-1"
				clearable
			>
				<template #suffix>
					<el-icon><icon icon="mdi:magnify" /></el-icon>
				</template>
			</el-input>

			<el-divider direction="vertical" />

			<el-form-item
				:label="t('devicesModule.fields.devices.state.title')"
				:class="[ns.e('device-state')]"
				class="p-1 m-0!"
			>
				<el-radio-group v-model="innerFilters.state">
					<el-radio-button
						:label="t('devicesModule.states.online')"
						value="online"
					/>
					<el-radio-button
						:label="t('devicesModule.states.offline')"
						value="offline"
					/>
					<el-radio-button
						:label="t('devicesModule.states.all')"
						value="all"
					/>
				</el-radio-group>
			</el-form-item>
		</el-form>

		<bulk-actions-toolbar
			:selected-count="props.selectedCount"
			:actions="props.bulkActions"
			@action="(key) => emit('bulk-action', key)"
		/>

		<el-button
			v-if="props.filtersActive"
			plain
			class="px-2! mt-1 mr-1"
			@click="emit('reset-filters')"
		>
			<icon icon="mdi:filter-off" />
		</el-button>

		<el-button
			plain
			class="px-2! mt-1 mr-1"
			@click="emit('adjust-list')"
		>
			<icon icon="mdi:slider" />
		</el-button>
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDivider, ElForm, ElFormItem, ElIcon, ElInput, ElRadioButton, ElRadioGroup, type FormInstance, useNamespace } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { BulkActionsToolbar } from '../../../../common';
import type { IDevicesFilter } from '../../composables/types';

import type { IDevicesFilterProps } from './devices-filter.types';

defineOptions({
	name: 'DevicesFilter',
});

const props = defineProps<IDevicesFilterProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: IDevicesFilter): void;
	(e: 'reset-filters'): void;
	(e: 'adjust-list'): void;
	(e: 'bulk-action', key: string): void;
}>();

const ns = useNamespace('devices-filter');
const { t } = useI18n();

const innerFilters = useVModel(props, 'filters', emit);

const filterFormEl = ref<FormInstance | undefined>(undefined);

watch(
	(): string | undefined => innerFilters.value.search,
	(val: string | undefined) => {
		if (val === '') {
			innerFilters.value.search = undefined;
		}
	}
);
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'devices-filter.scss';
</style>
