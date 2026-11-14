<template>
	<el-form
		label-position="top"
		:disabled="props.disabled"
		class="space-mode-form"
		data-test-id="space-mode-form"
		@submit.prevent
	>
		<space-automation-space-field
			:model-value="props.config.space_id"
			:error="errorText('space_id')"
			:disabled="props.disabled"
			@update:model-value="(spaceId: string | undefined): void => form.update({ space_id: spaceId }, 'space_id')"
		/>

		<template v-if="type === SpaceAutomationNodeType.MODE_CHANGED">
			<el-form-item
				v-for="field in ['from', 'to'] as const"
				:key="field"
				:label="t(`automations.editor.fields.change.${field}`)"
				:error="errorText(field)"
				:data-test-field="field"
			>
				<automation-option-select
					:model-value="props.config[field]"
					:options="modes"
					:empty-label="t('automations.editor.fields.change.anyMode')"
					:disabled="props.disabled"
					:name="field"
					@update:model-value="(mode: string | undefined): void => form.update({ [field]: mode }, field)"
				/>
			</el-form-item>
		</template>

		<el-form-item
			v-else-if="type === SpaceAutomationNodeType.MODE_IS"
			:label="t('spacesHomeControlPlugin.automations.fields.mode.modes')"
			:error="errorText('modes')"
			required
			data-test-field="modes"
		>
			<automation-option-checkboxes
				:model-value="props.config.modes"
				:options="modes"
				:label="t('spacesHomeControlPlugin.automations.fields.mode.modes')"
				:disabled="props.disabled"
				@update:model-value="(picked: string[] | undefined): void => form.update({ modes: picked }, 'modes')"
			/>
		</el-form-item>

		<el-form-item
			v-else
			:label="t('spacesHomeControlPlugin.automations.fields.mode.mode')"
			:error="errorText('mode')"
			required
			data-test-field="mode"
		>
			<automation-option-select
				:model-value="props.config.mode"
				:options="modes"
				:placeholder="t('spacesHomeControlPlugin.automations.fields.mode.placeholder')"
				:disabled="props.disabled"
				name="mode"
				@update:model-value="(mode: string | undefined): void => form.update({ mode }, 'mode')"
			/>
		</el-form-item>

		<el-text
			tag="p"
			size="small"
			type="info"
			class="m-0! leading-4!"
		>
			{{ t(`spacesHomeControlPlugin.automations.fields.mode.hints.${hint}`) }}
		</el-text>
	</el-form>
</template>

<script setup lang="ts">
/*
 * "Space mode changes", "Space mode is" and "Set space mode": the room or zone, and its activity mode -
 * the mode it changes to or from, the modes that answer "yes", or the mode to activate.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElText } from 'element-plus';

import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../../../../modules/automations/components/canvas/automation-node-form.types';
import AutomationOptionCheckboxes from '../../../../modules/automations/components/nodes/automation-option-checkboxes.vue';
import type { IAutomationOption } from '../../../../modules/automations/components/nodes/automation-option-select.types';
import AutomationOptionSelect from '../../../../modules/automations/components/nodes/automation-option-select.vue';
import { useAutomationNodeForm } from '../../../../modules/automations/composables/useAutomationNodeForm';
import { SPACE_ACTIVITY_MODES, SpaceAutomationNodeType } from '../../automations/space-automations.constants';
import { SPACE_AUTOMATION_CONFIG_SCHEMAS } from '../../automations/space-automations.schemas';

import SpaceAutomationSpaceField from './space-automation-space-field.vue';

defineOptions({
	name: 'SpaceModeForm',
});

const HINTS: Record<string, string> = {
	[SpaceAutomationNodeType.MODE_CHANGED]: 'changed',
	[SpaceAutomationNodeType.MODE_IS]: 'is',
	[SpaceAutomationNodeType.MODE_SET]: 'set',
};

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

const type = computed<string>((): string => props.nodeType.type);

const hint = computed<string>((): string => HINTS[type.value] ?? 'set');

const form = useAutomationNodeForm(
	props,
	emit,
	SPACE_AUTOMATION_CONFIG_SCHEMAS[type.value as SpaceAutomationNodeType] ?? SPACE_AUTOMATION_CONFIG_SCHEMAS[SpaceAutomationNodeType.MODE_SET]
);

const { errorText } = form;

const modes = computed<IAutomationOption[]>((): IAutomationOption[] =>
	SPACE_ACTIVITY_MODES.map((mode) => ({ value: mode, label: t(`spacesHomeControlPlugin.activityModes.modes.${mode}`) }))
);
</script>
