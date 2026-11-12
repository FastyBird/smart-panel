<template>
	<el-form
		label-position="top"
		class="automation-time-of-day-form"
		data-test-id="automation-time-of-day-form"
		@submit.prevent
	>
		<el-form-item
			:label="t('automations.editor.fields.time.at')"
			:error="errorText('time')"
			required
			data-test-field="time"
		>
			<el-time-picker
				:model-value="text(props.config.time)"
				:disabled="props.disabled"
				:placeholder="t('automations.editor.fields.time.placeholder')"
				format="HH:mm"
				value-format="HH:mm"
				name="time"
				class="w-full!"
				@update:model-value="(value: string | null): void => form.update({ time: value }, 'time')"
			/>
			<el-text
				tag="div"
				size="small"
				type="info"
				class="leading-4! mt-1"
			>
				{{ t('automations.editor.fields.time.houseClock') }}
			</el-text>
		</el-form-item>

		<el-form-item
			:label="t('automations.editor.fields.weekdays.title')"
			:error="errorText('weekdays')"
			data-test-field="weekdays"
		>
			<automation-weekdays-input
				:model-value="props.config.weekdays"
				:disabled="props.disabled"
				@update:model-value="(weekdays: number[] | undefined): void => form.update({ weekdays }, 'weekdays')"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
/*
 * "Time of day": a time on the 24-hour house clock, on every day or on chosen weekdays.
 */
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElText, ElTimePicker } from 'element-plus';

import { useAutomationNodeForm } from '../../composables/useAutomationNodeForm';
import { TimeOfDayConfigSchema } from '../../nodes/nodes.schemas';
import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../canvas/automation-node-form.types';

import AutomationWeekdaysInput from './automation-weekdays-input.vue';

defineOptions({
	name: 'AutomationTimeOfDayForm',
});

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

const form = useAutomationNodeForm(props, emit, TimeOfDayConfigSchema);

const { errorText } = form;

const text = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined);
</script>
