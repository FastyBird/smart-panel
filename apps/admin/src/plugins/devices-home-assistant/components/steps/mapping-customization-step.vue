<template>
	<div v-if="!preview" class="text-center py-8 text-gray-500">
		<el-icon :size="48" class="mb-4">
			<icon icon="mdi:information-outline" />
		</el-icon>
		<p>{{ t('devicesHomeAssistantPlugin.messages.mapping.noPreview') }}</p>
		<p class="text-sm mt-2">{{ t('devicesHomeAssistantPlugin.messages.mapping.selectDeviceFirst') }}</p>
	</div>

	<div v-else class="space-y-4">
		<el-alert
			type="info"
			:title="t('devicesHomeAssistantPlugin.headings.device.mappingCustomization')"
			:description="t('devicesHomeAssistantPlugin.texts.mapping.customizationDescription')"
			:closable="false"
			show-icon
		/>

		<el-form
			ref="stepThreeFormEl"
			label-position="top"
		>
			<div class="space-y-4">
				<div
					v-for="entity in preview.entities"
					:key="entity.entityId"
					class="border rounded p-4"
				>
					<div class="flex items-center justify-between mb-3">
						<div>
							<span class="font-semibold">{{ entity.entityId }}</span>
							<el-tag
								:type="entity.status === 'mapped' ? 'success' : entity.status === 'partial' ? 'warning' : 'danger'"
								size="small"
								class="ml-2"
							>
								{{ entity.status }}
							</el-tag>
						</div>
						<el-checkbox
							:model-value="isEntitySkipped(entity.entityId)"
							@change="(val) => toggleEntitySkip(entity.entityId, val === true)"
						>
							{{ t('devicesHomeAssistantPlugin.buttons.skip') }}
						</el-checkbox>
					</div>

					<el-form-item
						v-if="!isEntitySkipped(entity.entityId)"
						:label="t('devicesHomeAssistantPlugin.fields.mapping.suggestedChannel')"
					>
						<el-select
							:model-value="getEntityChannelCategory(entity.entityId)"
							:placeholder="t('devicesHomeAssistantPlugin.fields.devices.category.placeholder')"
							@change="(val) => updateEntityChannelCategory(entity.entityId, val)"
						>
							<el-option
								v-for="category in channelCategories"
								:key="category.value"
								:label="category.label"
								:value="category.value"
							/>
						</el-select>
					</el-form-item>
				</div>
			</div>
		</el-form>

		<el-button
			type="primary"
			:loading="isPreviewLoading"
			@click="onApplyChanges"
		>
			{{ t('devicesHomeAssistantPlugin.buttons.applyChanges') }}
		</el-button>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCheckbox, ElForm, ElFormItem, ElIcon, ElOption, ElSelect, ElTag, type FormInstance } from 'element-plus';
import { Icon } from '@iconify/vue';

import { DevicesModuleChannelCategory } from '../../../../openapi.constants';
import type { IMappingEntityOverride, IMappingPreviewResponse } from '../../schemas/mapping-preview.types';

interface IMappingCustomizationStepProps {
	preview: IMappingPreviewResponse | null;
	isPreviewLoading: boolean;
	entityOverrides: IMappingEntityOverride[] | undefined;
}

const props = defineProps<IMappingCustomizationStepProps>();

const emit = defineEmits<{
	(e: 'update-overrides', overrides: IMappingEntityOverride[]): void;
	(e: 'apply-changes'): void;
}>();

const { t } = useI18n();

const stepThreeFormEl = ref<FormInstance | undefined>(undefined);

const channelCategories = computed(() => {
	return Object.values(DevicesModuleChannelCategory).map((value) => ({
		value,
		label: t(`devicesModule.categories.channels.${value}`),
	}));
});

const isEntitySkipped = (entityId: string): boolean => {
	return props.entityOverrides?.some((o) => o.entityId === entityId && o.skip === true) ?? false;
};

const getEntityChannelCategory = (entityId: string): DevicesModuleChannelCategory | undefined => {
	const override = props.entityOverrides?.find((o) => o.entityId === entityId);
	return override?.channelCategory;
};

const toggleEntitySkip = (entityId: string, skip: boolean): void => {
	const currentOverrides = [...(props.entityOverrides || [])];
	const existingIndex = currentOverrides.findIndex((o) => o.entityId === entityId);

	if (skip) {
		if (existingIndex >= 0) {
			currentOverrides[existingIndex] = { ...currentOverrides[existingIndex], skip: true };
		} else {
			currentOverrides.push({ entityId, skip: true });
		}
	} else {
		if (existingIndex >= 0) {
			const override = currentOverrides[existingIndex];
			if (override.channelCategory) {
				currentOverrides[existingIndex] = { entityId, channelCategory: override.channelCategory };
			} else {
				currentOverrides.splice(existingIndex, 1);
			}
		}
	}

	emit('update-overrides', currentOverrides);
};

const updateEntityChannelCategory = (entityId: string, category: DevicesModuleChannelCategory): void => {
	const currentOverrides = [...(props.entityOverrides || [])];
	const existingIndex = currentOverrides.findIndex((o) => o.entityId === entityId);

	if (existingIndex >= 0) {
		currentOverrides[existingIndex] = { ...currentOverrides[existingIndex], channelCategory: category, skip: false };
	} else {
		currentOverrides.push({ entityId, channelCategory: category });
	}

	emit('update-overrides', currentOverrides);
};

const onApplyChanges = (): void => {
	emit('apply-changes');
};
</script>
