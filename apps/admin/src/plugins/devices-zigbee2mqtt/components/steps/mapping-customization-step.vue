<template>
	<div v-if="!preview" class="text-center py-8 text-gray-500">
		<el-icon :size="48" class="mb-4">
			<icon icon="mdi:information-outline" />
		</el-icon>
		<p>{{ t('devicesZigbee2mqttPlugin.messages.mapping.noPreview') }}</p>
		<p class="text-sm mt-2">{{ t('devicesZigbee2mqttPlugin.messages.mapping.selectDeviceFirst') }}</p>
	</div>

	<div v-else class="space-y-4">
		<el-alert
			type="info"
			:title="t('devicesZigbee2mqttPlugin.headings.device.mappingCustomization')"
			:description="t('devicesZigbee2mqttPlugin.texts.mapping.customizationDescription')"
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
				v-for="expose in preview.exposes"
				:key="expose.exposeName"
			>
				<div class="flex items-center gap-3 mb-3">
					<el-checkbox
						:model-value="isExposeEnabled(expose.exposeName)"
						@change="(val) => toggleExposeEnabled(expose.exposeName, val === true)"
					>
						{{ t('devicesZigbee2mqttPlugin.buttons.use') }}
					</el-checkbox>
					<div class="flex-1">
						<span class="font-semibold">{{ expose.exposeName }}</span>
						<el-tag
							:type="expose.status === 'mapped' ? 'success' : expose.status === 'partial' ? 'warning' : 'danger'"
							size="small"
							class="ml-2"
						>
							{{ expose.status }}
						</el-tag>
						<span class="text-sm text-gray-500 ml-2">({{ expose.exposeType }})</span>
					</div>
				</div>

				<el-form-item
					v-if="isExposeEnabled(expose.exposeName) || hasOverrideWithoutCategory(expose.exposeName)"
					:label="t('devicesZigbee2mqttPlugin.fields.mapping.suggestedChannel.title')"
					:prop="`category_${sanitizeExposeNameForForm(expose.exposeName)}`"
					:required="!getExposeChannelCategory(expose.exposeName)"
					:rules="getCategoryValidationRules(expose.exposeName)"
				>
					<el-select
						:model-value="getExposeChannelCategory(expose.exposeName)"
						:placeholder="t('devicesZigbee2mqttPlugin.fields.devices.category.placeholder')"
						@change="(val) => updateExposeChannelCategory(expose.exposeName, val)"
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

import {
	ElAlert,
	ElCheckbox,
	ElForm,
	ElFormItem,
	ElIcon,
	ElOption,
	ElSelect,
	ElTag,
	type FormInstance,
	type FormRules,
} from 'element-plus';
import { Icon } from '@iconify/vue';

import { DevicesModuleChannelCategory } from '../../../../openapi.constants';
import type { IMappingExposeOverride, IMappingPreviewResponse } from '../../schemas/mapping-preview.types';

interface IMappingCustomizationStepProps {
	preview: IMappingPreviewResponse | null;
	isPreviewLoading: boolean;
	exposeOverrides: IMappingExposeOverride[] | undefined;
}

const props = defineProps<IMappingCustomizationStepProps>();

const emit = defineEmits<{
	(e: 'update-overrides', overrides: IMappingExposeOverride[]): void;
}>();

const { t } = useI18n();

const sanitizeExposeNameForForm = (exposeName: string): string => {
	return exposeName.replace(/[.\[\]]/g, '_');
};

const isExposeEnabled = (exposeName: string): boolean => {
	const expose = props.preview?.exposes.find((e) => e.exposeName === exposeName);
	const override = props.exposeOverrides?.find((o) => o.exposeName === exposeName);

	if (override?.skip === true) {
		return false;
	}

	if (override?.channelCategory) {
		return true;
	}

	if (override && !override.skip && !override.channelCategory) {
		return true;
	}

	const suggestedCategory = expose?.suggestedChannel?.category;
	if (suggestedCategory) {
		return suggestedCategory !== DevicesModuleChannelCategory.generic;
	}

	return false;
};

const getExposeChannelCategory = (exposeName: string): DevicesModuleChannelCategory | undefined => {
	const override = props.exposeOverrides?.find((o) => o.exposeName === exposeName);
	if (override?.channelCategory) {
		return override.channelCategory;
	}
	const expose = props.preview?.exposes.find((e) => e.exposeName === exposeName);
	const suggestedCategory = expose?.suggestedChannel?.category;
	if (suggestedCategory && suggestedCategory !== DevicesModuleChannelCategory.generic) {
		return suggestedCategory;
	}
	return undefined;
};

const formModel = reactive<Record<string, unknown>>({});

watch(
	() => [props.exposeOverrides, props.preview],
	() => {
		if (props.preview) {
			for (const expose of props.preview.exposes) {
				const exposeName = expose.exposeName;
				const formKey = `category_${sanitizeExposeNameForForm(exposeName)}`;

				if (isExposeEnabled(exposeName)) {
					const category = getExposeChannelCategory(exposeName);
					formModel[formKey] = category;
				} else {
					delete formModel[formKey];
				}
			}
		} else {
			const keysToDelete = Object.keys(formModel).filter((key) => key.startsWith('category_'));
			for (const key of keysToDelete) {
				delete formModel[key];
			}
		}
	},
	{ immediate: true, deep: true }
);

const stepThreeFormEl = ref<FormInstance | undefined>(undefined);

const formRules = computed<FormRules>(() => {
	const rules: FormRules = {};

	if (props.preview) {
		for (const expose of props.preview.exposes) {
			const exposeName = expose.exposeName;
			const propName = `category_${sanitizeExposeNameForForm(exposeName)}`;

			if (isExposeEnabled(exposeName) && !getExposeChannelCategory(exposeName)) {
				rules[propName] = [
					{
						required: true,
						message: t('devicesZigbee2mqttPlugin.fields.mapping.suggestedChannel.validation.required'),
						trigger: 'change',
					},
				];
			}
		}
	}

	return rules;
});

const getCategoryValidationRules = (exposeName: string) => {
	const propName = `category_${sanitizeExposeNameForForm(exposeName)}`;
	return formRules.value[propName] || [];
};

const resetForm = (): void => {
	const keysToDelete = Object.keys(formModel).filter((key) => key.startsWith('category_'));
	for (const key of keysToDelete) {
		delete formModel[key];
	}
	stepThreeFormEl.value?.resetFields();
};

defineExpose({
	stepThreeFormEl,
	resetForm,
});

const channelCategories = computed(() => {
	return Object.values(DevicesModuleChannelCategory)
		.filter((value) => value !== DevicesModuleChannelCategory.generic)
		.map((value) => ({
			value,
			label: t(`devicesModule.categories.channels.${value}`),
		}));
});

const toggleExposeEnabled = (exposeName: string, enabled: boolean): void => {
	const currentOverrides = [...(props.exposeOverrides || [])];
	const existingIndex = currentOverrides.findIndex((o) => o.exposeName === exposeName);
	const expose = props.preview?.exposes.find((e) => e.exposeName === exposeName);
	const suggestedCategory = expose?.suggestedChannel?.category;
	const isValidSuggestedCategory = suggestedCategory && suggestedCategory !== DevicesModuleChannelCategory.generic;

	if (enabled) {
		if (existingIndex >= 0) {
			const override = currentOverrides[existingIndex];
			if (override.channelCategory) {
				currentOverrides[existingIndex] = { exposeName, channelCategory: override.channelCategory };
				formModel[`category_${sanitizeExposeNameForForm(exposeName)}`] = override.channelCategory;
			} else if (isValidSuggestedCategory) {
				currentOverrides.splice(existingIndex, 1);
				formModel[`category_${sanitizeExposeNameForForm(exposeName)}`] = suggestedCategory;
			} else {
				currentOverrides[existingIndex] = { exposeName };
				formModel[`category_${sanitizeExposeNameForForm(exposeName)}`] = undefined;
			}
		} else {
			if (isValidSuggestedCategory) {
				formModel[`category_${sanitizeExposeNameForForm(exposeName)}`] = suggestedCategory;
			} else {
				currentOverrides.push({ exposeName });
				formModel[`category_${sanitizeExposeNameForForm(exposeName)}`] = undefined;
			}
		}
	} else {
		if (existingIndex >= 0) {
			const override = currentOverrides[existingIndex];
			currentOverrides[existingIndex] = { ...override, skip: true };
		} else {
			currentOverrides.push({ exposeName, skip: true });
		}
		delete formModel[`category_${sanitizeExposeNameForForm(exposeName)}`];
	}

	emit('update-overrides', currentOverrides);
};

const hasOverrideWithoutCategory = (exposeName: string): boolean => {
	const override = props.exposeOverrides?.find((o) => o.exposeName === exposeName);
	return override !== undefined && !override.skip && !override.channelCategory;
};

const updateExposeChannelCategory = (exposeName: string, category: DevicesModuleChannelCategory): void => {
	const currentOverrides = [...(props.exposeOverrides || [])];
	const existingIndex = currentOverrides.findIndex((o) => o.exposeName === exposeName);

	if (existingIndex >= 0) {
		currentOverrides[existingIndex] = { ...currentOverrides[existingIndex], channelCategory: category, skip: false };
	} else {
		currentOverrides.push({ exposeName, channelCategory: category });
	}

	formModel[`category_${sanitizeExposeNameForForm(exposeName)}`] = category;

	emit('update-overrides', currentOverrides);
};
</script>
