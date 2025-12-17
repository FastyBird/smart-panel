<template>
	<el-form-item
		:label="t('weatherModule.fields.locations.provider.title')"
		label-position="top"
	>
		<el-select
			v-model="selectedType"
			:placeholder="t('weatherModule.fields.locations.provider.placeholder')"
			name="provider"
			filterable
		>
			<el-option
				v-for="item in options"
				:key="item.value"
				:label="item.label"
				:value="item.value"
				:disabled="item.disabled"
			/>
		</el-select>
	</el-form-item>

	<el-alert
		v-if="selectedPlugin"
		:description="selectedPlugin.description || ''"
		:closable="false"
		show-icon
		type="info"
	/>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElFormItem, ElOption, ElSelect } from 'element-plus';

import { useWeatherLocationsPlugins } from '../composables/composables';

import type { ISelectLocationProviderProps } from './select-location-provider.types';

defineOptions({
	name: 'SelectLocationProvider',
});

const props = defineProps<ISelectLocationProviderProps>();

const emit = defineEmits<{
	(e: 'update:modelValue', type: string | undefined): void;
}>();

const { t } = useI18n();

const { options, getElement } = useWeatherLocationsPlugins();

const selectedType = ref<string | undefined>(props.modelValue);

const selectedPlugin = computed(() => {
	if (!selectedType.value) {
		return undefined;
	}

	return getElement(selectedType.value);
});

watch(
	(): string | undefined => selectedType.value,
	(val: string | undefined) => {
		emit('update:modelValue', val);
	}
);

watch(
	() => props.modelValue,
	(val) => {
		selectedType.value = val;
	}
);
</script>
