<template>
	<el-select
		v-if="kind === 'boolean'"
		:model-value="typeof props.modelValue === 'boolean' ? props.modelValue : null"
		:placeholder="t('automations.editor.form.notSet')"
		:name="props.name"
		:disabled="props.disabled"
		class="w-full"
		data-test-id="value-boolean"
		@update:model-value="(value: boolean): void => emit('update:modelValue', value)"
	>
		<el-option
			v-for="option in booleanOptions"
			:key="String(option)"
			:label="t(option ? 'automations.editor.form.yes' : 'automations.editor.form.no')"
			:value="option"
		/>
	</el-select>

	<!-- A number shows as empty until one is entered; the shared input would show a 0 that is not set -->
	<el-input-number
		v-else-if="kind === 'number'"
		:model-value="typeof props.modelValue === 'number' ? props.modelValue : undefined"
		:min="range.min"
		:max="range.max"
		:step="props.numeric ? undefined : (props.property?.step ?? undefined)"
		:name="props.name"
		:disabled="props.disabled"
		:value-on-clear="null"
		controls-position="right"
		class="w-full!"
		data-test-id="value-number"
		@update:model-value="(value: number | null | undefined): void => emit('update:modelValue', typeof value === 'number' ? value : undefined)"
	/>

	<property-value-input
		v-else
		:model-value="props.modelValue"
		:property="props.property"
		:option-filter="isOffered"
		:placeholder="t('automations.editor.form.value')"
		:name="props.name"
		:disabled="props.disabled"
		data-test-id="value-shared"
		@update:model-value="(value: AutomationPropertyValue): void => emit('update:modelValue', value === '' ? undefined : value)"
	/>

	<el-alert
		v-if="unsafe !== null"
		:title="t(`automations.editor.safety.kinds.${unsafe}`)"
		:description="t('automations.editor.safety.notOffered')"
		type="error"
		:closable="false"
		show-icon
		class="mt-2!"
		data-test-id="value-unsafe"
	/>
</template>

<script setup lang="ts">
/*
 * The value of a device card, edited the way the property holds it. A yes/no value and a number are
 * edited here, so that a value that is not set shows as not set; an enum and a text use the shared value
 * input of the devices module.
 *
 * For a value that is written, what an automation may not do - unlock, disarm, open - is not offered: the
 * option is left out, a number stops at zero. A value that would still do it (typed as text, or saved
 * before) is named. The backend refuses it on save either way.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElInputNumber, ElOption, ElSelect } from 'element-plus';

import PropertyValueInput from '../../../devices/components/channels/property-value-input.vue';
import { type AutomationSafetyReducingKind, classifySafetyReducingWrite, isAboveZeroUnsafe } from '../../nodes/nodes.safety';
import { type AutomationPropertyValue, numberRangeOf, propertyValueKind } from '../../nodes/nodes.values';

import type { IAutomationPropertyValueInputProps } from './automation-property-value-input.types';

defineOptions({
	name: 'AutomationPropertyValueInput',
});

const props = withDefaults(defineProps<IAutomationPropertyValueInputProps>(), {
	property: null,
	safetyTarget: null,
	numeric: false,
	name: 'value',
	disabled: false,
});

const emit = defineEmits<{
	(e: 'update:modelValue', value: AutomationPropertyValue | undefined): void;
}>();

const { t } = useI18n();

const kind = computed<string>((): string => (props.numeric ? 'number' : propertyValueKind(props.property)));

const isSafe = (value: AutomationPropertyValue): boolean =>
	props.safetyTarget === null || classifySafetyReducingWrite(props.safetyTarget, value) === null;

const isOffered = (value: string): boolean => isSafe(value);

const booleanOptions = computed<boolean[]>((): boolean[] => [true, false].filter(isSafe));

const range = computed<{ min?: number; max?: number }>((): { min?: number; max?: number } => {
	const own = props.numeric ? {} : numberRangeOf(props.property);

	if (props.safetyTarget !== null && isAboveZeroUnsafe(props.safetyTarget)) {
		return { ...own, max: 0 };
	}

	return own;
});

const unsafe = computed<AutomationSafetyReducingKind | null>((): AutomationSafetyReducingKind | null =>
	props.safetyTarget === null || typeof props.modelValue === 'undefined' ? null : classifySafetyReducingWrite(props.safetyTarget, props.modelValue)
);
</script>
