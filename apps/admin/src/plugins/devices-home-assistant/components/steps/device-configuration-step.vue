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

		<!-- Final Review -->
		<el-card shadow="never" header-class="py-2! px-4!" body-class="px-0!">
			<template #header>
				<div class="font-semibold">
					{{ t('devicesHomeAssistantPlugin.fields.mapping.totalEntities') }}:
					<el-tag
						type="info"
						size="small"
					>
						{{ preview?.entities.length ?? 0 }}
					</el-tag>
				</div>
			</template>

			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
				<div>
					<div class="text-2xl font-bold text-green-600">{{ mappedCount }}</div>
					<div class="text-sm text-gray-500">{{ t('devicesHomeAssistantPlugin.fields.mapping.mapped') }}</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-yellow-600">{{ partialCount }}</div>
					<div class="text-sm text-gray-500">{{ t('devicesHomeAssistantPlugin.fields.mapping.partial') }}</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-red-600">{{ unmappedCount }}</div>
					<div class="text-sm text-gray-500">{{ t('devicesHomeAssistantPlugin.fields.mapping.unmapped') }}</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-blue-600">{{ excludedCount }}</div>
					<div class="text-sm text-gray-500">{{ t('devicesHomeAssistantPlugin.fields.mapping.excluded') }}</div>
				</div>
			</div>
		</el-card>
	</el-form>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard, ElForm, ElFormItem, ElInput, ElSwitch, ElTag, type FormInstance, type FormRules } from 'element-plus';
import type { IHomeAssistantDeviceAddForm } from '../../schemas/devices.types';
import type { IMappingEntityOverride, IMappingPreviewResponse } from '../../schemas/mapping-preview.types';

interface IDeviceConfigurationStepProps {
	model: IHomeAssistantDeviceAddForm;
	preview: IMappingPreviewResponse | null;
	entityOverrides: IMappingEntityOverride[] | undefined;
}

const props = defineProps<IDeviceConfigurationStepProps>();

const { t } = useI18n();

const stepFourFormEl = ref<FormInstance | undefined>(undefined);

const rules = reactive<FormRules<IHomeAssistantDeviceAddForm>>({
	name: [{ required: true, message: t('devicesHomeAssistantPlugin.fields.devices.name.validation.required'), trigger: 'change' }],
});

const mappedCount = computed(() => {
	if (!props.preview) return 0;
	return props.preview.entities.filter((e) => e.status === 'mapped').length;
});

const partialCount = computed(() => {
	if (!props.preview) return 0;
	return props.preview.entities.filter((e) => e.status === 'partial').length;
});

const unmappedCount = computed(() => {
	if (!props.preview) return 0;
	return props.preview.entities.filter((e) => e.status === 'unmapped').length;
});

const excludedCount = computed(() => {
	if (!props.preview) return 0;
	
	// Count entities that are explicitly excluded (backend-skipped or user-ignored)
	// This matches what will actually be filtered out in the adoption request
	return props.preview.entities.filter((entity) => {
		// Exclude if explicitly skipped by backend
		if (entity.status === 'skipped') {
			return true;
		}
		
		// Exclude if user has manually ignored it (override.skip === true)
		const override = props.entityOverrides?.find((o) => o.entityId === entity.entityId);
		if (override?.skip === true) {
			return true;
		}
		
		// Note: We don't count entities without channels/properties here because:
		// - They're already reflected in their status (unmapped, etc.)
		// - They might still be included if user adds a category override
		// - The "excluded" count should only show explicitly excluded entities
		
		return false;
	}).length;
});

defineExpose({
	stepFourFormEl,
});
</script>
