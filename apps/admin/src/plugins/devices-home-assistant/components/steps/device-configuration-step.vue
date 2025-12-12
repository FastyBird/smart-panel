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
			<el-input
				v-model="model.name"
				:placeholder="t('devicesHomeAssistantPlugin.fields.devices.name.placeholder')"
				name="name"
			/>
		</el-form-item>

		<el-divider />

		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.devices.category.title')"
			prop="category"
		>
			<el-select
				v-model="model.category"
				:placeholder="t('devicesHomeAssistantPlugin.fields.devices.category.placeholder')"
				name="category"
				filterable
			>
				<el-option
					v-for="item in categoriesOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
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

		<el-divider />

		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.devices.description.title')"
			prop="description"
		>
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
import { reactive } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElDivider, ElForm, ElFormItem, ElInput, ElOption, ElSelect, ElSwitch, type FormInstance, type FormRules } from 'element-plus';

import { DevicesModuleDeviceCategory } from '../../../../openapi.constants';
import type { IHomeAssistantDeviceAddForm } from '../../schemas/devices.types';
import type { IMappingPreviewResponse } from '../../schemas/mapping-preview.types';

interface IDeviceConfigurationStepProps {
	model: IHomeAssistantDeviceAddForm;
	stepFourFormEl: FormInstance | undefined;
	categoriesOptions: { value: DevicesModuleDeviceCategory; label: string }[];
	preview: IMappingPreviewResponse | null;
}

const props = defineProps<IDeviceConfigurationStepProps>();

const { t } = useI18n();

const rules = reactive<FormRules<IHomeAssistantDeviceAddForm>>({
	name: [{ required: true, message: t('devicesHomeAssistantPlugin.fields.devices.name.validation.required'), trigger: 'change' }],
	category: [{ required: true, message: t('devicesHomeAssistantPlugin.fields.devices.category.validation.required'), trigger: 'change' }],
});
</script>
