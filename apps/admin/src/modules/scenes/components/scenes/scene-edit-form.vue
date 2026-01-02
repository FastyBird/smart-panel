<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-collapse v-model="activeCollapses">
			<!-- 1. General Section -->
			<el-collapse-item name="general">
				<template #title>
					<div class="flex items-center gap-2">
						<el-icon :size="20">
							<icon icon="mdi:information" />
						</el-icon>
						<span class="font-medium">{{ t('scenes.edit.sections.general.title') }}</span>
					</div>
				</template>

				<div class="px-2">
					<el-alert
						type="info"
						:closable="false"
						show-icon
						class="!mb-4"
					>
						<template #title>
							<span v-html="t('scenes.edit.sections.general.hint')" />
						</template>
					</el-alert>

					<!-- Scene Name -->
					<el-form-item :label="t('scenes.form.name')" prop="name">
						<el-input v-model="model.name" :placeholder="t('scenes.form.namePlaceholder')" />
					</el-form-item>

					<!-- Category -->
					<el-form-item :label="t('scenes.form.category')" prop="category">
						<el-select v-model="model.category" style="width: 100%">
							<template #prefix>
								<icon
									v-if="model.category"
									:icon="categoriesOptions.find((o) => o.value === model.category)?.icon || 'mdi:playlist-play'"
									class="text-lg"
								/>
							</template>
							<el-option
								v-for="item in categoriesOptions"
								:key="item.value"
								:label="item.label"
								:value="item.value"
							>
								<div class="flex items-center gap-2">
									<icon :icon="item.icon" class="text-lg" />
									<span>{{ item.label }}</span>
								</div>
							</el-option>
						</el-select>
					</el-form-item>

					<!-- Space Selection -->
					<el-form-item :label="t('scenes.form.space')" prop="primarySpaceId">
						<el-select
							v-model="model.primarySpaceId"
							:placeholder="t('scenes.form.selectSpace')"
							:loading="loadingSpaces"
							clearable
							filterable
							style="width: 100%"
						>
							<template #prefix>
								<icon v-if="model.primarySpaceId" :icon="getSelectedSpaceIcon()" class="text-lg" />
							</template>
							<el-option-group
								v-for="group in spacesOptionsGrouped"
								:key="group.type"
								:label="group.label"
							>
								<template #default>
									<el-option
										v-for="item in group.options"
										:key="item.value"
										:label="item.label"
										:value="item.value"
									>
										<div class="flex items-center gap-2">
											<icon :icon="item.icon" class="text-lg" />
											<span>{{ item.label }}</span>
										</div>
									</el-option>
								</template>
							</el-option-group>
						</el-select>
					</el-form-item>

					<!-- Description -->
					<el-form-item :label="t('scenes.form.description')">
						<el-input
							v-model="model.description"
							type="textarea"
							:rows="2"
							:placeholder="t('scenes.form.descriptionPlaceholder')"
						/>
					</el-form-item>

					<!-- Enabled Switch -->
					<el-form-item label-position="left">
						<template #label>
							{{ t('scenes.fields.enabled') }}
						</template>
						<el-switch v-model="model.enabled" />
					</el-form-item>
				</div>
			</el-collapse-item>

			<!-- 2. Actions Section -->
			<el-collapse-item name="actions">
				<template #title>
					<div class="flex items-center gap-2">
						<el-icon :size="20">
							<icon icon="mdi:play-box-multiple" />
						</el-icon>
						<span class="font-medium">{{ t('scenes.edit.sections.actions.title') }}</span>
						<el-tag v-if="model.actions.length > 0" size="small" type="info">
							{{ model.actions.length }}
						</el-tag>
					</div>
				</template>

				<div class="px-2">
					<!-- Empty State -->
					<div v-if="model.actions.length === 0" class="empty-actions-state">
						<el-icon :size="48" class="text-gray-300 mb-3">
							<icon icon="mdi:playlist-plus" />
						</el-icon>
						<div class="text-gray-600 font-medium mb-1">
							{{ t('scenes.edit.sections.actions.emptyTitle') }}
						</div>
						<div class="text-gray-400 text-sm mb-4">
							{{ t('scenes.edit.sections.actions.emptyDescription') }}
						</div>
					</div>

					<!-- Action Cards -->
					<el-card
						v-for="(action, index) in model.actions"
						:key="action.id || index"
						class="action-card mb-3"
						header-class="p-2!"
						body-class="p-2!"
						shadow="never"
					>
						<template #header>
							<div class="flex justify-between items-center">
								<span class="text-sm font-medium">{{ getPluginLabel(action.type) }}</span>
								<div class="flex gap-1">
									<el-button size="small" plain @click="onEditAction(index)">
										<template #icon>
											<icon icon="mdi:pencil" />
										</template>
									</el-button>
									<el-button type="warning" size="small" plain @click="onRemoveAction(index)">
										<template #icon>
											<icon icon="mdi:trash" />
										</template>
									</el-button>
								</div>
							</div>
						</template>
						<component
							:is="getActionCardComponent(action.type)"
							:action="action"
						/>
					</el-card>

					<!-- Add Action Dropdown -->
					<el-dropdown trigger="click" style="width: 100%" @command="onPluginSelected">
						<el-button type="primary" plain style="width: 100%">
							<template #icon>
								<icon icon="mdi:plus" />
							</template>
							{{ t('scenes.form.addAction') }}
							<el-icon class="el-icon--right">
								<icon icon="mdi:chevron-down" />
							</el-icon>
						</el-button>
						<template #dropdown>
							<el-dropdown-menu>
								<el-dropdown-item
									v-for="option in actionPluginOptions"
									:key="option.value"
									:command="option.value"
									:disabled="option.disabled"
								>
									<div class="flex items-center gap-2">
										<el-icon :size="18">
											<icon icon="mdi:cog" />
										</el-icon>
										<span>{{ option.label }}</span>
									</div>
								</el-dropdown-item>
							</el-dropdown-menu>
						</template>
					</el-dropdown>

					<!-- Helper Text -->
					<div class="text-gray-400 text-xs mt-2 text-center">
						{{ t('scenes.edit.sections.actions.helperText') }}
					</div>
				</div>
			</el-collapse-item>
		</el-collapse>
	</el-form>

	<!-- Action Add Form Dialog -->
	<el-dialog
		v-model="showActionForm"
		:title="t('scenes.form.addAction')"
		width="500px"
		:close-on-click-modal="false"
		@close="onActionFormCancel"
	>
		<component
			:is="currentActionFormComponent"
			v-if="currentActionFormComponent"
			:id="newActionId"
			:scene-id="model.id"
			:scene-category="model.category"
			:remote-form-submit="actionFormSubmit"
			@update:remote-form-submit="actionFormSubmit = $event"
			@submit="onActionFormSubmit"
		/>
		<template #footer>
			<el-button @click="onActionFormCancel">
				{{ t('scenes.buttons.cancel.title') }}
			</el-button>
			<el-button type="primary" @click="actionFormSubmit = true">
				{{ t('scenes.buttons.save.title') }}
			</el-button>
		</template>
	</el-dialog>

	<!-- Action Edit Form Dialog -->
	<el-dialog
		v-model="showEditActionForm"
		:title="t('scenes.form.editAction')"
		width="500px"
		:close-on-click-modal="false"
		@close="onEditActionFormCancel"
	>
		<component
			:is="currentEditActionFormComponent"
			v-if="currentEditActionFormComponent && editingAction"
			:action="editingAction"
			:scene-id="model.id"
			:remote-form-submit="editActionFormSubmit"
			@update:remote-form-submit="editActionFormSubmit = $event"
			@submit="onEditActionFormSubmit"
		/>
		<template #footer>
			<el-button @click="onEditActionFormCancel">
				{{ t('scenes.buttons.cancel.title') }}
			</el-button>
			<el-button type="primary" @click="editActionFormSubmit = true">
				{{ t('scenes.buttons.save.title') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElCard,
	ElCollapse,
	ElCollapseItem,
	ElDialog,
	ElDropdown,
	ElDropdownItem,
	ElDropdownMenu,
	ElForm,
	ElFormItem,
	ElIcon,
	ElInput,
	ElOption,
	ElOptionGroup,
	ElSelect,
	ElSwitch,
	ElTag,
	type FormRules,
} from 'element-plus';
import { Icon } from '@iconify/vue';
import { v4 as uuid } from 'uuid';

import { useFlashMessage } from '../../../../common';
import { useSceneEditForm } from '../../composables/composables';
import { FormResult, type FormResultType } from '../../scenes.constants';
import type { ISceneActionAddForm, ISceneEditForm } from '../../schemas/scenes.types';

import type { ISceneEditFormProps } from './scene-edit-form.types';

defineOptions({
	name: 'SceneEditForm',
});

const props = withDefaults(defineProps<ISceneEditFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();

const flashMessage = useFlashMessage();

const {
	categoriesOptions,
	spacesOptionsGrouped,
	model,
	formEl,
	formChanged,
	submit,
	formResult,
	loadingSpaces,
	fetchSpaces,
	actionPluginOptions,
	addAction,
	removeAction,
	updateAction,
	getActionCardComponent,
	getActionFormComponent,
	getActionEditFormComponent,
	getPluginLabel,
} = useSceneEditForm({
	scene: props.scene,
});

// Collapse state - both sections open by default
const activeCollapses = ref<string[]>(['general', 'actions']);

// Action add form state
const selectedPluginType = ref<string | null>(null);
const showActionForm = ref(false);
const actionFormSubmit = ref(false);
const newActionId = ref<string>(uuid());

// Action edit form state
const showEditActionForm = ref(false);
const editActionFormSubmit = ref(false);
const editingActionIndex = ref<number | null>(null);
const editingAction = ref<ISceneActionAddForm | null>(null);

const currentActionFormComponent = computed(() => {
	if (!selectedPluginType.value) return null;
	return getActionFormComponent(selectedPluginType.value);
});

const currentEditActionFormComponent = computed(() => {
	if (!editingAction.value) return null;
	return getActionEditFormComponent(editingAction.value.type);
});

const getSelectedSpaceIcon = (): string => {
	for (const group of spacesOptionsGrouped.value) {
		const found = group.options.find((o) => o.value === model.primarySpaceId);
		if (found) {
			return found.icon;
		}
	}
	return 'mdi:map-marker';
};

const rules = reactive<FormRules<ISceneEditForm>>({
	name: [{ required: true, message: t('scenes.form.nameRequired'), trigger: 'change' }],
	category: [{ required: true, message: t('scenes.form.categoryRequired'), trigger: 'change' }],
});

const onPluginSelected = (pluginType: string): void => {
	selectedPluginType.value = pluginType;
	newActionId.value = uuid();
	showActionForm.value = true;
};

const onActionFormSubmit = (data: ISceneActionAddForm & { type: string }): void => {
	addAction({
		...data,
		type: selectedPluginType.value!,
	});

	showActionForm.value = false;
	selectedPluginType.value = null;
};

const onActionFormCancel = (): void => {
	showActionForm.value = false;
	selectedPluginType.value = null;
};

const onRemoveAction = (index: number): void => {
	removeAction(index);
};

const onEditAction = (index: number): void => {
	const action = model.actions[index];
	if (!action) return;

	editingActionIndex.value = index;
	editingAction.value = { ...action };
	showEditActionForm.value = true;
};

const onEditActionFormSubmit = (data: ISceneActionAddForm & { type: string }): void => {
	if (editingActionIndex.value !== null) {
		updateAction(editingActionIndex.value, data);
	}

	showEditActionForm.value = false;
	editingActionIndex.value = null;
	editingAction.value = null;
};

const onEditActionFormCancel = (): void => {
	showEditActionForm.value = false;
	editingActionIndex.value = null;
	editingAction.value = null;
};

const validateAndSubmit = async (): Promise<void> => {
	if (model.actions.length === 0) {
		formResult.value = FormResult.ERROR;
		flashMessage.error(t('scenes.form.actionsRequired'));
		throw new Error('No actions');
	}

	await submit();
};

watch(
	(): FormResultType => formResult.value,
	(val: FormResultType): void => {
		emit('update:remote-form-result', val);
	}
);

watch(
	(): boolean => props.remoteFormSubmit,
	(val: boolean): void => {
		if (val) {
			emit('update:remote-form-submit', false);

			validateAndSubmit().catch((error) => {
				// Ensure form result is set to ERROR if it's still WORKING
				if (formResult.value === FormResult.WORKING) {
					formResult.value = FormResult.ERROR;
				}
				// Log the error for debugging
				console.error('Scene edit form submission error:', error);
			});
		}
	}
);

watch(
	(): boolean => props.remoteFormReset,
	(val: boolean): void => {
		emit('update:remote-form-reset', false);

		if (val) {
			if (!formEl.value) return;

			formEl.value.resetFields();
		}
	}
);

watch(
	(): boolean => formChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);

onMounted(async () => {
	await fetchSpaces();
});
</script>

<style scoped>
.empty-actions-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 24px 16px;
	text-align: center;
}
</style>
