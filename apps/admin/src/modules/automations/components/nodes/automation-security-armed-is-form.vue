<template>
	<el-form
		label-position="top"
		:disabled="props.disabled"
		class="automation-security-armed-is-form"
		data-test-id="automation-security-armed-is-form"
		@submit.prevent
	>
		<el-form-item
			:label="t('automations.editor.fields.security.states')"
			:error="errorText('states')"
			required
			data-test-field="states"
		>
			<automation-option-checkboxes
				:model-value="props.config.states"
				:options="states"
				:label="t('automations.editor.fields.security.states')"
				:disabled="props.disabled"
				@update:model-value="(picked: string[] | undefined): void => form.update({ states: picked }, 'states')"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
/*
 * "Alarm is armed": the armed states that answer "yes"; a state that is not known answers "no".
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem } from 'element-plus';

import { useAutomationNodeForm } from '../../composables/useAutomationNodeForm';
import { AUTOMATION_ARMED_STATES } from '../../nodes/nodes.constants';
import { SecurityArmedIsConfigSchema } from '../../nodes/nodes.schemas';
import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../canvas/automation-node-form.types';

import AutomationOptionCheckboxes from './automation-option-checkboxes.vue';
import type { IAutomationOption } from './automation-option-select.types';

defineOptions({
	name: 'AutomationSecurityArmedIsForm',
});

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

const form = useAutomationNodeForm(props, emit, SecurityArmedIsConfigSchema);

const { errorText } = form;

const states = computed<IAutomationOption[]>((): IAutomationOption[] =>
	AUTOMATION_ARMED_STATES.map((state) => ({ value: state, label: t(`automations.editor.options.armedStates.${state}`) }))
);
</script>
