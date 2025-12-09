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
				:placeholder="t('displaysModule.fields.search.placeholder')"
				class="max-w[280px] p-1"
				clearable
			>
				<template #suffix>
					<el-icon><icon icon="mdi:magnify" /></el-icon>
				</template>
			</el-input>
		</el-form>

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

import { ElButton, ElForm, ElIcon, ElInput, type FormInstance, useNamespace } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import type { IDisplaysFilter } from '../composables/types';

import type { IDisplaysFilterProps } from './displays-filter.types';

defineOptions({
	name: 'DisplaysFilter',
});

const props = defineProps<IDisplaysFilterProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: IDisplaysFilter): void;
	(e: 'reset-filters'): void;
	(e: 'adjust-list'): void;
}>();

const ns = useNamespace('displays-filter');
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
.displays-filter {
	display: flex;
	align-items: center;
	flex-wrap: wrap;

	:deep(.el-form-item__label) {
		font-size: 12px;
	}
}
</style>
