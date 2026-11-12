<template>
	<el-form
		label-position="top"
		:disabled="props.disabled"
		class="automation-device-property-changed-form"
		data-test-id="automation-device-property-changed-form"
		@submit.prevent
	>
		<automation-node-target
			:device-id="text(props.config.device_id)"
			:channel-id="text(props.config.channel_id)"
			:property-id="text(props.config.property_id)"
			access="readable"
			:errors="[...errorsAt('device_id'), ...errorsAt('channel_id'), ...errorsAt('property_id')]"
			@change="onTarget"
		/>

		<el-form-item
			:label="t('automations.editor.fields.changed.mode')"
			data-test-field="mode"
		>
			<el-select
				:model-value="mode"
				:disabled="props.disabled"
				name="mode"
				@update:model-value="onMode"
			>
				<el-option
					v-for="option in modes"
					:key="option"
					:label="t(`automations.editor.fields.changed.modes.${option}`)"
					:value="option"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			v-if="mode === 'from' || mode === 'fromTo'"
			:label="t('automations.editor.fields.changed.from')"
			:error="errorText('from')"
			required
			data-test-field="from"
		>
			<automation-property-value-input
				:model-value="valueOf('from')"
				:property="property"
				:disabled="props.disabled"
				name="from"
				@update:model-value="(value: AutomationPropertyValue | undefined): void => form.update({ from: value }, 'from')"
			/>
		</el-form-item>

		<el-form-item
			v-if="mode === 'to' || mode === 'fromTo'"
			:label="t('automations.editor.fields.changed.to')"
			:error="errorText('to')"
			required
			data-test-field="to"
		>
			<automation-property-value-input
				:model-value="valueOf('to')"
				:property="property"
				:disabled="props.disabled"
				name="to"
				@update:model-value="(value: AutomationPropertyValue | undefined): void => form.update({ to: value }, 'to')"
			/>
		</el-form-item>

		<template v-if="mode === 'above' || mode === 'below'">
			<el-form-item
				:label="t(`automations.editor.fields.changed.${mode}`)"
				:error="errorText(mode)"
				required
				:data-test-field="mode"
			>
				<automation-property-value-input
					:model-value="valueOf(mode)"
					:property="property"
					:disabled="props.disabled"
					:name="mode"
					numeric
					@update:model-value="(value: AutomationPropertyValue | undefined): void => form.update({ [mode]: value }, mode)"
				/>
			</el-form-item>

			<el-form-item
				:label="t('automations.editor.fields.changed.hysteresis.title')"
				:error="errorText('hysteresis')"
				data-test-field="hysteresis"
			>
				<el-input-number
					:model-value="hysteresis"
					:min="hysteresisBounds.min"
					:disabled="props.disabled"
					:value-on-clear="null"
					name="hysteresis"
					controls-position="right"
					class="w-full!"
					@update:model-value="(value: number | null | undefined): void => form.update({ hysteresis: value }, 'hysteresis')"
				/>
				<el-text
					tag="div"
					size="small"
					type="info"
					class="leading-4! mt-1"
				>
					{{ t('automations.editor.fields.changed.hysteresis.hint') }}
				</el-text>
			</el-form-item>
		</template>

		<el-form-item
			v-if="holdsState"
			:error="errorText('for_seconds')"
			data-test-field="for_seconds"
		>
			<el-checkbox
				:model-value="typeof props.config.for_seconds === 'number'"
				:disabled="props.disabled"
				:label="t('automations.editor.fields.changed.for.title')"
				name="for"
				@update:model-value="onFor"
			/>
			<automation-duration-input
				v-if="typeof forSeconds === 'number'"
				:model-value="forSeconds"
				:max="AUTOMATION_FOR_MAX_SECONDS"
				:disabled="props.disabled"
				name="for_seconds"
				@update:model-value="(seconds: number | undefined): void => form.update({ for_seconds: seconds }, 'for_seconds')"
			/>
			<el-text
				tag="div"
				size="small"
				type="info"
				class="leading-4! mt-1"
			>
				{{ t('automations.editor.fields.changed.for.hint') }}
			</el-text>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
/*
 * "Device value changes": the property watched, and how it starts - on any change, a change to or from a
 * value, or a crossing of a threshold - optionally only after the new state has held for a time. A
 * threshold is offered only for a property that holds a number (design § First node catalogue).
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCheckbox, ElForm, ElFormItem, ElInputNumber, ElOption, ElSelect, ElText } from 'element-plus';

import { useAutomationNodeForm } from '../../composables/useAutomationNodeForm';
import { useAutomationNodeLookups } from '../../composables/useAutomationNodeLookups';
import { AUTOMATION_FOR_MAX_SECONDS, type AutomationChangedMode } from '../../nodes/nodes.constants';
import { DevicePropertyChangedConfigSchema } from '../../nodes/nodes.schemas';
import type { AutomationLookupProperty } from '../../nodes/nodes.summaries';
import {
	type AutomationPropertyValue,
	type IAutomationNumberBounds,
	changedModeOf,
	changedModesFor,
	isOperandGiven,
	isPropertyValue,
	numberInputBounds,
	propertyValueKind,
	valueFitsProperty,
} from '../../nodes/nodes.values';
import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../canvas/automation-node-form.types';

import AutomationDurationInput from './automation-duration-input.vue';
import AutomationNodeTarget from './automation-node-target.vue';
import AutomationPropertyValueInput from './automation-property-value-input.vue';

defineOptions({
	name: 'AutomationDevicePropertyChangedForm',
});

// The fields that say how the trigger starts; the others name the property
type OperandKey = 'to' | 'from' | 'above' | 'below' | 'hysteresis' | 'for_seconds';

const OPERANDS: Record<AutomationChangedMode, OperandKey[]> = {
	any: [],
	to: ['to', 'for_seconds'],
	from: ['from'],
	fromTo: ['from', 'to'],
	above: ['above', 'hysteresis', 'for_seconds'],
	below: ['below', 'hysteresis', 'for_seconds'],
};

// The values a way to start can not do without
const REQUIRED: Record<AutomationChangedMode, OperandKey[]> = {
	any: [],
	to: ['to'],
	from: ['from'],
	fromTo: ['from', 'to'],
	above: ['above'],
	below: ['below'],
};

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

// The contents of the configuration this form last saw or emitted (see `mode` below)
let seen: string = JSON.stringify(props.config);

const onConfig = (event: 'update:config', config: Record<string, unknown>, field: string): void => {
	seen = JSON.stringify(config);

	emit(event, config, field);
};

const form = useAutomationNodeForm(props, onConfig, DevicePropertyChangedConfigSchema);

const { errorsAt, errorText } = form;

const lookups = useAutomationNodeLookups();

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

const valueOf = (key: string): AutomationPropertyValue | undefined => {
	const value = props.config[key];

	return isPropertyValue(value) ? value : undefined;
};

const property = computed<AutomationLookupProperty | null>((): AutomationLookupProperty | null => {
	const id = text(props.config.property_id);

	return id === null ? null : lookups.property(id);
});

const modes = computed<AutomationChangedMode[]>((): AutomationChangedMode[] => changedModesFor(propertyValueKind(property.value)));

/*
 * The way to start is kept here as well as read from the configuration: "becomes" chosen with no value
 * entered yet looks like "any change" in the configuration, and "changes from ... to" with only one of its
 * values entered looks like the way to start that takes that value alone. So an edit made here keeps the
 * way chosen, while a configuration changed from outside (an undo, a reload) is read again. The editor
 * reads the whole graph again with every edit, a card moved included, so a configuration handed over with
 * the contents it had is no change.
 */
const mode = ref<AutomationChangedMode>(changedModeOf(props.config));

watch(
	(): Record<string, unknown> => props.config,
	(config: Record<string, unknown>): void => {
		const contents = JSON.stringify(config);

		if (contents !== seen) {
			mode.value = changedModeOf(config);
		}

		seen = contents;
	}
);

/*
 * The way chosen lacks a value it needs: saved as it is, the trigger would start on more than was chosen.
 * Like text that does not parse yet, it keeps the editor from saving until it is entered or given up.
 */
const incomplete = computed<boolean>((): boolean => REQUIRED[mode.value].some((key) => !isOperandGiven(props.config[key])));

watch(
	incomplete,
	(value: boolean): void => {
		emit('update:invalid', value);
	},
	{ immediate: true }
);

const forSeconds = computed<number | undefined>((): number | undefined =>
	typeof props.config.for_seconds === 'number' ? props.config.for_seconds : undefined
);

const hysteresis = computed<number | undefined>((): number | undefined =>
	typeof props.config.hysteresis === 'number' ? props.config.hysteresis : undefined
);

// A hysteresis saved below zero is shown as it is, with the error beside it, until it is edited
const hysteresisBounds = computed<IAutomationNumberBounds>((): IAutomationNumberBounds => numberInputBounds(hysteresis.value, { min: 0 }));

const holdsState = computed<boolean>((): boolean => OPERANDS[mode.value].includes('for_seconds'));

const onMode = (next: AutomationChangedMode): void => {
	const previous = mode.value;

	mode.value = next;

	const patch: Record<string, unknown> = {};

	for (const key of ['to', 'from', 'above', 'below', 'hysteresis', 'for_seconds'] as OperandKey[]) {
		patch[key] = OPERANDS[next].includes(key) ? props.config[key] : undefined;
	}

	// Rising above becomes falling below the same threshold
	if ((previous === 'above' && next === 'below') || (previous === 'below' && next === 'above')) {
		patch[next] = props.config[previous];
	}

	form.update(patch, 'mode');
};

const onFor = (checked: string | number | boolean): void => {
	form.update({ for_seconds: checked === true ? 60 : undefined }, 'for_seconds');
};

const onTarget = (patch: Record<string, unknown>, field: string): void => {
	const next = typeof patch.property_id === 'string' ? lookups.property(patch.property_id) : null;

	// What was entered for the old property stays only where it still fits the new one
	const operands: Record<string, unknown> = {};

	for (const key of ['to', 'from'] as const) {
		if (typeof props.config[key] !== 'undefined' && !valueFitsProperty(props.config[key], next)) operands[key] = undefined;
	}

	const kind = propertyValueKind(next);

	if (kind !== 'number' && kind !== 'unknown' && (mode.value === 'above' || mode.value === 'below')) {
		Object.assign(operands, { above: undefined, below: undefined, hysteresis: undefined, for_seconds: undefined });

		mode.value = 'any';
	}

	form.update({ ...patch, ...operands }, field);
};
</script>
