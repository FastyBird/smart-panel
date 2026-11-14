<template>
	<el-form
		label-position="top"
		:disabled="props.disabled"
		class="automation-house-mode-is-form"
		data-test-id="automation-house-mode-is-form"
		@submit.prevent
	>
		<el-form-item
			:label="t('automations.editor.fields.houseMode.modes')"
			:error="errorText('modes')"
			required
			data-test-field="modes"
		>
			<automation-option-checkboxes
				:model-value="props.config.modes"
				:options="modes"
				:label="t('automations.editor.fields.houseMode.modes')"
				:disabled="props.disabled"
				@update:model-value="(picked: string[] | undefined): void => form.update({ modes: picked }, 'modes')"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
/*
 * "House mode is": the house modes that answer "yes".
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem } from 'element-plus';

import { useAutomationNodeForm } from '../../composables/useAutomationNodeForm';
import { AUTOMATION_HOUSE_MODES } from '../../nodes/nodes.constants';
import { HouseModeIsConfigSchema } from '../../nodes/nodes.schemas';
import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../canvas/automation-node-form.types';

import AutomationOptionCheckboxes from './automation-option-checkboxes.vue';
import type { IAutomationOption } from './automation-option-select.types';

defineOptions({
	name: 'AutomationHouseModeIsForm',
});

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

const form = useAutomationNodeForm(props, emit, HouseModeIsConfigSchema);

const { errorText } = form;

const modes = computed<IAutomationOption[]>((): IAutomationOption[] =>
	AUTOMATION_HOUSE_MODES.map((mode) => ({ value: mode, label: t(`automations.editor.options.houseModes.${mode}`) }))
);
</script>
