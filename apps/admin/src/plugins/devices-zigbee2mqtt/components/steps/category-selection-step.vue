<template>
	<div class="space-y-4">
		<el-alert
			type="info"
			:title="t('devicesZigbee2mqttPlugin.headings.device.categorySelection')"
			:description="t('devicesZigbee2mqttPlugin.messages.categorySelection.description')"
			:closable="false"
			show-icon
		/>

		<el-form
			ref="stepTwoFormEl"
			:model="model"
			:rules="rules"
			label-position="top"
			status-icon
		>
			<el-form-item
				:label="t('devicesZigbee2mqttPlugin.fields.devices.category.title')"
				prop="category"
			>
				<!-- eslint-disable vue/no-mutating-props -->
				<el-select
					v-model="model.category"
					:placeholder="t('devicesZigbee2mqttPlugin.fields.devices.category.placeholder')"
					name="category"
					filterable
				>
					<el-option
						v-for="item in categoriesOptions"
						:key="item.value"
						:label="item.label"
						:value="item.value"
					>
						<template v-if="item.value === suggestedCategory">
							<span class="font-semibold">{{ item.label }}</span>
							<el-tag
								size="small"
								type="success"
								class="ml-2"
							>
								{{ t('devicesZigbee2mqttPlugin.labels.suggested') }}
							</el-tag>
						</template>
						<template v-else>
							{{ item.label }}
						</template>
					</el-option>
				</el-select>
			</el-form-item>

			<el-alert
				v-if="model.category"
				type="info"
				:title="t('devicesModule.fields.devices.category.description')"
				:description="t(`devicesModule.texts.devices.description.${model.category}`)"
				:closable="false"
				show-icon
			/>
		</el-form>
	</div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElOption, ElSelect, ElTag, type FormInstance, type FormRules } from 'element-plus';

import { DevicesModuleDeviceCategory } from '../../../../openapi.constants';
import type { IZigbee2mqttDeviceAddMultiStepForm } from '../../schemas/devices.types';

interface ICategorySelectionStepProps {
	model: IZigbee2mqttDeviceAddMultiStepForm;
	categoriesOptions: { value: DevicesModuleDeviceCategory; label: string }[];
	suggestedCategory: DevicesModuleDeviceCategory | null;
}

// Props are used in template
 
defineProps<ICategorySelectionStepProps>();

const { t } = useI18n();

const stepTwoFormEl = ref<FormInstance | undefined>(undefined);

const rules = reactive<FormRules<IZigbee2mqttDeviceAddMultiStepForm>>({
	category: [
		{ required: true, message: t('devicesZigbee2mqttPlugin.fields.devices.category.validation.required'), trigger: 'change' },
	],
});

defineExpose({
	stepTwoFormEl,
});
</script>
