<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				icon="mdi:plus"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('scenes.headings.add') }}
		</template>

		<template #subtitle>
			{{ t('scenes.subHeadings.list') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="onClose"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>
	</app-bar-button>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="onSave"
	>
		<span class="uppercase">{{ t('scenes.buttons.save') }}</span>
	</app-bar-button>

	<div class="flex flex-col overflow-hidden h-full">
		<el-scrollbar class="grow-1 p-2 md:px-4">
			<el-form ref="formRef" :model="form" :rules="rules" label-position="top">
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
								:title="t('scenes.edit.sections.general.hint')"
								type="info"
								:closable="false"
								show-icon
								class="!mb-4"
							/>

							<!-- Scene Name -->
							<el-form-item :label="t('scenes.form.name')" prop="name">
								<el-input v-model="form.name" :placeholder="t('scenes.form.namePlaceholder')" />
							</el-form-item>

							<!-- Category -->
							<el-form-item :label="t('scenes.form.category')" prop="category">
								<el-select v-model="form.category" style="width: 100%">
									<template #prefix>
										<icon :icon="SCENE_CATEGORY_ICONS[form.category]" class="text-lg" />
									</template>
									<el-option
										v-for="cat in categories"
										:key="cat"
										:label="t(`scenes.categories.${cat}`)"
										:value="cat"
									>
										<div class="flex items-center gap-2">
											<icon :icon="SCENE_CATEGORY_ICONS[cat]" class="text-lg" />
											<span>{{ t(`scenes.categories.${cat}`) }}</span>
										</div>
									</el-option>
								</el-select>
							</el-form-item>

							<!-- Space Selection -->
							<el-form-item :label="t('scenes.form.space')" prop="primarySpaceId">
								<el-select
									v-model="form.primarySpaceId"
									:placeholder="t('scenes.form.selectSpace')"
									:loading="spacesLoading"
									clearable
									filterable
									style="width: 100%"
								>
									<template #prefix>
										<icon v-if="form.primarySpaceId" :icon="getSelectedSpaceIcon()" class="text-lg" />
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
									v-model="form.description"
									type="textarea"
									:rows="2"
									:placeholder="t('scenes.form.descriptionPlaceholder')"
								/>
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
								<el-tag v-if="form.actions.length > 0" size="small" type="info">
									{{ form.actions.length }}
								</el-tag>
							</div>
						</template>

						<div class="px-2">
							<!-- Empty State -->
							<div v-if="form.actions.length === 0" class="empty-actions-state">
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
								v-for="(action, index) in form.actions"
								:key="action.id || index"
								class="action-card mb-3"
								shadow="never"
							>
								<div class="flex justify-between items-start">
									<div>
										<div class="font-medium mb-1">
											{{ t('scenes.form.actionNumber', { number: index + 1 }) }}
										</div>
										<div class="text-sm text-gray-500">
											{{ getPluginLabel(action.type) }}
										</div>
									</div>
									<el-button type="danger" size="small" text @click="removeAction(index)">
										<icon icon="mdi:delete" />
									</el-button>
								</div>
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
		</el-scrollbar>

		<div
			v-if="isMDDevice"
			class="flex flex-row gap-2 justify-end items-center b-t b-t-solid shadow-top z-10 w-full h-[3rem]"
			style="background-color: var(--el-drawer-bg-color)"
		>
			<div class="p-2">
				<el-button link class="mr-2" @click="onClose">
					{{ t('scenes.buttons.cancel') }}
				</el-button>

				<el-button :loading="saving" type="primary" @click="onSave">
					{{ t('scenes.buttons.save') }}
				</el-button>
			</div>
		</div>

		<!-- Action Form Dialog -->
		<el-dialog
			v-model="showActionForm"
			title="Add action"
			width="500px"
			:close-on-click-modal="false"
			@close="onActionFormCancel"
		>
			<component
				:is="currentActionFormComponent"
				v-if="currentActionFormComponent"
				:id="uuid()"
				:scene-id="''"
				:remote-form-submit="actionFormSubmit"
				@update:remote-form-submit="actionFormSubmit = $event"
				@submit="onActionFormSubmit"
			/>
			<template #footer>
				<el-button @click="onActionFormCancel">
					{{ t('scenes.buttons.cancel') }}
				</el-button>
				<el-button type="primary" @click="actionFormSubmit = true">
					{{ t('scenes.buttons.save') }}
				</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

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
	ElMessage,
	ElOption,
	ElOptionGroup,
	ElScrollbar,
	ElSelect,
	ElTag,
	type FormInstance,
	type FormRules,
} from 'element-plus';
import { Icon } from '@iconify/vue';
import { v4 as uuid } from 'uuid';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, useBreakpoints } from '../../../common';
import { useSpaces } from '../../spaces/composables';
import { SPACE_CATEGORY_TEMPLATES, SpaceType } from '../../spaces/spaces.constants';
import { useScenesActionPlugins } from '../composables/useScenesActionPlugins';
import { useScenesActions } from '../composables/useScenesActions';
import { RouteNames, SCENE_CATEGORY_ICONS, SceneCategory } from '../scenes.constants';
import type { ISceneActionAddForm } from '../schemas/scenes.types';

import type { IViewSceneAddProps } from './view-scene-add.types';

defineOptions({
	name: 'ViewSceneAdd',
});

defineProps<IViewSceneAddProps>();

defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

interface ISceneActionData extends ISceneActionAddForm {
	type: string;
}

interface ISceneForm {
	primarySpaceId: string | null;
	name: string;
	category: SceneCategory;
	description: string;
	actions: ISceneActionData[];
}

const { t } = useI18n();
const router = useRouter();

const { isMDDevice, isLGDevice } = useBreakpoints();

const { addScene } = useScenesActions();
const { spaces, fetching: spacesLoading, fetchSpaces } = useSpaces();
const { options: actionPluginOptions, getElement } = useScenesActionPlugins();

const saving = ref(false);
const formRef = ref<FormInstance>();

// Collapse state - both sections open by default
const activeCollapses = ref<string[]>(['general', 'actions']);

// Action form state
const selectedPluginType = ref<string | null>(null);
const editingActionIndex = ref<number | null>(null);
const showActionForm = ref(false);
const actionFormSubmit = ref(false);

const form = reactive<ISceneForm>({
	primarySpaceId: null,
	name: '',
	category: SceneCategory.GENERIC,
	description: '',
	actions: [],
});

const categories = Object.values(SceneCategory);

const currentActionFormComponent = computed(() => {
	if (!selectedPluginType.value) return null;
	const element = getElement(selectedPluginType.value);
	return element?.components?.sceneActionAddForm ?? null;
});

interface ISpaceOption {
	value: string;
	label: string;
	icon: string;
}

interface ISpaceOptionGroup {
	type: SpaceType;
	label: string;
	icon: string;
	options: ISpaceOption[];
}

const getSpaceIcon = (space: (typeof spaces.value)[0]): string => {
	// Use custom icon if available
	if (space.icon) {
		return space.icon;
	}
	// Use category template icon if category is set
	if (space.category && SPACE_CATEGORY_TEMPLATES[space.category]) {
		return SPACE_CATEGORY_TEMPLATES[space.category].icon;
	}
	// Default icons based on type
	return space.type === SpaceType.ROOM ? 'mdi:door' : 'mdi:map-marker-radius';
};

const spacesOptionsGrouped = computed<ISpaceOptionGroup[]>(() => {
	const rooms = spaces.value
		.filter((space) => space.type === SpaceType.ROOM)
		.map((space) => ({
			value: space.id,
			label: space.name,
			icon: getSpaceIcon(space),
		}))
		.sort((a, b) => a.label.localeCompare(b.label));

	const zones = spaces.value
		.filter((space) => space.type === SpaceType.ZONE)
		.map((space) => ({
			value: space.id,
			label: space.name,
			icon: getSpaceIcon(space),
		}))
		.sort((a, b) => a.label.localeCompare(b.label));

	const groups: ISpaceOptionGroup[] = [];

	if (rooms.length > 0) {
		groups.push({
			type: SpaceType.ROOM,
			label: t('scenes.form.spaceGroups.rooms'),
			icon: 'mdi:door',
			options: rooms,
		});
	}

	if (zones.length > 0) {
		groups.push({
			type: SpaceType.ZONE,
			label: t('scenes.form.spaceGroups.zones'),
			icon: 'mdi:map-marker-radius',
			options: zones,
		});
	}

	return groups;
});

const getSelectedSpaceIcon = (): string => {
	for (const group of spacesOptionsGrouped.value) {
		const found = group.options.find((o) => o.value === form.primarySpaceId);
		if (found) {
			return found.icon;
		}
	}
	return 'mdi:map-marker';
};

const rules: FormRules = {
	name: [{ required: true, message: t('scenes.form.nameRequired'), trigger: 'blur' }],
	category: [{ required: true, message: t('scenes.form.categoryRequired'), trigger: 'change' }],
};

const onPluginSelected = (pluginType: string): void => {
	selectedPluginType.value = pluginType;
	editingActionIndex.value = null;
	showActionForm.value = true;
};

const onActionFormSubmit = (data: ISceneActionAddForm & { type: string }): void => {
	if (editingActionIndex.value !== null) {
		// Editing existing action
		form.actions[editingActionIndex.value] = {
			...data,
			type: selectedPluginType.value!,
		};
	} else {
		// Adding new action
		form.actions.push({
			...data,
			type: selectedPluginType.value!,
		});
	}

	showActionForm.value = false;
	selectedPluginType.value = null;
	editingActionIndex.value = null;
};

const onActionFormCancel = (): void => {
	showActionForm.value = false;
	selectedPluginType.value = null;
	editingActionIndex.value = null;
};

const removeAction = (index: number): void => {
	form.actions.splice(index, 1);
};

const getPluginLabel = (type: string): string => {
	const option = actionPluginOptions.value.find((o) => o.value === type);
	return option?.label ?? type;
};

const onClose = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.SCENES });
	} else {
		router.push({ name: RouteNames.SCENES });
	}
};

const validateActions = (): boolean => {
	if (form.actions.length === 0) {
		ElMessage.error(t('scenes.form.actionsRequired'));
		return false;
	}

	// Actions are validated by their respective plugin forms
	return true;
};

const onSave = async (): Promise<void> => {
	if (!formRef.value) return;

	try {
		await formRef.value.validate();
	} catch {
		return;
	}

	// Validate conditionally rendered action fields
	if (!validateActions()) {
		return;
	}

	saving.value = true;

	try {
		await addScene({
			id: uuid(),
			draft: false,
			data: {
				primarySpaceId: form.primarySpaceId,
				category: form.category,
				name: form.name,
				description: form.description || null,
				enabled: true,
				actions: form.actions.map((action, index) => ({
					id: action.id ?? uuid(),
					type: action.type,
					deviceId: action.deviceId,
					channelId: action.channelId || null,
					propertyId: action.propertyId,
					value: action.value,
					order: index,
					enabled: action.enabled ?? true,
				})),
			},
		});

		ElMessage.success(t('scenes.messages.created'));
		onClose();
	} catch {
		ElMessage.error(t('scenes.messages.createFailed'));
	} finally {
		saving.value = false;
	}
};

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
