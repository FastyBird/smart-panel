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
			:model="formModel"
			label-position="top"
		>
			<div
				v-for="entity in preview.entities"
				:key="entity.entityId"
			>
				<div class="flex items-center gap-3 mb-3">
					<el-checkbox
						:model-value="isEntityEnabled(entity.entityId)"
						@change="(val) => toggleEntityEnabled(entity.entityId, val === true)"
					>
						{{ t('devicesHomeAssistantPlugin.buttons.use') }}
					</el-checkbox>
					<div class="flex-1">
						<span class="font-semibold">{{ entity.entityId }}</span>
						<el-tag
							:type="entity.status === 'mapped' ? 'success' : entity.status === 'partial' ? 'warning' : 'danger'"
							size="small"
							class="ml-2"
						>
							{{ entity.status }}
						</el-tag>
					</div>
				</div>

				<el-form-item
					v-if="isEntityEnabled(entity.entityId) || hasOverrideWithoutCategory(entity.entityId)"
					:label="t('devicesHomeAssistantPlugin.fields.mapping.suggestedChannel')"
					:required="!getEntityChannelCategory(entity.entityId)"
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
		</el-form>
	</div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElCheckbox, ElForm, ElFormItem, ElIcon, ElOption, ElSelect, ElTag, type FormInstance } from 'element-plus';
import { Icon } from '@iconify/vue';

import { DevicesModuleChannelCategory } from '../../../../openapi.constants';
import type { IMappingEntityOverride, IMappingPreviewResponse } from '../../schemas/mapping-preview.types';

interface IMappingCustomizationStepProps {
	preview: IMappingPreviewResponse | null;
	isPreviewLoading: boolean;
	entityOverrides: IMappingEntityOverride[] | undefined;
}

// Props are used in template and in functions below
 
const props = defineProps<IMappingCustomizationStepProps>();

const emit = defineEmits<{
	(e: 'update-overrides', overrides: IMappingEntityOverride[]): void;
}>();

const { t } = useI18n();

// Form model required for resetFields() to work properly
// The form fields are controlled via :model-value bindings, but Element Plus
// requires a :model prop on el-form for resetFields() to function
const formModel = reactive<Record<string, unknown>>({});

const stepThreeFormEl = ref<FormInstance | undefined>(undefined);

defineExpose({
	stepThreeFormEl,
});

const channelCategories = computed(() => {
	return Object.values(DevicesModuleChannelCategory)
		.filter((value) => {
			// Filter out generic category
			return value !== DevicesModuleChannelCategory.generic;
		})
		.map((value) => ({
			value,
			label: t(`devicesModule.categories.channels.${value}`),
		}));
});

const isEntityEnabled = (entityId: string): boolean => {
	const entity = props.preview?.entities.find((e) => e.entityId === entityId);
	const override = props.entityOverrides?.find((o) => o.entityId === entityId);
	
	// If there's an explicit skip override, entity is disabled
	if (override?.skip === true) {
		return false;
	}
	
	// If there's an override with a channel category (and no skip), entity is enabled
	if (override?.channelCategory) {
		return true;
	}
	
	// If there's an override without category (user checked but hasn't selected category yet), entity is enabled
	// This allows the checkbox to stay checked and show the category selector
	if (override && !override.skip && !override.channelCategory) {
		return true;
	}

	// By default, entities with a valid suggested channel category are enabled
	// (excluding generic which is not supported)
	const suggestedCategory = entity?.suggestedChannel?.category;
	if (suggestedCategory) {
		return suggestedCategory !== DevicesModuleChannelCategory.generic;
	}
	
	// Entities without a suggested category are disabled by default
	return false;
};

const getEntityChannelCategory = (entityId: string): DevicesModuleChannelCategory | undefined => {
	const override = props.entityOverrides?.find((o) => o.entityId === entityId);
	if (override?.channelCategory) {
		return override.channelCategory;
	}
	// Return suggested category if no override and it's a valid category
	const entity = props.preview?.entities.find((e) => e.entityId === entityId);
	const suggestedCategory = entity?.suggestedChannel?.category;
	if (suggestedCategory && suggestedCategory !== DevicesModuleChannelCategory.generic) {
		return suggestedCategory;
	}
	return undefined;
};

const toggleEntityEnabled = (entityId: string, enabled: boolean): void => {
	const currentOverrides = [...(props.entityOverrides || [])];
	const existingIndex = currentOverrides.findIndex((o) => o.entityId === entityId);
	const entity = props.preview?.entities.find((e) => e.entityId === entityId);
	const suggestedCategory = entity?.suggestedChannel?.category;
	const isValidSuggestedCategory = suggestedCategory && suggestedCategory !== DevicesModuleChannelCategory.generic;

	if (enabled) {
		// Enable: remove skip flag and ensure there's a valid category
		if (existingIndex >= 0) {
			const override = currentOverrides[existingIndex];
			if (override.channelCategory) {
				// Keep existing custom category, just remove skip
				currentOverrides[existingIndex] = { entityId, channelCategory: override.channelCategory };
			} else if (isValidSuggestedCategory) {
				// Entity is back to default state with valid suggested category, remove override
				currentOverrides.splice(existingIndex, 1);
			} else {
				// No valid category yet - add override without category to allow user to select one
				// This will show the category selector
				currentOverrides[existingIndex] = { entityId };
			}
		} else {
			// No existing override
			if (isValidSuggestedCategory) {
				// Entity has valid suggested category, it's already enabled by default
				// No override needed
			} else {
				// Entity needs a category - add override without category (user must select)
				// This allows the checkbox to be checked, and category selector will be shown
				currentOverrides.push({ entityId });
			}
		}
	} else {
		// Disable: set skip flag
		if (existingIndex >= 0) {
			const override = currentOverrides[existingIndex];
			currentOverrides[existingIndex] = { ...override, skip: true };
		} else {
			currentOverrides.push({ entityId, skip: true });
		}
	}

	emit('update-overrides', currentOverrides);
};

const hasOverrideWithoutCategory = (entityId: string): boolean => {
	const override = props.entityOverrides?.find((o) => o.entityId === entityId);
	return override !== undefined && !override.skip && !override.channelCategory;
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
</script>
