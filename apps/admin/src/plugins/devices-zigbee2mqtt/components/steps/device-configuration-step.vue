<template>
	<el-form
		ref="stepFourFormEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('devicesZigbee2mqttPlugin.fields.devices.name.title')"
			prop="name"
		>
			<!-- eslint-disable vue/no-mutating-props -->
			<el-input
				v-model="model.name"
				:placeholder="t('devicesZigbee2mqttPlugin.fields.devices.name.placeholder')"
				name="name"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesZigbee2mqttPlugin.fields.devices.description.title')"
			prop="description"
		>
			<!-- eslint-disable vue/no-mutating-props -->
			<el-input
				v-model="model.description"
				:placeholder="t('devicesZigbee2mqttPlugin.fields.devices.description.placeholder')"
				:rows="4"
				type="textarea"
				name="description"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesZigbee2mqttPlugin.fields.devices.enabled.title')"
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
			<h4 class="font-semibold">{{ t('devicesZigbee2mqttPlugin.headings.mapping.summary') }}</h4>
			<dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
				<dt class="font-medium">{{ t('devicesZigbee2mqttPlugin.fields.mapping.totalExposes') }}:</dt>
				<dd class="m-0">{{ preview.exposes.length }}</dd>

				<dt class="font-medium">{{ t('devicesZigbee2mqttPlugin.fields.mapping.mapped') }}:</dt>
				<dd class="m-0">
					<el-tag type="success" size="small">
						{{ mappedCount }}
					</el-tag>
				</dd>

				<dt class="font-medium">{{ t('devicesZigbee2mqttPlugin.fields.mapping.partial') }}:</dt>
				<dd class="m-0">
					<el-tag type="warning" size="small">
						{{ partialCount }}
					</el-tag>
				</dd>

				<dt class="font-medium">{{ t('devicesZigbee2mqttPlugin.fields.mapping.unmapped') }}:</dt>
				<dd class="m-0">
					<el-tag type="danger" size="small">
						{{ unmappedCount }}
					</el-tag>
				</dd>

				<dt class="font-medium">{{ t('devicesZigbee2mqttPlugin.fields.mapping.excluded') }}:</dt>
				<dd class="m-0">
					<el-tag type="info" size="small">
						{{ excludedCount }}
					</el-tag>
				</dd>
			</dl>
		</div>
	</el-form>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElDivider, ElForm, ElFormItem, ElInput, ElSwitch, ElTag, type FormInstance, type FormRules } from 'element-plus';

import type { IZigbee2mqttDeviceAddMultiStepForm } from '../../schemas/devices.types';
import type { IMappingExposeOverride, IMappingPreviewResponse } from '../../schemas/mapping-preview.types';

interface IDeviceConfigurationStepProps {
	model: IZigbee2mqttDeviceAddMultiStepForm;
	preview: IMappingPreviewResponse | null;
	exposeOverrides: IMappingExposeOverride[] | undefined;
}

const props = defineProps<IDeviceConfigurationStepProps>();

const { t } = useI18n();

const stepFourFormEl = ref<FormInstance | undefined>(undefined);

const rules = reactive<FormRules<IZigbee2mqttDeviceAddMultiStepForm>>({
	name: [
		{ required: true, message: t('devicesZigbee2mqttPlugin.fields.devices.name.validation.required'), trigger: 'change' },
	],
});

const mappedCount = computed(() => {
	if (!props.preview) return 0;
	return props.preview.exposes.filter((e) => e.status === 'mapped').length;
});

const partialCount = computed(() => {
	if (!props.preview) return 0;
	return props.preview.exposes.filter((e) => e.status === 'partial').length;
});

const unmappedCount = computed(() => {
	if (!props.preview) return 0;
	return props.preview.exposes.filter((e) => e.status === 'unmapped').length;
});

const excludedCount = computed(() => {
	if (!props.preview) return 0;

	return props.preview.exposes.filter((expose) => {
		if (expose.status === 'skipped') {
			return true;
		}

		const override = props.exposeOverrides?.find((o) => o.exposeName === expose.exposeName);
		if (override?.skip === true) {
			return true;
		}

		return false;
	}).length;
});

defineExpose({
	stepFourFormEl,
});
</script>
