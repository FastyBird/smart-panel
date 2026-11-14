<template>
	<el-form
		label-position="top"
		:disabled="props.disabled"
		class="automation-house-mode-set-form"
		data-test-id="automation-house-mode-set-form"
		@submit.prevent
	>
		<el-form-item
			:label="t('automations.editor.fields.houseMode.mode')"
			:error="errorText('mode')"
			required
			data-test-field="mode"
		>
			<automation-option-select
				:model-value="props.config.mode"
				:options="modes"
				:placeholder="t('automations.editor.fields.houseMode.placeholder')"
				:disabled="props.disabled"
				name="mode"
				@update:model-value="(mode: string | undefined): void => form.update({ mode }, 'mode')"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
/*
 * "Set house mode": the house mode to change to, as the panel and the admin change it.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem } from 'element-plus';

import { useAutomationNodeForm } from '../../composables/useAutomationNodeForm';
import { AUTOMATION_HOUSE_MODES } from '../../nodes/nodes.constants';
import { HouseModeSetConfigSchema } from '../../nodes/nodes.schemas';
import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../canvas/automation-node-form.types';

import type { IAutomationOption } from './automation-option-select.types';
import AutomationOptionSelect from './automation-option-select.vue';

defineOptions({
	name: 'AutomationHouseModeSetForm',
});

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

const form = useAutomationNodeForm(props, emit, HouseModeSetConfigSchema);

const { errorText } = form;

const modes = computed<IAutomationOption[]>((): IAutomationOption[] =>
	AUTOMATION_HOUSE_MODES.map((mode) => ({ value: mode, label: t(`automations.editor.options.houseModes.${mode}`) }))
);
</script>
