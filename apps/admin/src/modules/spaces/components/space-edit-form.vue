<template>
	<el-form ref="formRef" :model="model" :rules="rules" label-position="top" @submit.prevent="onSubmit">
		<el-collapse v-model="activeCollapses">
			<!-- 1. General Section -->
			<el-collapse-item name="general">
				<template #title>
					<div class="flex items-center gap-2">
						<el-icon :size="20">
							<icon icon="mdi:information" />
						</el-icon>
						<span class="font-medium">{{ t('spacesModule.edit.sections.general.title') }}</span>
					</div>
				</template>

				<div class="px-2">
					<el-form-item :label="t('spacesModule.fields.spaces.name.title')" prop="name">
						<el-input v-model="model.name" :placeholder="t('spacesModule.fields.spaces.name.placeholder')" />
					</el-form-item>

					<el-form-item :label="t('spacesModule.fields.spaces.category.title')" prop="category">
						<el-select
							v-model="model.category"
							:placeholder="t('spacesModule.fields.spaces.category.placeholder')"
							:clearable="model.type !== SpaceType.ZONE"
							@change="onCategoryChange"
						>
							<!-- Grouped categories for zones -->
							<template v-if="categoryGroups">
								<el-option-group
									v-for="group in categoryGroups"
									:key="group.key"
									:label="t(`spacesModule.fields.spaces.category.groups.${group.key}`)"
								>
									<el-option
										v-for="category in group.categories"
										:key="category"
										:label="t(`spacesModule.fields.spaces.category.options.${category}`)"
										:value="category"
									>
										<span class="flex items-center gap-2">
											<el-icon v-if="currentTemplates[category]">
												<icon :icon="currentTemplates[category].icon" />
											</el-icon>
											{{ t(`spacesModule.fields.spaces.category.options.${category}`) }}
										</span>
									</el-option>
								</el-option-group>
							</template>
							<!-- Flat list for rooms -->
							<template v-else>
								<el-option
									v-for="category in categoryOptions"
									:key="category"
									:label="t(`spacesModule.fields.spaces.category.options.${category}`)"
									:value="category"
								>
									<span class="flex items-center gap-2">
										<el-icon v-if="currentTemplates[category]">
											<icon :icon="currentTemplates[category].icon" />
										</el-icon>
										{{ t(`spacesModule.fields.spaces.category.options.${category}`) }}
									</span>
								</el-option>
							</template>
						</el-select>
					</el-form-item>

					<el-alert
						:title="t('spacesModule.fields.spaces.category.hint')"
						type="info"
						:closable="false"
						show-icon
						class="!my-2"
					/>

					<el-form-item :label="t('spacesModule.fields.spaces.description.title')" prop="description">
						<el-input
							v-model="model.description"
							type="textarea"
							:rows="3"
							:placeholder="t('spacesModule.fields.spaces.description.placeholder')"
						/>
					</el-form-item>

					<el-form-item :label="t('spacesModule.fields.spaces.icon.title')" prop="icon">
						<icon-picker
							v-model="iconPickerValue"
							:placeholder="t('spacesModule.fields.spaces.icon.placeholder')"
							icon-set="mdi"
						/>
					</el-form-item>

					<el-form-item :label="t('spacesModule.fields.spaces.displayOrder.title')" prop="displayOrder">
						<el-input-number
							v-model="model.displayOrder"
							:min="0"
						/>
					</el-form-item>
				</div>
			</el-collapse-item>

			<!-- 2. Organization Section (Room only) -->
			<el-collapse-item v-if="model.type === SpaceType.ROOM" name="organization">
				<template #title>
					<div class="flex items-center gap-2">
						<el-icon :size="20">
							<icon icon="mdi:sitemap" />
						</el-icon>
						<span class="font-medium">{{ t('spacesModule.edit.sections.organization.title') }}</span>
					</div>
				</template>

				<div class="px-2">
					<el-form-item
						:label="t('spacesModule.fields.spaces.parentZone.title')"
						prop="parentId"
					>
						<el-select
							v-model="model.parentId"
							:placeholder="t('spacesModule.fields.spaces.parentZone.placeholder')"
							clearable
							filterable
						>
							<el-option
								v-for="zone in availableZones"
								:key="zone.id"
								:label="zone.name"
								:value="zone.id"
							>
								<span class="flex items-center gap-2">
									<el-icon v-if="zone.icon">
										<icon :icon="zone.icon" />
									</el-icon>
									{{ zone.name }}
								</span>
							</el-option>
						</el-select>
					</el-form-item>

					<el-alert
						:title="t('spacesModule.edit.sections.organization.hint')"
						type="info"
						:closable="false"
						show-icon
					/>
				</div>
			</el-collapse-item>

			<!-- 3. Smart Overrides Section -->
			<el-collapse-item name="smartOverrides">
				<template #title>
					<div class="flex items-center gap-2">
						<el-icon :size="20">
							<icon icon="mdi:tune" />
						</el-icon>
						<span class="font-medium">{{ t('spacesModule.edit.sections.smartOverrides.title') }}</span>
						<el-tag size="small" type="info">{{ t('spacesModule.edit.sections.smartOverrides.badge') }}</el-tag>
					</div>
				</template>

				<div class="px-2">
					<el-alert
						:title="t('spacesModule.edit.sections.smartOverrides.hint')"
						type="info"
						:closable="false"
						show-icon
					/>

					<!-- Smart Suggestions -->

					<el-form-item
						prop="suggestionsEnabled"
						label-position="left"
					>
						<template #label>
							{{ t('spacesModule.fields.spaces.suggestionsEnabled.title') }}
						</template>

						<el-switch v-model="model.suggestionsEnabled" />
					</el-form-item>

					<el-alert
						:title="t('spacesModule.fields.spaces.suggestionsEnabled.hint')"
						type="info"
						:closable="false"
						show-icon
					/>
				</div>
			</el-collapse-item>
		</el-collapse>

		<div
			v-if="!hideActions"
			class="flex gap-2 justify-end mt-4"
		>
			<el-button @click="onCancel">
				{{ t('spacesModule.buttons.cancel.title') }}
			</el-button>
			<el-button
				type="primary"
				:loading="formResult === FormResult.WORKING"
				@click="onSubmit"
			>
				{{ t('spacesModule.buttons.save.title') }}
			</el-button>
		</div>
	</el-form>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';

import { Icon } from '@iconify/vue';
import {
	ElAlert,
	ElButton,
	ElCollapse,
	ElCollapseItem,
	ElForm,
	ElFormItem,
	ElIcon,
	ElInput,
	ElInputNumber,
	ElOption,
	ElOptionGroup,
	ElSelect,
	ElSwitch,
	ElTag,
	type FormInstance,
	type FormRules,
} from 'element-plus';
import { useI18n } from 'vue-i18n';

import { IconPicker } from '../../../common';
import { useSpaceCategories, useSpaceEditForm, useSpaces } from '../composables';
import {
	FormResult,
	isValidCategoryForType,
	type SpaceCategory,
	SpaceType,
} from '../spaces.constants';

import { type ISpaceEditFormProps, spaceEditFormEmits } from './space-edit-form.types';

const props = withDefaults(defineProps<ISpaceEditFormProps>(), {
	hideActions: false,
});

const emit = defineEmits(spaceEditFormEmits);

const { t } = useI18n();

const { zoneSpaces, findById } = useSpaces();

// Use the form composable - pass space as computed to enable reactivity when prop changes
const {
	model,
	formEl,
	formChanged,
	submit,
	formResult,
} = useSpaceEditForm({ space: computed(() => props.space) });

// Local ref for template, synced with composable's formEl
const formRef = ref<FormInstance>();

watch(formRef, (newVal) => {
	formEl.value = newVal;
}, { immediate: true });

// Collapse state - General and Organization open by default
const activeCollapses = ref<string[]>(['general', 'organization']);

// Track values that were auto-populated from templates (not manually entered)
const autoPopulatedValues = reactive({
	icon: null as string | null,
	description: null as string | null,
});

// Computed for icon picker (converts between 'mdi:icon-name' and 'icon-name')
const iconPickerValue = computed({
	get: () => model.icon?.replace('mdi:', '') ?? null,
	set: (val: string | null) => {
		model.icon = val ? `mdi:${val}` : null;
	},
});

// Category options, groups, and templates based on the selected space type
const { categoryOptions, categoryGroups, currentTemplates } = useSpaceCategories(
	computed(() => model.type)
);

// Get available zones for parent zone selector (only zones, excluding the current space if editing)
const availableZones = computed(() =>
	zoneSpaces.value.filter((s) => !props.space || s.id !== props.space.id)
);

// Handle type change - clear category if it becomes incompatible
watch(
	() => model.type,
	(newType) => {
		if (model.category && !isValidCategoryForType(model.category, newType)) {
			model.category = null;
			// Also clear auto-populated values since they may not apply anymore
			if (model.icon === autoPopulatedValues.icon) {
				model.icon = null;
				autoPopulatedValues.icon = null;
			}
			if (model.description === autoPopulatedValues.description) {
				model.description = null;
				autoPopulatedValues.description = null;
			}
		}
		// Zones cannot have a parent - clear parentId when switching to zone type
		if (newType === SpaceType.ZONE) {
			model.parentId = null;
		}
		// Clear validation state to prevent warning messages when rules change
		formRef.value?.clearValidate();
	}
);

// Handle category change - auto-populate icon and description from template
const onCategoryChange = (category: SpaceCategory | null): void => {
	if (category && currentTemplates.value[category]) {
		const template = currentTemplates.value[category];
		// Only auto-populate if the field is empty or matches our tracked auto-populated value
		if (!model.icon || model.icon === autoPopulatedValues.icon) {
			model.icon = template.icon;
			autoPopulatedValues.icon = template.icon;
		}
		if (!model.description || model.description === autoPopulatedValues.description) {
			model.description = template.description;
			autoPopulatedValues.description = template.description;
		}
	}
};

const rules = computed<FormRules>(() => ({
	name: [{ required: true, message: t('spacesModule.fields.spaces.name.validation.required'), trigger: 'blur' }],
	category: [
		{
			required: model.type === SpaceType.ZONE,
			message: t('spacesModule.fields.spaces.category.validation.requiredForZone'),
			trigger: 'blur',
		},
	],
}));

watch(
	(): boolean => formChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	},
	{ immediate: true }
);

// Watch for space prop changes to reset auto-populated values
watch(
	() => props.space,
	(space) => {
		if (space) {
			// Reset auto-populated tracking for the new space
			autoPopulatedValues.icon = null;
			autoPopulatedValues.description = null;
		}
	}
);

const onSubmit = async (): Promise<void> => {
	try {
		await submit();

		const space = findById(model.id);

		if (space) {
			emit('saved', space);
		}
	} catch {
		// Error already handled by composable
	}
};

const onCancel = (): void => {
	emit('cancel');
};

defineExpose({
	submit: onSubmit,
});
</script>
