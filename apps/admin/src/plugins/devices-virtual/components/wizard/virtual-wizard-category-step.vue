<template>
	<el-form-item
		:error="fieldError('category')"
		:label="t('devicesModule.fields.devices.category.title')"
		class="projection-category"
		required
	>
		<el-radio-group
			:model-value="modelValue ?? undefined"
			class="projection-categories"
			:aria-label="t('devicesModule.fields.devices.category.title')"
			@update:model-value="onSelect"
		>
			<el-radio
				v-for="item in visibleCategories"
				:key="item.value"
				:value="item.value"
				border
				:data-category="item.value"
			>
				{{ item.label }}
			</el-radio>
		</el-radio-group>
		<el-button
			v-if="moreCount"
			link
			type="primary"
			class="mt-3"
			data-test-id="projection-more-categories"
			@click="expanded = !expanded"
		>
			{{ t(`devicesVirtualPlugin.wizard.projection.${expanded ? 'fewerCategories' : 'moreCategories'}`, { count: moreCount }) }}
		</el-button>
	</el-form-item>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElFormItem, ElRadio, ElRadioGroup } from 'element-plus';

import { useWizardFieldError } from '../../../../modules/devices/components/wizard/use-wizard-validation';
import { DevicesModuleDeviceCategory } from '../../../../openapi.constants';
import { VIRTUAL_SELECTABLE_CATEGORIES } from '../../devices-virtual.constants';

import type { IVirtualWizardCategoryStepProps } from './virtual-wizard-category-step.types';

defineOptions({ name: 'VirtualWizardCategoryStep' });
const props = defineProps<IVirtualWizardCategoryStepProps>();
const emit = defineEmits<{ 'update:modelValue': [value: DevicesModuleDeviceCategory] }>();
const { t } = useI18n();
const fieldError = useWizardFieldError();
const categories = computed(() => VIRTUAL_SELECTABLE_CATEGORIES.map((value) => ({ value, label: t(`devicesModule.categories.devices.${value}`) })));
const expanded = ref(false);
const commonCategories = ['lighting', 'switcher', 'outlet', 'sensor', 'alarm', 'camera'];
const moreCount = computed(() => categories.value.filter((item) => !commonCategories.includes(item.value)).length);
const visibleCategories = computed(() => {
	const common = commonCategories.flatMap((value) => categories.value.filter((item) => item.value === value));
	const others = categories.value.filter((item) => !commonCategories.includes(item.value) && (expanded.value || props.modelValue === item.value));
	return [...common, ...others];
});
const onSelect = (value: string | number | boolean | undefined) => {
	if (categories.value.some((item) => item.value === value)) emit('update:modelValue', value as DevicesModuleDeviceCategory);
};
defineExpose({ categories });
</script>
<style scoped>
.projection-categories {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
	gap: 8px;
	width: 100%;
}
.projection-categories :deep(.el-radio) {
	width: 100%;
	min-height: 44px;
	height: auto;
	margin: 0;
	padding: 10px 12px;
}
.projection-categories :deep(.el-radio__label) {
	white-space: normal;
	line-height: 18px;
}
</style>
