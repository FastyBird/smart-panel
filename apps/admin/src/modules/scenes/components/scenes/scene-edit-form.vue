<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('scenes.form.name')"
			prop="name"
		>
			<el-input
				v-model="model.name"
				:placeholder="t('scenes.form.namePlaceholder')"
				name="name"
			/>
		</el-form-item>

		<el-form-item
			:label="t('scenes.form.category')"
			prop="category"
		>
			<el-select
				v-model="model.category"
				name="category"
				filterable
				style="width: 100%"
			>
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
						<icon
							:icon="item.icon"
							class="text-lg"
						/>
						<span>{{ item.label }}</span>
					</div>
				</el-option>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('scenes.form.space')"
			prop="primarySpaceId"
		>
			<el-select
				v-model="model.primarySpaceId"
				:placeholder="t('scenes.form.selectSpace')"
				:loading="loadingSpaces"
				name="primarySpaceId"
				filterable
				clearable
				style="width: 100%"
			>
				<template #prefix>
					<icon
						v-if="model.primarySpaceId"
						:icon="getSelectedSpaceIcon()"
						class="text-lg"
					/>
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
								<icon
									:icon="item.icon"
									class="text-lg"
								/>
								<span>{{ item.label }}</span>
							</div>
						</el-option>
					</template>
				</el-option-group>
			</el-select>
		</el-form-item>

		<el-divider />

		<el-form-item
			:label="t('scenes.form.description')"
			prop="description"
		>
			<el-input
				v-model="model.description"
				:placeholder="t('scenes.form.descriptionPlaceholder')"
				:rows="4"
				type="textarea"
				name="description"
			/>
		</el-form-item>

		<el-form-item label-position="left">
			<template #label>
				{{ t('scenes.fields.enabled') }}
			</template>
			<el-switch
				v-model="model.enabled"
				name="enabled"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { onMounted, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElDivider, ElForm, ElFormItem, ElInput, ElOption, ElOptionGroup, ElSelect, ElSwitch, type FormRules } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useSceneEditForm } from '../../composables/composables';
import { FormResult, type FormResultType } from '../../scenes.constants';
import type { ISceneEditForm } from '../../schemas/scenes.types';

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

const { categoriesOptions, spacesOptionsGrouped, model, formEl, formChanged, submit, formResult, loadingSpaces, fetchSpaces } = useSceneEditForm({
	scene: props.scene,
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
});

watch(
	(): FormResultType => formResult.value,
	async (val: FormResultType): Promise<void> => {
		emit('update:remote-form-result', val);
	}
);

watch(
	(): boolean => props.remoteFormSubmit,
	async (val: boolean): Promise<void> => {
		if (val) {
			emit('update:remote-form-submit', false);

			submit().catch(() => {
				// The form is not valid
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
