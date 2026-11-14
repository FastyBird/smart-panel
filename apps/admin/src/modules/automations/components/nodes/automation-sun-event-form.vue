<template>
	<el-form
		label-position="top"
		:disabled="props.disabled"
		class="automation-sun-event-form"
		data-test-id="automation-sun-event-form"
		@submit.prevent
	>
		<el-form-item
			:label="t('automations.editor.fields.sunEvent.event')"
			:error="errorText('event')"
			required
			data-test-field="event"
		>
			<automation-option-select
				:model-value="props.config.event"
				:options="events"
				:placeholder="t('automations.editor.fields.sunEvent.placeholder')"
				:disabled="props.disabled"
				name="event"
				@update:model-value="(event: string | undefined): void => form.update({ event }, 'event')"
			/>
		</el-form-item>

		<el-form-item
			:label="t('automations.editor.fields.sunEvent.offset.title')"
			:error="errorText('offset_minutes')"
			data-test-field="offset_minutes"
		>
			<el-input-number
				:model-value="offset"
				:min="bounds.min"
				:max="bounds.max"
				:step="5"
				:precision="bounds.precision"
				:disabled="props.disabled"
				:value-on-clear="null"
				name="offset_minutes"
				controls-position="right"
				class="w-full!"
				@update:model-value="onOffset"
			/>
			<el-text
				tag="div"
				size="small"
				type="info"
				class="leading-4! mt-1"
			>
				{{ t('automations.editor.fields.sunEvent.offset.hint', { hours: AUTOMATION_SUN_OFFSET_MAX_MINUTES / 60 }) }}
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
 * "Sunrise or sunset": the event, and how many minutes before (negative) or after (positive) it to start,
 * at most six hours either way. The sun times are computed from the house location.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInputNumber, ElText } from 'element-plus';

import { useAutomationNodeForm } from '../../composables/useAutomationNodeForm';
import { AUTOMATION_SUN_EVENTS, AUTOMATION_SUN_OFFSET_MAX_MINUTES } from '../../nodes/nodes.constants';
import { SunEventConfigSchema } from '../../nodes/nodes.schemas';
import { type IAutomationNumberBounds, numberInputBounds } from '../../nodes/nodes.values';
import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../canvas/automation-node-form.types';

import type { IAutomationOption } from './automation-option-select.types';
import AutomationOptionSelect from './automation-option-select.vue';

defineOptions({
	name: 'AutomationSunEventForm',
});

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

const form = useAutomationNodeForm(props, emit, SunEventConfigSchema);

const { errorText } = form;

const events = computed<IAutomationOption[]>((): IAutomationOption[] =>
	AUTOMATION_SUN_EVENTS.map((event) => ({ value: event, label: t(`automations.editor.options.sunEvents.${event}`) }))
);

const offset = computed<number | undefined>((): number | undefined =>
	typeof props.config.offset_minutes === 'number' ? props.config.offset_minutes : undefined
);

// An offset saved out of range is shown as it is, with the error beside it, until it is edited
const bounds = computed<IAutomationNumberBounds>(
	(): IAutomationNumberBounds =>
		numberInputBounds(offset.value, { min: -AUTOMATION_SUN_OFFSET_MAX_MINUTES, max: AUTOMATION_SUN_OFFSET_MAX_MINUTES, precision: 0 })
);

// No offset is the event itself, so a cleared offset and zero are both left out
const onOffset = (value: number | null | undefined): void => {
	form.update({ offset_minutes: typeof value === 'number' && value !== 0 ? value : undefined }, 'offset_minutes');
};
</script>
