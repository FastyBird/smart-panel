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
		</el-form-item>

		<el-alert
			v-if="formData.type === SpaceType.ROOM"
			:title="t('spacesModule.fields.spaces.parentZone.hint')"
			type="info"
			:closable="false"
			show-icon
			class="!mt-2"
		/>

		<div
			v-if="!props.hideActions"
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
import { computed, reactive, ref, watch } from 'vue';

import { Icon } from '@iconify/vue';
import { ElAlert, ElButton, ElForm, ElFormItem, ElIcon, ElInput, ElInputNumber, ElOption, ElOptionGroup, ElSelect, type FormInstance, type FormRules } from 'element-plus';
import { useI18n } from 'vue-i18n';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { useSpaceCategories } from '../composables';
import {
	isValidCategoryForType,
	SpaceCategory,
	SpaceType,
} from '../spaces.constants';
import { spacesStoreKey, type ISpace, type ISpaceCreateData } from '../store';

import { type ISpaceAddFormProps, spaceAddFormEmits } from './space-add-form.types';

const props = withDefaults(defineProps<ISpaceAddFormProps>(), {
	hideActions: false,
});

const emit = defineEmits(spaceAddFormEmits);

const { t } = useI18n();
const flashMessage = useFlashMessage();

const storesManager = injectStoresManager();
const spacesStore = storesManager.getStore(spacesStoreKey);

const formRef = ref<FormInstance>();
const saving = ref(false);

const initialValues = {
	name: '',
	type: SpaceType.ROOM,
	category: null as SpaceCategory | null,
	description: '',
	icon: '',
	displayOrder: 0,
	parentId: null as string | null,
};

const formData = reactive({ ...initialValues });

// Track values that were auto-populated from templates (not manually entered)
const autoPopulatedValues = reactive({
	icon: null as string | null,
	description: null as string | null,
});

// Category options, groups, and templates based on the selected space type
const { categoryOptions, categoryGroups, currentTemplates } = useSpaceCategories(
	computed(() => formData.type)
);

// Get available zones for parent zone selector
const availableZones = computed(() =>
	spacesStore.findAll().filter((s) => s.type === SpaceType.ZONE)
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

const formChanged = computed<boolean>((): boolean => {
	return (
		formData.name !== initialValues.name ||
		formData.type !== initialValues.type ||
		formData.category !== initialValues.category ||
		formData.description !== initialValues.description ||
		formData.icon !== initialValues.icon ||
		formData.displayOrder !== initialValues.displayOrder ||
		formData.parentId !== initialValues.parentId
	);
});

watch(
	(): boolean => formChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	},
	{ immediate: true }
);

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
		};

		const savedSpace: ISpace = await spacesStore.add({ data });

		emit('saved', savedSpace);
	} catch {
		flashMessage.error(t('spacesModule.messages.createError'));
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
