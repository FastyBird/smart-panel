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

			<!-- 3. Devices & Displays Section (or just Devices for zones) -->
			<el-collapse-item name="devicesDisplays">
				<template #title>
					<div class="flex items-center gap-2">
						<el-icon :size="20">
							<icon icon="mdi:devices" />
						</el-icon>
						<span class="font-medium">{{
							model.type === SpaceType.ROOM
								? t('spacesModule.edit.sections.devicesDisplays.title')
								: t('spacesModule.edit.sections.devicesDisplays.titleDevicesOnly')
						}}</span>
					</div>
				</template>

				<div class="px-2">
					<space-edit-summary-section
						:space-id="props.space.id"
						:space-type="model.type"
						:device-count="deviceCount"
						:display-count="displayCount"
						@manage-devices="emit('manage-devices')"
						@manage-displays="emit('manage-displays')"
					/>
				</div>
			</el-collapse-item>

			<!-- 4. Smart Overrides Section -->
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

					<!-- Lighting Roles -->
					<template v-if="hasLightingDevices">
						<space-lighting-roles :space="props.space" />
					</template>

					<!-- Climate Roles -->
					<template v-if="hasClimateDevices">
						<space-climate-roles :space="props.space" />
					</template>

					<!-- Smart Suggestions -->
					<el-divider content-position="left" class="mt-6!">
						{{ t('spacesModule.edit.sections.smartOverrides.smartSuggestions') }}
					</el-divider>

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
import { computed, onMounted, reactive, ref, watch } from 'vue';

import { Icon } from '@iconify/vue';
import {
	ElAlert,
	ElButton,
	ElCollapse,
	ElCollapseItem,
	ElDivider,
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
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { useDevices } from '../../devices/composables/composables';
import type { IDevice } from '../../devices/store/devices.store.types';
import { useDisplays } from '../../displays/composables/composables';
import type { IDisplay } from '../../displays/store/displays.store.types';
import { useSpaceCategories, useSpaceEditForm, useSpaces } from '../composables';
import {
	FormResult,
	isValidCategoryForType,
	type SpaceCategory,
	SpaceType,
} from '../spaces.constants';

import SpaceClimateRoles from './space-climate-roles.vue';
import SpaceEditSummarySection from './space-edit-summary-section.vue';
import SpaceLightingRoles from './space-lighting-roles.vue';
import { type ISpaceEditFormProps, spaceEditFormEmits } from './space-edit-form.types';

const props = withDefaults(defineProps<ISpaceEditFormProps>(), {
	hideActions: false,
});

const emit = defineEmits(spaceEditFormEmits);

const { t } = useI18n();

const { zoneSpaces, findById } = useSpaces();
const { devices: allDevices, loaded: devicesLoaded, fetchDevices } = useDevices();
const { displays: allDisplays, isLoaded: displaysLoaded, fetchDisplays } = useDisplays();

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

// Devices filtered by this space (room or zone)
const spaceDevices = computed<IDevice[]>(() => {
	if (!props.space?.id) return [];
	if (props.space.type === SpaceType.ROOM) {
		return allDevices.value.filter((device) => device.roomId === props.space.id);
	} else {
		// For zones: filter devices where zoneIds includes this zone
		return allDevices.value.filter((device) => device.zoneIds.includes(props.space.id));
	}
});

// Displays filtered by this space (room only - displays can only belong to rooms)
const spaceDisplays = computed<IDisplay[]>(() => {
	if (!props.space?.id || props.space.type !== SpaceType.ROOM) return [];
	return allDisplays.value.filter((display) => display.roomId === props.space.id);
});

// Device and display counts for summary section
const deviceCount = computed<number>(() => spaceDevices.value.length);
const displayCount = computed<number>(() => spaceDisplays.value.length);

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

// Check if there are lighting devices in this space
const hasLightingDevices = computed(() =>
	spaceDevices.value.some((d) => d.category === DevicesModuleDeviceCategory.lighting)
);

// Climate device categories for role assignment
const climateDeviceCategories = [
	DevicesModuleDeviceCategory.thermostat,
	DevicesModuleDeviceCategory.heater,
	DevicesModuleDeviceCategory.air_conditioner,
	DevicesModuleDeviceCategory.fan,
	DevicesModuleDeviceCategory.air_humidifier,
	DevicesModuleDeviceCategory.air_dehumidifier,
	DevicesModuleDeviceCategory.air_purifier,
];

// Check if there are climate devices in this space (for role assignment)
const hasClimateDevices = computed(() =>
	spaceDevices.value.some((d) => climateDeviceCategories.includes(d.category as DevicesModuleDeviceCategory))
);

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

onMounted(async () => {
	// Fetch devices if not already loaded
	if (!devicesLoaded.value) {
		await fetchDevices();
	}
	// Fetch displays if not already loaded
	if (!displaysLoaded.value) {
		await fetchDisplays();
	}
});

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
