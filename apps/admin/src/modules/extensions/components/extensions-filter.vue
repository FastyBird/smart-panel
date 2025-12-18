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
				:placeholder="t('extensionsModule.fields.search.placeholder')"
				class="max-w[280px] p-1"
				clearable
			>
				<template #suffix>
					<el-icon><icon icon="mdi:magnify" /></el-icon>
				</template>
			</el-input>

			<el-divider direction="vertical" />

			<el-form-item
				:label="t('extensionsModule.filters.kind.title')"
				:class="[ns.e('extension-kind')]"
				class="p-1 m-0!"
			>
				<el-radio-group v-model="innerFilters.kind">
					<el-radio-button
						:label="t('extensionsModule.labels.module')"
						value="module"
					/>
					<el-radio-button
						:label="t('extensionsModule.labels.plugin')"
						value="plugin"
					/>
					<el-radio-button
						:label="t('extensionsModule.states.all')"
						value="all"
					/>
				</el-radio-group>
			</el-form-item>
		</el-form>

		<el-button-group class="mt-1 mr-1">
			<el-button
				:type="innerViewMode === 'table' ? 'primary' : undefined"
				plain
				class="px-2!"
				@click="innerViewMode = 'table'"
			>
				<icon icon="mdi:table" />
			</el-button>
			<el-button
				:type="innerViewMode === 'cards' ? 'primary' : undefined"
				plain
				class="px-2!"
				@click="innerViewMode = 'cards'"
			>
				<icon icon="mdi:view-grid" />
			</el-button>
		</el-button-group>

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

import {
	ElButton,
	ElButtonGroup,
	ElDivider,
	ElForm,
	ElFormItem,
	ElIcon,
	ElInput,
	ElRadioButton,
	ElRadioGroup,
	type FormInstance,
	useNamespace,
} from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import type { IExtensionsFilter } from '../composables/types';

import type { IExtensionsFilterProps } from './extensions-filter.types';

defineOptions({
	name: 'ExtensionsFilter',
});

const props = withDefaults(defineProps<IExtensionsFilterProps>(), {
	viewMode: 'table',
});

const emit = defineEmits<{
	(e: 'update:filters', filters: IExtensionsFilter): void;
	(e: 'update:view-mode', mode: 'table' | 'cards'): void;
	(e: 'reset-filters'): void;
	(e: 'adjust-list'): void;
}>();

const ns = useNamespace('extensions-filter');
const { t } = useI18n();

const innerFilters = useVModel(props, 'filters', emit);
const innerViewMode = useVModel(props, 'viewMode', emit);

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
@use 'extensions-filter.scss';
</style>
