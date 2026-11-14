<template>
	<el-form
		label-position="top"
		:disabled="props.disabled"
		class="automation-wait-until-form"
		data-test-id="automation-wait-until-form"
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
			:label="t('automations.editor.fields.waitUntil.mode')"
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
					:label="t(`automations.editor.fields.waitUntil.modes.${option}`)"
					:value="option"
				/>
			</el-select>
		</el-form-item>

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
				:numeric="mode !== 'to'"
				@update:model-value="(value: AutomationPropertyValue | undefined): void => form.update({ [mode]: value }, mode)"
			/>
		</el-form-item>

		<el-form-item
			:label="t('automations.editor.fields.waitUntil.timeout.title')"
			:error="errorText('timeout_seconds')"
			required
			data-test-field="timeout_seconds"
		>
			<automation-duration-input
				:model-value="typeof props.config.timeout_seconds === 'number' ? props.config.timeout_seconds : undefined"
				:max="AUTOMATION_WAIT_MAX_SECONDS"
				:disabled="props.disabled"
				name="timeout_seconds"
				@update:model-value="(seconds: number | undefined): void => form.update({ timeout_seconds: seconds }, 'timeout_seconds')"
			/>
			<el-text
				tag="div"
				size="small"
				type="info"
				class="leading-4! mt-1"
			>
				{{ t('automations.editor.fields.waitUntil.timeout.hint') }}
			</el-text>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
/*
 * "Wait until": the property waited on, the state it has to reach - a value, or above or below a
 * threshold - and how long to wait at most before continuing on "timeout". A state that already holds
 * continues at once. A threshold is offered only for a property that holds a number.
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElOption, ElSelect, ElText } from 'element-plus';

import { useAutomationNodeForm } from '../../composables/useAutomationNodeForm';
import { useAutomationNodeLookups } from '../../composables/useAutomationNodeLookups';
import { AUTOMATION_WAIT_MAX_SECONDS } from '../../nodes/nodes.constants';
import { WaitUntilConfigSchema } from '../../nodes/nodes.schemas';
import type { AutomationLookupProperty } from '../../nodes/nodes.summaries';
import { type AutomationPropertyValue, isOperandGiven, isPropertyValue, propertyValueKind, valueFitsProperty } from '../../nodes/nodes.values';
import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../canvas/automation-node-form.types';

import AutomationDurationInput from './automation-duration-input.vue';
import AutomationNodeTarget from './automation-node-target.vue';
import AutomationPropertyValueInput from './automation-property-value-input.vue';

defineOptions({
	name: 'AutomationWaitUntilForm',
});

type WaitMode = 'to' | 'above' | 'below';

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

const form = useAutomationNodeForm(props, emit, WaitUntilConfigSchema);

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

const numeric = computed<boolean>((): boolean => ['number', 'unknown'].includes(propertyValueKind(property.value)));

const modes = computed<WaitMode[]>((): WaitMode[] => (numeric.value ? ['to', 'above', 'below'] : ['to']));

const modeOf = (config: Record<string, unknown>): WaitMode => {
	if (isOperandGiven(config.above)) return 'above';
	if (isOperandGiven(config.below)) return 'below';

	return 'to';
};

// Kept here as well as read from the configuration: a threshold chosen with no value entered yet looks
// like "becomes" in the configuration. A configuration changed from outside (an undo) is read again.
const mode = ref<WaitMode>(modeOf(props.config));

watch(
	(): Record<string, unknown> => props.config,
	(config: Record<string, unknown>): void => {
		const read = modeOf(config);

		if (read !== 'to' || isOperandGiven(config.to)) {
			mode.value = read;
		}
	}
);

/*
 * A threshold chosen with no value entered yet is not in the configuration: saved as it is, the card
 * would read back as "becomes". Like the value trigger, it keeps the editor from saving until the
 * threshold is entered or another state is chosen.
 */
const incomplete = computed<boolean>((): boolean => mode.value !== 'to' && !isOperandGiven(props.config[mode.value]));

watch(
	incomplete,
	(value: boolean): void => {
		emit('update:invalid', value);
	},
	{ immediate: true }
);

const onMode = (next: WaitMode): void => {
	const previous = mode.value;

	mode.value = next;

	const patch: Record<string, unknown> = { to: undefined, above: undefined, below: undefined };

	// Rising above becomes falling below the same threshold
	if (previous !== 'to' && next !== 'to') {
		patch[next] = props.config[previous];
	}

	form.update(patch, 'mode');
};

const onTarget = (patch: Record<string, unknown>, field: string): void => {
	const next = typeof patch.property_id === 'string' ? lookups.property(patch.property_id) : null;

	// What was entered for the old property stays only where it still fits the new one
	const operands: Record<string, unknown> = {};

	if (typeof props.config.to !== 'undefined' && !valueFitsProperty(props.config.to, next)) operands.to = undefined;

	const kind = propertyValueKind(next);

	if (kind !== 'number' && kind !== 'unknown' && mode.value !== 'to') {
		Object.assign(operands, { above: undefined, below: undefined });

		mode.value = 'to';
	}

	form.update({ ...patch, ...operands }, field);
};
</script>
