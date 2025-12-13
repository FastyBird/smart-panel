<template>
	<div class="flex w-full flex-wrap gap-2 items-center">
		<el-input
			v-model="innerFilters.search"
			:placeholder="t('extensionsModule.fields.search.placeholder')"
			class="max-w-[280px] min-w-[200px]"
			clearable
		>
			<template #suffix>
				<el-icon><icon icon="mdi:magnify" /></el-icon>
			</template>
		</el-input>

		<el-divider direction="vertical" />

		<el-form-item
			:label="t('extensionsModule.fields.kind.title')"
			class="m-0!"
		>
			<el-radio-group v-model="innerFilters.kind">
				<el-radio-button
					:label="t('extensionsModule.tabs.all')"
					value="all"
				/>
				<el-radio-button
					:label="t('extensionsModule.labels.module')"
					value="module"
				/>
				<el-radio-button
					:label="t('extensionsModule.labels.plugin')"
					value="plugin"
				/>
			</el-radio-group>
		</el-form-item>

		<el-divider direction="vertical" />

		<el-form-item
			:label="t('extensionsModule.fields.enabled.title')"
			class="m-0!"
		>
			<el-radio-group v-model="innerFilters.enabled">
				<el-radio-button
					:label="t('extensionsModule.states.all')"
					value="all"
				/>
				<el-radio-button
					:label="t('extensionsModule.labels.enabled')"
					value="enabled"
				/>
				<el-radio-button
					:label="t('extensionsModule.labels.disabled')"
					value="disabled"
				/>
			</el-radio-group>
		</el-form-item>

		<el-divider direction="vertical" />

		<el-form-item
			:label="t('extensionsModule.fields.type.title')"
			class="m-0!"
		>
			<el-radio-group v-model="innerFilters.isCore">
				<el-radio-button
					:label="t('extensionsModule.states.all')"
					value="all"
				/>
				<el-radio-button
					:label="t('extensionsModule.labels.core')"
					value="core"
				/>
				<el-radio-button
					:label="t('extensionsModule.labels.addon')"
					value="addon"
				/>
			</el-radio-group>
		</el-form-item>

		<div class="flex-grow" />

		<el-button
			v-if="props.filtersActive"
			plain
			class="px-2!"
			@click="emit('reset-filters')"
		>
			<icon icon="mdi:filter-off" />
		</el-button>
	</div>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDivider, ElFormItem, ElIcon, ElInput, ElRadioButton, ElRadioGroup } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import type { IExtensionsFilter } from '../composables/types';

import type { IExtensionsFilterProps } from './extensions-filter.types';

defineOptions({
	name: 'ExtensionsFilter',
});

const props = defineProps<IExtensionsFilterProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: IExtensionsFilter): void;
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();

const innerFilters = useVModel(props, 'filters', emit);

watch(
	(): string | undefined => innerFilters.value.search,
	(val: string | undefined) => {
		if (val === '') {
			innerFilters.value.search = undefined;
		}
	}
);
</script>
