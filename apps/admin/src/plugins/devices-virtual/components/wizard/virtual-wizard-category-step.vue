<template>
	<div class="space-y-4">
		<el-alert
			type="info"
			:title="t('devicesVirtualPlugin.wizard.category.heading')"
			:description="t('devicesVirtualPlugin.wizard.category.description')"
			:closable="false"
			show-icon
		/>

		<el-form label-position="top">
			<el-form-item :label="t('devicesVirtualPlugin.fields.devices.category.title')">
				<el-select
					:model-value="modelValue"
					:placeholder="t('devicesVirtualPlugin.fields.devices.category.placeholder')"
					name="category"
					filterable
					class="w-full"
					@update:model-value="onSelect"
				>
					<el-option
						v-for="item in categories"
						:key="item.value"
						:label="item.label"
						:value="item.value"
					/>
				</el-select>
			</el-form-item>
		</el-form>

		<div
			v-if="blockedCategories.length > 0"
			data-test-id="blocked-categories"
		>
			<p class="text-sm text-gray-500 mb-2">
				{{ t('devicesVirtualPlugin.wizard.category.blockedHeading') }}
			</p>

			<div class="flex flex-wrap gap-2">
				<el-tag
					v-for="item in blockedCategories"
					:key="item.value"
					type="info"
					:title="item.reason"
					class="opacity-60! cursor-not-allowed!"
				>
					{{ item.label }}
				</el-tag>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElOption, ElSelect, ElTag } from 'element-plus';

import { DevicesModuleDeviceCategory } from '../../../../openapi.constants';
import { VIRTUAL_BLOCKED_CATEGORIES } from '../../devices-virtual.constants';

import type { IVirtualWizardCategoryStepProps } from './virtual-wizard-category-step.types';

defineOptions({
	name: 'VirtualWizardCategoryStep',
});

defineProps<IVirtualWizardCategoryStepProps>();

const emit = defineEmits<{
	(e: 'update:modelValue', value: DevicesModuleDeviceCategory): void;
}>();

const { t } = useI18n();

// The selectable list: every device category the generated spec knows about, minus the six that
// need a controller the plugin cannot yet drive (see VIRTUAL_BLOCKED_CATEGORIES). Deliberately
// excludes blocked values entirely rather than including-but-disabling them here — the disabled,
// explained rendering lives in `blockedCategories` below, so the two lists never disagree.
const categories = computed<{ value: DevicesModuleDeviceCategory; label: string }[]>(() =>
	Object.values(DevicesModuleDeviceCategory)
		.filter((value) => !VIRTUAL_BLOCKED_CATEGORIES.includes(value))
		.map((value) => ({
			value,
			label: t(`devicesModule.categories.devices.${value}`),
		}))
);

// Shown disabled with a reason so a user wondering where e.g. "Thermostat" went finds it here
// explained, rather than the omission looking like a bug.
const blockedCategories = computed<{ value: DevicesModuleDeviceCategory; label: string; reason: string }[]>(() =>
	VIRTUAL_BLOCKED_CATEGORIES.map((value) => ({
		value,
		label: t(`devicesModule.categories.devices.${value}`),
		reason: t('devicesVirtualPlugin.wizard.category.blockedReason'),
	}))
);

const onSelect = (value: DevicesModuleDeviceCategory): void => {
	emit('update:modelValue', value);
};

defineExpose({
	categories,
	blockedCategories,
});
</script>
