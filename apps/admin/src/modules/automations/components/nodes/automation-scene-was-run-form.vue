<template>
	<el-form
		label-position="top"
		:disabled="props.disabled"
		class="automation-scene-was-run-form"
		data-test-id="automation-scene-was-run-form"
		@submit.prevent
	>
		<el-form-item
			:label="t('automations.editor.fields.scene.title')"
			:error="errorText('scene_id')"
			required
			data-test-field="scene_id"
		>
			<el-select
				:model-value="typeof props.config.scene_id === 'string' && props.config.scene_id !== '' ? props.config.scene_id : undefined"
				:disabled="props.disabled"
				:loading="fetching"
				:placeholder="t('automations.editor.fields.scene.placeholder')"
				:no-data-text="t('automations.editor.fields.scene.empty')"
				name="scene_id"
				filterable
				@update:model-value="(value: string): void => form.update({ scene_id: value }, 'scene_id')"
			>
				<el-option
					v-for="scene in scenes"
					:key="scene.id"
					:label="scene.name"
					:value="scene.id"
				/>
			</el-select>
			<el-text
				tag="div"
				size="small"
				type="info"
				class="leading-4! mt-1"
			>
				{{ t('automations.editor.fields.sceneWasRun.hint') }}
			</el-text>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
/*
 * "Scene was run": the scene watched; it starts every time the scene runs, whoever runs it.
 */
import { onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElOption, ElSelect, ElText } from 'element-plus';

import { useScenes } from '../../../scenes/composables/useScenes';
import { useAutomationNodeForm } from '../../composables/useAutomationNodeForm';
import { useAutomationNodeLookups } from '../../composables/useAutomationNodeLookups';
import { SceneWasRunConfigSchema } from '../../nodes/nodes.schemas';
import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../canvas/automation-node-form.types';

defineOptions({
	name: 'AutomationSceneWasRunForm',
});

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

const form = useAutomationNodeForm(props, emit, SceneWasRunConfigSchema);

const { errorText } = form;

const { scenes, fetching } = useScenes();

const { ensureScenes } = useAutomationNodeLookups();

onBeforeMount((): void => {
	void ensureScenes();
});
</script>
