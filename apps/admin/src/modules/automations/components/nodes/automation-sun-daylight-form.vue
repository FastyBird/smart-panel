<template>
	<el-form
		label-position="top"
		:disabled="props.disabled"
		class="automation-sun-daylight-form"
		data-test-id="automation-sun-daylight-form"
		@submit.prevent
	>
		<el-form-item
			:label="t('automations.editor.fields.daylight.title')"
			:error="errorText('state')"
			required
			data-test-field="state"
		>
			<el-radio-group
				:model-value="typeof props.config.state === 'string' ? props.config.state : undefined"
				:disabled="props.disabled"
				name="state"
				@update:model-value="(state: string | number | boolean | undefined): void => form.update({ state }, 'state')"
			>
				<el-radio-button
					v-for="state in AUTOMATION_DAYLIGHT_STATES"
					:key="state"
					:value="state"
					:data-test-option="state"
				>
					{{ t(`automations.editor.options.daylight.${state}`) }}
				</el-radio-button>
			</el-radio-group>
			<el-text
				tag="div"
				size="small"
				type="info"
				class="leading-4! mt-1"
			>
				{{ t('automations.editor.fields.daylight.hint') }}
			</el-text>
		</el-form-item>

		<el-text
			tag="p"
			size="small"
			type="info"
			class="m-0! leading-4!"
		>
			{{ t('automations.editor.fields.sun.location') }}
		</el-text>
	</el-form>
</template>

<script setup lang="ts">
/*
 * "Day or night": whether to continue on "yes" by day - the sun is up at the house location - or at night.
 */
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElRadioButton, ElRadioGroup, ElText } from 'element-plus';

import { useAutomationNodeForm } from '../../composables/useAutomationNodeForm';
import { AUTOMATION_DAYLIGHT_STATES } from '../../nodes/nodes.constants';
import { SunDaylightConfigSchema } from '../../nodes/nodes.schemas';
import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../canvas/automation-node-form.types';

defineOptions({
	name: 'AutomationSunDaylightForm',
});

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

const form = useAutomationNodeForm(props, emit, SunDaylightConfigSchema);

const { errorText } = form;
</script>
