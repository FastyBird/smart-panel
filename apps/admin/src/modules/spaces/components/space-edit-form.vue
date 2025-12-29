<template>
	<el-form ref="formRef" :model="formData" :rules="rules" label-position="top" @submit.prevent="onSubmit">
		<el-form-item :label="t('spacesModule.fields.spaces.name.title')" prop="name">
			<el-input v-model="formData.name" :placeholder="t('spacesModule.fields.spaces.name.placeholder')" />
		</el-form-item>

		<el-form-item :label="t('spacesModule.fields.spaces.type.title')" prop="type">
			<el-select v-model="formData.type" style="width: 100%">
				<el-option :label="t('spacesModule.fields.spaces.type.options.room')" :value="SpaceType.ROOM" />
				<el-option :label="t('spacesModule.fields.spaces.type.options.zone')" :value="SpaceType.ZONE" />
			</el-select>
		</el-form-item>

		<el-form-item :label="t('spacesModule.fields.spaces.category.title')" prop="category">
			<el-select
				v-model="formData.category"
				:placeholder="t('spacesModule.fields.spaces.category.placeholder')"
				:clearable="formData.type !== SpaceType.ZONE"
				style="width: 100%"
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
			<div class="text-xs text-gray-500 mt-1">
				{{ t('spacesModule.fields.spaces.category.hint') }}
			</div>
		</el-form-item>

		<el-form-item :label="t('spacesModule.fields.spaces.description.title')" prop="description">
			<el-input
				v-model="formData.description"
				type="textarea"
				:rows="3"
				:placeholder="t('spacesModule.fields.spaces.description.placeholder')"
			/>
		</el-form-item>

		<el-form-item :label="t('spacesModule.fields.spaces.icon.title')" prop="icon">
			<el-input v-model="formData.icon" :placeholder="t('spacesModule.fields.spaces.icon.placeholder')">
				<template v-if="formData.icon" #prefix>
					<el-icon>
						<icon :icon="formData.icon" />
					</el-icon>
				</template>
			</el-input>
		</el-form-item>

		<el-form-item :label="t('spacesModule.fields.spaces.displayOrder.title')" prop="displayOrder">
			<el-input-number
				v-model="formData.displayOrder"
				:min="0"
			/>
		</el-form-item>

		<!-- Parent Zone - only visible for rooms -->
		<el-form-item
			v-if="formData.type === SpaceType.ROOM"
			:label="t('spacesModule.fields.spaces.parentZone.title')"
			prop="parentId"
		>
			<el-select
				v-model="formData.parentId"
				:placeholder="t('spacesModule.fields.spaces.parentZone.placeholder')"
				clearable
				filterable
				style="width: 100%"
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
			<div class="text-xs text-gray-500 mt-1">
				{{ t('spacesModule.fields.spaces.parentZone.hint') }}
			</div>
		</el-form-item>

		<!-- Climate Device Overrides Section -->
		<template v-if="props.space && climateDevices.length > 0">
			<el-divider>{{ t('spacesModule.fields.spaces.climateOverrides.title') }}</el-divider>

			<el-form-item
				:label="t('spacesModule.fields.spaces.primaryThermostat.title')"
				prop="primaryThermostatId"
			>
				<el-select
					v-model="formData.primaryThermostatId"
					:placeholder="t('spacesModule.fields.spaces.primaryThermostat.placeholder')"
					clearable
					style="width: 100%"
					:loading="loadingDevices"
				>
					<el-option
						v-for="device in thermostatDevices"
						:key="device.id"
						:label="device.name"
						:value="device.id"
					/>
				</el-select>
				<div class="text-xs text-gray-500 mt-1">
					{{ t('spacesModule.fields.spaces.primaryThermostat.hint') }}
				</div>
			</el-form-item>

			<el-form-item
				:label="t('spacesModule.fields.spaces.primaryTemperatureSensor.title')"
				prop="primaryTemperatureSensorId"
			>
				<el-select
					v-model="formData.primaryTemperatureSensorId"
					:placeholder="t('spacesModule.fields.spaces.primaryTemperatureSensor.placeholder')"
					clearable
					style="width: 100%"
					:loading="loadingDevices"
				>
					<el-option
						v-for="device in temperatureSensorDevices"
						:key="device.id"
						:label="device.name"
						:value="device.id"
					/>
				</el-select>
				<div class="text-xs text-gray-500 mt-1">
					{{ t('spacesModule.fields.spaces.primaryTemperatureSensor.hint') }}
				</div>
			</el-form-item>
		</template>

		<!-- Lighting Roles Section -->
		<space-lighting-roles v-if="props.space && hasLightingDevices" :space="props.space" />

		<!-- Suggestions Section -->
		<template v-if="props.space">
			<el-divider>{{ t('spacesModule.fields.spaces.suggestions.title') }}</el-divider>

			<el-form-item
				prop="suggestionsEnabled"
				label-position="left"
			>
				<template #label>
					{{ t('spacesModule.fields.spaces.suggestionsEnabled.title') }}
				</template>
				<el-switch v-model="formData.suggestionsEnabled" />
			</el-form-item>
			<el-alert
				:title="t('spacesModule.fields.spaces.suggestionsEnabled.hint')"
				type="info"
				:closable="false"
				show-icon
			/>
		</template>

		<div
			v-if="!hideActions"
			class="flex gap-2 justify-end mt-4"
		>
			<el-button @click="onCancel">
				{{ t('spacesModule.buttons.cancel.title') }}
			</el-button>
			<el-button
				type="primary"
				:loading="saving"
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
import { ElAlert, ElButton, ElDivider, ElForm, ElFormItem, ElIcon, ElInput, ElInputNumber, ElOption, ElOptionGroup, ElSelect, ElSwitch, type FormInstance, type FormRules } from 'element-plus';
import { useI18n } from 'vue-i18n';

import { injectStoresManager, useBackend, useFlashMessage } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import {
	getCategoriesForType,
	getGroupedCategoriesForType,
	getTemplatesForType,
	isValidCategoryForType,
	SpaceCategory,
	SpaceType,
	SPACES_MODULE_PREFIX,
} from '../spaces.constants';
import { spacesStoreKey, type ISpace, type ISpaceCreateData } from '../store';

import SpaceLightingRoles from './space-lighting-roles.vue';

interface IProps {
	space?: ISpace;
	hideActions?: boolean;
}

interface IEmits {
	(e: 'saved', space: ISpace): void;
	(e: 'cancel'): void;
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}

interface ISpaceDevice {
	id: string;
	name: string;
	category: DevicesModuleDeviceCategory;
}

const props = withDefaults(defineProps<IProps>(), {
	space: undefined,
	hideActions: false,
});

const emit = defineEmits<IEmits>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const backend = useBackend();
const storesManager = injectStoresManager();
const spacesStore = storesManager.getStore(spacesStoreKey);

const formRef = ref<FormInstance>();
const saving = ref(false);
const loadingDevices = ref(false);
const spaceDevices = ref<ISpaceDevice[]>([]);

const initialValues = {
	name: props.space?.name ?? '',
	type: props.space?.type ?? SpaceType.ROOM,
	category: props.space?.category ?? null as SpaceCategory | null,
	description: props.space?.description ?? '',
	icon: props.space?.icon ?? '',
	displayOrder: props.space?.displayOrder ?? 0,
	parentId: props.space?.parentId ?? null as string | null,
	primaryThermostatId: props.space?.primaryThermostatId ?? null,
	primaryTemperatureSensorId: props.space?.primaryTemperatureSensorId ?? null,
	suggestionsEnabled: props.space?.suggestionsEnabled ?? true,
};

const formData = reactive({ ...initialValues });

// Track values that were auto-populated from templates (not manually entered)
const autoPopulatedValues = reactive({
	icon: null as string | null,
	description: null as string | null,
});

// List of available categories for the selector - depends on selected type
const categoryOptions = computed(() => getCategoriesForType(formData.type));

// Get templates for the current type
const currentTemplates = computed(() => getTemplatesForType(formData.type));

// Get category groups for zone type (null for rooms - they use flat list)
const categoryGroups = computed(() => getGroupedCategoriesForType(formData.type));

// Get available zones for parent zone selector (only zones, excluding the current space if editing)
const availableZones = computed(() =>
	spacesStore.findAll()
		.filter((s) => s.type === SpaceType.ZONE)
		.filter((s) => !props.space || s.id !== props.space.id)
);

// Handle type change - clear category if it becomes incompatible
watch(
	() => formData.type,
	(newType) => {
		if (formData.category && !isValidCategoryForType(formData.category, newType)) {
			formData.category = null;
			// Also clear auto-populated values since they may not apply anymore
			if (formData.icon === autoPopulatedValues.icon) {
				formData.icon = '';
				autoPopulatedValues.icon = null;
			}
			if (formData.description === autoPopulatedValues.description) {
				formData.description = '';
				autoPopulatedValues.description = null;
			}
		}
		// Zones cannot have a parent - clear parentId when switching to zone type
		if (newType === SpaceType.ZONE) {
			formData.parentId = null;
		}
	}
);

// Handle category change - auto-populate icon and description from template
const onCategoryChange = (category: SpaceCategory | null): void => {
	if (category && currentTemplates.value[category]) {
		const template = currentTemplates.value[category];
		// Only auto-populate if the field is empty or matches our tracked auto-populated value
		if (!formData.icon || formData.icon === autoPopulatedValues.icon) {
			formData.icon = template.icon;
			autoPopulatedValues.icon = template.icon;
		}
		if (!formData.description || formData.description === autoPopulatedValues.description) {
			formData.description = template.description;
			autoPopulatedValues.description = template.description;
		}
	}
};

const rules = computed<FormRules>(() => ({
	name: [{ required: true, message: t('spacesModule.fields.spaces.name.validation.required'), trigger: 'blur' }],
	type: [{ required: true, message: t('spacesModule.fields.spaces.type.validation.required'), trigger: 'change' }],
	category: [
		{
			required: formData.type === SpaceType.ZONE,
			message: t('spacesModule.fields.spaces.category.validation.requiredForZone'),
			trigger: 'change',
		},
	],
}));

// Filter devices by category
const thermostatDevices = computed(() =>
	spaceDevices.value.filter(d => d.category === DevicesModuleDeviceCategory.thermostat)
);

const sensorDevices = computed(() =>
	spaceDevices.value.filter(d => d.category === DevicesModuleDeviceCategory.sensor)
);

// Temperature sensor options include both thermostats (which have temp sensors) and standalone sensors
const temperatureSensorDevices = computed(() =>
	spaceDevices.value.filter(d =>
		d.category === DevicesModuleDeviceCategory.thermostat ||
		d.category === DevicesModuleDeviceCategory.sensor
	)
);

// All climate-capable devices (for showing/hiding the section)
const climateDevices = computed(() =>
	[...thermostatDevices.value, ...sensorDevices.value]
);

// Check if there are lighting devices in this space
const hasLightingDevices = computed(() =>
	spaceDevices.value.some(d => d.category === DevicesModuleDeviceCategory.lighting)
);

const formChanged = computed<boolean>((): boolean => {
	return (
		formData.name !== initialValues.name ||
		formData.type !== initialValues.type ||
		formData.category !== initialValues.category ||
		formData.description !== initialValues.description ||
		formData.icon !== initialValues.icon ||
		formData.displayOrder !== initialValues.displayOrder ||
		formData.parentId !== initialValues.parentId ||
		formData.primaryThermostatId !== initialValues.primaryThermostatId ||
		formData.primaryTemperatureSensorId !== initialValues.primaryTemperatureSensorId ||
		formData.suggestionsEnabled !== initialValues.suggestionsEnabled
	);
});

watch(
	(): boolean => formChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	},
	{ immediate: true }
);

watch(
	() => props.space,
	(space) => {
		if (space) {
			formData.name = space.name;
			formData.type = space.type;
			formData.category = space.category ?? null;
			formData.description = space.description ?? '';
			formData.icon = space.icon ?? '';
			formData.displayOrder = space.displayOrder;
			formData.parentId = space.parentId ?? null;
			formData.primaryThermostatId = space.primaryThermostatId ?? null;
			formData.primaryTemperatureSensorId = space.primaryTemperatureSensorId ?? null;
			formData.suggestionsEnabled = space.suggestionsEnabled ?? true;
			// Update initial values when space prop changes
			initialValues.name = space.name;
			initialValues.type = space.type;
			initialValues.category = space.category ?? null;
			initialValues.description = space.description ?? '';
			initialValues.icon = space.icon ?? '';
			initialValues.displayOrder = space.displayOrder;
			initialValues.parentId = space.parentId ?? null;
			initialValues.primaryThermostatId = space.primaryThermostatId ?? null;
			initialValues.primaryTemperatureSensorId = space.primaryTemperatureSensorId ?? null;
			initialValues.suggestionsEnabled = space.suggestionsEnabled ?? true;
			// Reset auto-populated tracking for the new space
			autoPopulatedValues.icon = null;
			autoPopulatedValues.description = null;
			// Reload devices for the new space
			loadSpaceDevices();
		}
	}
);

// Load devices for the space when editing
const loadSpaceDevices = async (): Promise<void> => {
	if (!props.space) {
		return;
	}

	loadingDevices.value = true;

	try {
		const { data: responseData, error } = await backend.client.GET(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/devices`,
			{ params: { path: { id: props.space.id } } }
		);

		if (error || !responseData) {
			return;
		}

		spaceDevices.value = (responseData.data ?? []).map((device) => ({
			id: device.id,
			name: device.name,
			category: device.category as DevicesModuleDeviceCategory,
		}));
	} finally {
		loadingDevices.value = false;
	}
};

onMounted(() => {
	if (props.space) {
		loadSpaceDevices();
	}
});

const onSubmit = async (): Promise<void> => {
	const valid = await formRef.value?.validate().catch(() => false);

	if (!valid) {
		return;
	}

	saving.value = true;

	try {
		const data: ISpaceCreateData = {
			name: formData.name,
			type: formData.type,
			category: formData.category || null,
			description: formData.description || null,
			icon: formData.icon || null,
			displayOrder: formData.displayOrder,
			parentId: formData.parentId || null,
			primaryThermostatId: formData.primaryThermostatId || null,
			primaryTemperatureSensorId: formData.primaryTemperatureSensorId || null,
			suggestionsEnabled: formData.suggestionsEnabled,
		};

		let savedSpace: ISpace;

		if (props.space) {
			savedSpace = await spacesStore.edit({ id: props.space.id, data });
		} else {
			savedSpace = await spacesStore.add({ data });
		}

		emit('saved', savedSpace);
	} catch {
		flashMessage.error(t('spacesModule.messages.saveError'));
	} finally {
		saving.value = false;
	}
};

const onCancel = (): void => {
	emit('cancel');
};

defineExpose({
	submit: onSubmit,
});
</script>
