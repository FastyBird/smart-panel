<template>
	<el-form
		ref="stepFourFormEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.devices.name.title')"
			prop="name"
		>
			<!-- eslint-disable vue/no-mutating-props -->
			<el-input
				v-model="model.name"
				:placeholder="t('devicesHomeAssistantPlugin.fields.devices.name.placeholder')"
				name="name"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.devices.description.title')"
			prop="description"
		>
			<!-- eslint-disable vue/no-mutating-props -->
			<el-input
				v-model="model.description"
				:placeholder="t('devicesHomeAssistantPlugin.fields.devices.description.placeholder')"
				:rows="4"
				type="textarea"
				name="description"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.devices.enabled.title')"
			prop="enabled"
			label-position="left"
		>
			<!-- eslint-disable vue/no-mutating-props -->
			<el-switch
				v-model="model.enabled"
				name="enabled"
			/>
		</el-form-item>

		<el-divider />

		<!-- Final Review -->
		<div v-if="preview" class="space-y-2">
			<h4 class="font-semibold">{{ t('devicesHomeAssistantPlugin.headings.mapping.summary') }}</h4>
			<dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
				<dt class="font-medium">{{ t('devicesHomeAssistantPlugin.fields.mapping.totalEntities') }}:</dt>
				<dd class="m-0">{{ preview.entities.filter((e) => e.status !== 'skipped').length }}</dd>

				<dt class="font-medium">{{ t('devicesHomeAssistantPlugin.fields.mapping.mapped') }}:</dt>
				<dd class="m-0">
					{{ preview.entities.filter((e) => e.status === 'mapped').length }}
				</dd>

				<dt class="font-medium">{{ t('devicesHomeAssistantPlugin.fields.mapping.partial') }}:</dt>
				<dd class="m-0">
					{{ preview.entities.filter((e) => e.status === 'partial').length }}
				</dd>
			</dl>
		</div>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElDivider, ElForm, ElFormItem, ElInput, ElSwitch, type FormInstance, type FormRules } from 'element-plus';
import type { IHomeAssistantDeviceAddForm } from '../../schemas/devices.types';
import type { IMappingPreviewResponse } from '../../schemas/mapping-preview.types';

interface IDeviceConfigurationStepProps {
	model: IHomeAssistantDeviceAddForm;
	preview: IMappingPreviewResponse | null;
}

defineProps<IDeviceConfigurationStepProps>();

const { t } = useI18n();

const stepFourFormEl = ref<FormInstance | undefined>(undefined);

const rules = reactive<FormRules<IHomeAssistantDeviceAddForm>>({
	name: [{ required: true, message: t('devicesHomeAssistantPlugin.fields.devices.name.validation.required'), trigger: 'change' }],
});

defineExpose({
	stepFourFormEl,
});
</script>
