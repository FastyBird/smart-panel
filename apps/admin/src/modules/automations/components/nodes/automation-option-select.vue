<template>
	<el-select
		:model-value="selected"
		:disabled="props.disabled"
		:placeholder="props.placeholder"
		:name="props.name"
		data-test-id="option-select"
		@update:model-value="onChange"
	>
		<el-option
			v-if="typeof props.emptyLabel === 'string'"
			:label="props.emptyLabel"
			:value="EMPTY"
		/>
		<el-option
			v-for="option in shown"
			:key="option.value"
			:label="option.label"
			:value="option.value"
		/>
	</el-select>
</template>

<script setup lang="ts">
/*
 * One of the values a card takes - a house mode, a sun event, a state - picked by its name. With an
 * `emptyLabel`, the field may be left out: that choice comes first and leaves the key out.
 */
import { computed } from 'vue';

import { ElOption, ElSelect } from 'element-plus';

import type { IAutomationOption, IAutomationOptionSelectProps } from './automation-option-select.types';

defineOptions({
	name: 'AutomationOptionSelect',
});

const props = withDefaults(defineProps<IAutomationOptionSelectProps>(), {
	emptyLabel: undefined,
	placeholder: undefined,
	name: undefined,
	disabled: false,
});

const emit = defineEmits<{
	(e: 'update:modelValue', value: string | undefined): void;
}>();

// Not a value any card takes; stands for the key left out
const EMPTY = '\u0000';

const selected = computed<string | undefined>((): string | undefined => {
	if (typeof props.modelValue === 'string') return props.modelValue;

	return typeof props.emptyLabel === 'string' ? EMPTY : undefined;
});

// A stored value the admin does not know is listed too, by its value, so it is not shown as nothing
const shown = computed<IAutomationOption[]>((): IAutomationOption[] =>
	typeof props.modelValue === 'string' && props.modelValue !== '' && !props.options.some((option) => option.value === props.modelValue)
		? [...props.options, { value: props.modelValue, label: props.modelValue }]
		: props.options
);

const onChange = (value: string): void => {
	emit('update:modelValue', value === EMPTY || value === '' ? undefined : value);
};
</script>
