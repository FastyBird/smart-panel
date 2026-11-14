<template>
	<el-form
		label-position="top"
		:disabled="props.disabled"
		class="automation-house-mode-changed-form"
		data-test-id="automation-house-mode-changed-form"
		@submit.prevent
	>
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
	</el-form>
</template>

<script setup lang="ts">
/*
 * "House mode changes": any change, or only a change to a mode, from a mode, or from one to another.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem } from 'element-plus';

import { useAutomationNodeForm } from '../../composables/useAutomationNodeForm';
import { AUTOMATION_HOUSE_MODES } from '../../nodes/nodes.constants';
import { HouseModeChangedConfigSchema } from '../../nodes/nodes.schemas';
import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../canvas/automation-node-form.types';

import type { IAutomationOption } from './automation-option-select.types';
import AutomationOptionSelect from './automation-option-select.vue';

defineOptions({
	name: 'AutomationHouseModeChangedForm',
});

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

const form = useAutomationNodeForm(props, emit, HouseModeChangedConfigSchema);

const { errorText } = form;

const modes = computed<IAutomationOption[]>((): IAutomationOption[] =>
	AUTOMATION_HOUSE_MODES.map((mode) => ({ value: mode, label: t(`automations.editor.options.houseModes.${mode}`) }))
);
</script>
