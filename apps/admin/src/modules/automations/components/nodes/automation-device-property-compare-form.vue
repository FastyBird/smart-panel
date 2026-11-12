<template>
	<el-form
		label-position="top"
		class="automation-device-property-compare-form"
		data-test-id="automation-device-property-compare-form"
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
			:label="t('automations.editor.fields.compare.operator')"
			:error="errorText('operator')"
			required
			data-test-field="operator"
		>
			<el-select
				:model-value="operator"
				:disabled="props.disabled"
				:placeholder="t('automations.editor.form.notSet')"
				name="operator"
				@update:model-value="onOperator"
			>
				<el-option
					v-for="option in operators"
					:key="option"
					:label="t(`automations.editor.fields.compare.operators.${option}`)"
					:value="option"
				/>
			</el-select>
		</el-form-item>

		<template v-if="operator === 'between'">
			<el-form-item
				v-for="key in RANGE_KEYS"
				:key="key"
				:label="t(`automations.editor.fields.compare.${key}`)"
				:error="errorText(key)"
				required
				:data-test-field="key"
			>
				<automation-property-value-input
					:model-value="numberOf(key)"
					:property="property"
					:disabled="props.disabled"
					:name="key"
					numeric
					@update:model-value="(value: AutomationPropertyValue | undefined): void => form.update({ [key]: value }, key)"
				/>
			</el-form-item>
		</template>

		<el-form-item
			v-else-if="operator === 'in'"
			:label="t('automations.editor.fields.compare.values.title')"
			:error="errorText('values')"
			required
			data-test-field="values"
		>
			<el-select
				:model-value="listValue"
				:disabled="props.disabled"
				:placeholder="t('automations.editor.fields.compare.values.placeholder')"
				:filterable="enumValues.length === 0"
				:allow-create="enumValues.length === 0"
				:default-first-option="enumValues.length === 0"
				:reserve-keyword="false"
				name="values"
				multiple
				@update:model-value="onValues"
			>
				<el-option
					v-for="option in enumValues.length > 0 ? enumValues : listValue"
					:key="String(option)"
					:label="String(option)"
					:value="option"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			v-else-if="operator !== null"
			:label="t('automations.editor.fields.compare.value')"
			:error="errorText('value')"
			required
			data-test-field="value"
		>
			<automation-property-value-input
				:model-value="isPropertyValue(props.config.value) ? props.config.value : undefined"
				:property="property"
				:disabled="props.disabled"
				:numeric="ORDER_OPERATORS.includes(operator)"
				name="value"
				@update:model-value="(value: AutomationPropertyValue | undefined): void => form.update({ value }, 'value')"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
/*
 * "Device value is": the property read and how its value is compared. The operators offered depend on
 * what the property holds - ordering needs a number, a list makes no sense for yes/no (design § First node
 * catalogue) - and each operator takes its own operands; the backend refuses a stale one of another.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElOption, ElSelect } from 'element-plus';

import { normalizeListValue } from '../../automations.config-schema';
import { useAutomationNodeForm } from '../../composables/useAutomationNodeForm';
import { useAutomationNodeLookups } from '../../composables/useAutomationNodeLookups';
import { AUTOMATION_COMPARE_OPERATORS, type AutomationCompareOperator } from '../../nodes/nodes.constants';
import { DevicePropertyCompareConfigSchema } from '../../nodes/nodes.schemas';
import type { AutomationLookupProperty } from '../../nodes/nodes.summaries';
import {
	type AutomationPropertyValue,
	compareOperatorsFor,
	enumValuesOf,
	isPropertyValue,
	propertyValueKind,
	valueFitsProperty,
} from '../../nodes/nodes.values';
import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../canvas/automation-node-form.types';

import AutomationNodeTarget from './automation-node-target.vue';
import AutomationPropertyValueInput from './automation-property-value-input.vue';

defineOptions({
	name: 'AutomationDevicePropertyCompareForm',
});

const ORDER_OPERATORS: AutomationCompareOperator[] = ['gt', 'gte', 'lt', 'lte'];

const RANGE_KEYS = ['min', 'max'] as const;

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

const form = useAutomationNodeForm(props, emit, DevicePropertyCompareConfigSchema);

const { errorsAt, errorText } = form;

const lookups = useAutomationNodeLookups();

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

const numberOf = (key: string): number | undefined => {
	const value = props.config[key];

	return typeof value === 'number' ? value : undefined;
};

const property = computed<AutomationLookupProperty | null>((): AutomationLookupProperty | null => {
	const id = text(props.config.property_id);

	return id === null ? null : lookups.property(id);
});

const kind = computed(() => propertyValueKind(property.value));

const operators = computed<AutomationCompareOperator[]>((): AutomationCompareOperator[] =>
	compareOperatorsFor(kind.value, props.nodeType.configSchema)
);

const operator = computed<AutomationCompareOperator | null>((): AutomationCompareOperator | null => {
	const value = props.config.operator;

	return typeof value === 'string' && (AUTOMATION_COMPARE_OPERATORS as readonly string[]).includes(value)
		? (value as AutomationCompareOperator)
		: null;
});

const enumValues = computed<string[]>((): string[] => enumValuesOf(property.value));

const listValue = computed<AutomationPropertyValue[]>((): AutomationPropertyValue[] =>
	Array.isArray(props.config.values) ? props.config.values.filter(isPropertyValue) : []
);

// The operands each operator takes; switching drops the others and keeps what still applies
const operandsFor = (next: AutomationCompareOperator): Record<string, unknown> => {
	if (next === 'between') {
		return { value: undefined, values: undefined, min: props.config.min, max: props.config.max };
	}

	if (next === 'in') {
		return { value: undefined, min: undefined, max: undefined, values: props.config.values };
	}

	const value = props.config.value;

	return {
		min: undefined,
		max: undefined,
		values: undefined,
		value: ORDER_OPERATORS.includes(next) && typeof value !== 'number' ? undefined : value,
	};
};

const onOperator = (next: AutomationCompareOperator): void => {
	form.update({ operator: next, ...operandsFor(next) }, 'operator');
};

const onValues = (values: unknown[]): void => {
	const numeric = kind.value === 'number';

	form.update({ values: normalizeListValue({ numeric, integer: false }, values) }, 'values');
};

const onTarget = (patch: Record<string, unknown>, field: string): void => {
	const next = typeof patch.property_id === 'string' ? lookups.property(patch.property_id) : null;
	const nextKind = propertyValueKind(next);

	const operands: Record<string, unknown> = {};

	// An operator the new property can not be compared with is dropped together with its operands
	if (operator.value !== null && next !== null && !compareOperatorsFor(nextKind, props.nodeType.configSchema).includes(operator.value)) {
		Object.assign(operands, { operator: undefined, value: undefined, values: undefined, min: undefined, max: undefined });
	} else {
		if (typeof props.config.value !== 'undefined' && !valueFitsProperty(props.config.value, next)) operands.value = undefined;

		if (Array.isArray(props.config.values) && !props.config.values.every((value) => valueFitsProperty(value, next))) {
			operands.values = undefined;
		}
	}

	form.update({ ...patch, ...operands }, field);
};
</script>
