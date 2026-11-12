<template>
	<el-form
		label-position="top"
		class="automation-delay-form"
		data-test-id="automation-delay-form"
		@submit.prevent
	>
		<el-form-item
			:label="t('automations.editor.fields.delay.title')"
			:error="errorText('seconds')"
			required
			data-test-field="seconds"
		>
			<automation-duration-input
				:model-value="typeof props.config.seconds === 'number' ? props.config.seconds : undefined"
				:max="AUTOMATION_DELAY_MAX_SECONDS"
				:disabled="props.disabled"
				name="seconds"
				@update:model-value="(seconds: number | undefined): void => form.update({ seconds }, 'seconds')"
			/>
			<el-text
				tag="div"
				size="small"
				type="info"
				class="leading-4! mt-1"
			>
				{{ t('automations.editor.fields.delay.hint') }}
			</el-text>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
/*
 * "Delay": how long to wait, up to an hour in the first version (ADR 0003, decision 7).
 */
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElText } from 'element-plus';

import { useAutomationNodeForm } from '../../composables/useAutomationNodeForm';
import { AUTOMATION_DELAY_MAX_SECONDS } from '../../nodes/nodes.constants';
import { DelayConfigSchema } from '../../nodes/nodes.schemas';
import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../canvas/automation-node-form.types';

import AutomationDurationInput from './automation-duration-input.vue';

defineOptions({
	name: 'AutomationDelayForm',
});

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

const form = useAutomationNodeForm(props, emit, DelayConfigSchema);

const { errorText } = form;
</script>
