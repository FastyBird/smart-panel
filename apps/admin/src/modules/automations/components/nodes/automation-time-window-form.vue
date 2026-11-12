<template>
	<el-form
		label-position="top"
		:disabled="props.disabled"
		class="automation-time-window-form"
		data-test-id="automation-time-window-form"
		@submit.prevent
	>
		<el-form-item
			v-for="key in BOUNDS"
			:key="key"
			:label="t(`automations.editor.fields.window.${key}`)"
			:error="errorText(key)"
			required
			:data-test-field="key"
		>
			<el-time-picker
				:model-value="text(props.config[key])"
				:disabled="props.disabled"
				:placeholder="t('automations.editor.fields.time.placeholder')"
				format="HH:mm"
				value-format="HH:mm"
				:name="key"
				class="w-full!"
				@update:model-value="(value: string | null): void => form.update({ [key]: value }, key)"
			/>
		</el-form-item>

		<el-text
			tag="p"
			size="small"
			type="info"
			class="mt-0! mb-3! leading-4!"
			data-test-id="window-hint"
		>
			{{ overnight ? t('automations.editor.fields.window.overnight') : t('automations.editor.fields.window.hint') }}
		</el-text>

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
 * "Time is between": a window `[from, to)` on the house clock. A window whose end is earlier than its
 * start crosses midnight, and its weekdays name the day it started (ADR 0003, decision 6).
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElText, ElTimePicker } from 'element-plus';

import { useAutomationNodeForm } from '../../composables/useAutomationNodeForm';
import { TimeWindowConfigSchema } from '../../nodes/nodes.schemas';
import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../canvas/automation-node-form.types';

import AutomationWeekdaysInput from './automation-weekdays-input.vue';

defineOptions({
	name: 'AutomationTimeWindowForm',
});

const BOUNDS = ['from', 'to'] as const;

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

const form = useAutomationNodeForm(props, emit, TimeWindowConfigSchema);

const { errorText } = form;

const text = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined);

const overnight = computed<boolean>((): boolean => {
	const from = text(props.config.from);
	const to = text(props.config.to);

	return typeof from === 'string' && typeof to === 'string' && to < from;
});
</script>
