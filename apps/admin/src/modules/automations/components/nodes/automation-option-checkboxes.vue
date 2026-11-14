<template>
	<el-checkbox-group
		:model-value="selected"
		:disabled="props.disabled"
		:aria-label="props.label"
		class="flex flex-col items-start"
		data-test-id="option-checkboxes"
		@update:model-value="onChange"
	>
		<el-checkbox
			v-for="option in shown"
			:key="option.value"
			:value="option.value"
			:label="option.label"
			:data-test-option="option.value"
		/>
	</el-checkbox-group>
</template>

<script setup lang="ts">
/*
 * Several of the values a card takes, as an "is one of" condition does. They are kept in the order of the
 * options, unknown stored values last; none picked leaves the key out, so the card reads as not configured yet.
 */
import { computed } from 'vue';

import { ElCheckbox, ElCheckboxGroup } from 'element-plus';

import type { IAutomationOption, IAutomationOptionCheckboxesProps } from './automation-option-select.types';

defineOptions({
	name: 'AutomationOptionCheckboxes',
});

const props = withDefaults(defineProps<IAutomationOptionCheckboxesProps>(), {
	label: undefined,
	disabled: false,
});

const emit = defineEmits<{
	(e: 'update:modelValue', value: string[] | undefined): void;
}>();

const selected = computed<string[]>((): string[] =>
	Array.isArray(props.modelValue) ? props.modelValue.filter((value): value is string => typeof value === 'string') : []
);

// A stored value this admin does not know (a mode of a newer backend) is listed by its value, and kept
// until it is unchecked, as `AutomationOptionSelect` keeps one
const shown = computed<IAutomationOption[]>((): IAutomationOption[] => [
	...props.options,
	...selected.value
		.filter((value) => value !== '' && !props.options.some((option) => option.value === value))
		.map((value) => ({ value, label: value })),
]);

const onChange = (value: (string | number | boolean)[]): void => {
	const picked = shown.value.map((option) => option.value).filter((option) => value.includes(option));

	emit('update:modelValue', picked.length > 0 ? picked : undefined);
};
</script>
