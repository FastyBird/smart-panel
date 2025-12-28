<template>
	<div class="flex w-full">
		<el-form
			ref="filterFormEl"
			:inline="true"
			:model="innerFilters"
			class="grow-1"
		>
			<el-input
				v-model="innerFilters.search"
				:placeholder="t('spacesModule.fields.search.placeholder')"
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

import { ElButton, ElForm, ElIcon, ElInput, type FormInstance } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import type { ISpacesFilter } from '../composables/types';

import type { ISpacesFilterProps } from './spaces-filter.types';

defineOptions({
	name: 'SpacesFilter',
});

const props = defineProps<ISpacesFilterProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: ISpacesFilter): void;
	(e: 'reset-filters'): void;
	(e: 'adjust-list'): void;
}>();

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
