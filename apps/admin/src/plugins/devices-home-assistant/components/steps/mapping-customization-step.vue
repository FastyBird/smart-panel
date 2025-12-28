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
			:rules="formRules"
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
						<span class="text-sm text-gray-500 ml-2">({{ entity.domain }})</span>
					</div>
				</div>

				<el-form-item
					v-if="isEntityEnabled(entity.entityId) || hasOverrideWithoutCategory(entity.entityId)"
					:label="t('devicesHomeAssistantPlugin.fields.mapping.suggestedChannel.title')"
					:prop="`category_${sanitizeEntityIdForForm(entity.entityId)}`"
					:required="!getEntityChannelCategory(entity.entityId)"
					:rules="getCategoryValidationRules(entity.entityId)"
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
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElCheckbox, ElForm, ElFormItem, ElIcon, ElOption, ElSelect, ElTag, type FormInstance, type FormRules } from 'element-plus';
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

// Sanitize entityId for use in form model keys and prop names
// Replaces dots and other special characters that Element Plus interprets as nested paths
const sanitizeEntityIdForForm = (entityId: string): string => {
	return entityId.replace(/[.\[\]]/g, '_');
};

// Helper functions - defined before watch/computed that use them
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

// Form model required for resetFields() to work properly
// The form fields are controlled via :model-value bindings, but Element Plus
// requires a :model prop on el-form for resetFields() to function
// We also track category values here for validation
const formModel = reactive<Record<string, unknown>>({});

// Update form model when entity overrides or preview changes
watch(
	() => [props.entityOverrides, props.preview],
	() => {
		if (props.preview) {
			// Update form model with current category values only for enabled entities
			// Disabled entities should not have form model keys to prevent cleared values from reappearing
			for (const entity of props.preview.entities) {
				const entityId = entity.entityId;
				const formKey = `category_${sanitizeEntityIdForForm(entityId)}`;
				
				if (isEntityEnabled(entityId)) {
					// Only set form model for enabled entities
					const category = getEntityChannelCategory(entityId);
					formModel[formKey] = category;
				} else {
					// Remove form model key for disabled entities
					delete formModel[formKey];
				}
			}
		} else {
			// When preview is cleared, clear all form model keys
			// This ensures the form model is clean when preview is null
			const keysToDelete = Object.keys(formModel).filter((key) => key.startsWith('category_'));
			for (const key of keysToDelete) {
				delete formModel[key];
			}
		}
	},
	{ immediate: true, deep: true }
);

const stepThreeFormEl = ref<FormInstance | undefined>(undefined);

// Form validation rules
const formRules = computed<FormRules>(() => {
	const rules: FormRules = {};
	
	if (props.preview) {
		for (const entity of props.preview.entities) {
			const entityId = entity.entityId;
			const propName = `category_${sanitizeEntityIdForForm(entityId)}`;
			
			// Only add validation rule if entity is enabled and missing a category
			if (isEntityEnabled(entityId) && !getEntityChannelCategory(entityId)) {
				rules[propName] = [
					{
						required: true,
						message: t('devicesHomeAssistantPlugin.fields.mapping.suggestedChannel.validation.required'),
						trigger: 'change',
					},
				];
			}
		}
	}
	
	return rules;
});

const getCategoryValidationRules = (entityId: string) => {
	const propName = `category_${sanitizeEntityIdForForm(entityId)}`;
	return formRules.value[propName] || [];
};

// Reset method to properly clear form state and ensure checkboxes are reset
// This method is called by the parent component's reset handler to ensure
// all form state (including checkbox states controlled by entityOverrides prop)
// is properly cleared. The parent component clears entityOverrides before
// calling this method, which will reset the checkbox states.
const resetForm = (): void => {
	// Clear all form model keys (handle both cases: preview exists or was cleared)
	const keysToDelete = Object.keys(formModel).filter((key) => key.startsWith('category_'));
	for (const key of keysToDelete) {
		delete formModel[key];
	}
	// Reset form fields (clears validation state and resets to initial values)
	stepThreeFormEl.value?.resetFields();
};

// Expose both the form instance (for validation) and the resetForm method
// The form instance is exposed so it can be accessed via stepFourFormEl in the parent component
// However, resetForm() should be used for proper reset as it handles both form fields
// and ensures the form model is cleared (checkbox states are reset via entityOverrides prop)
defineExpose({
	stepThreeFormEl,
	resetForm,
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
					// Update form model
					formModel[`category_${sanitizeEntityIdForForm(entityId)}`] = override.channelCategory;
				} else if (isValidSuggestedCategory) {
					// Entity is back to default state with valid suggested category, remove override
					currentOverrides.splice(existingIndex, 1);
					// Update form model with suggested category
					formModel[`category_${sanitizeEntityIdForForm(entityId)}`] = suggestedCategory;
				} else {
					// No valid category yet - add override without category to allow user to select one
					// This will show the category selector
					currentOverrides[existingIndex] = { entityId };
					// Clear form model to trigger validation
					formModel[`category_${sanitizeEntityIdForForm(entityId)}`] = undefined;
				}
			} else {
				// No existing override
				if (isValidSuggestedCategory) {
					// Entity has valid suggested category, it's already enabled by default
					// No override needed, but update form model
					formModel[`category_${sanitizeEntityIdForForm(entityId)}`] = suggestedCategory;
				} else {
					// Entity needs a category - add override without category (user must select)
					// This allows the checkbox to be checked, and category selector will be shown
					currentOverrides.push({ entityId });
					// Clear form model to trigger validation
					formModel[`category_${sanitizeEntityIdForForm(entityId)}`] = undefined;
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
		// Clear form model for disabled entities
		delete formModel[`category_${sanitizeEntityIdForForm(entityId)}`];
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

	// Update form model for validation
	formModel[`category_${sanitizeEntityIdForForm(entityId)}`] = category;

	emit('update-overrides', currentOverrides);
};
</script>
