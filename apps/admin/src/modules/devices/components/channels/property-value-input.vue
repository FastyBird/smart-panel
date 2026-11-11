<template>
	<el-switch
		v-if="inputType === 'boolean'"
		v-model="booleanValue"
	/>
	<el-select
		v-else-if="inputType === 'enum' && enumValues"
		:model-value="modelValue"
		:placeholder="inputPlaceholder"
		:name="name"
		class="w-full"
		@update:model-value="onEnumUpdate"
	>
		<el-option
			v-for="item in enumOptions"
			:key="item"
			:label="item"
			:value="item"
		/>
	</el-select>
	<el-input-number
		v-else-if="inputType === 'number'"
		v-model="numberValue"
		:placeholder="inputPlaceholder"
		:name="name"
		:min="numberMin"
		:max="numberMax"
		:step="numberStep"
		class="w-full"
	/>
	<el-input
		v-else
		v-model="stringValue"
		:placeholder="inputPlaceholder"
		:name="name"
	/>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElInput, ElInputNumber, ElOption, ElSelect, ElSwitch } from 'element-plus';

import { DevicesModuleChannelPropertyDataType } from '../../../../openapi.constants';

import type { IPropertyValueInputProps, IPropertyValueInputType } from './property-value-input.types';

defineOptions({
	name: 'PropertyValueInput',
});

const props = withDefaults(defineProps<IPropertyValueInputProps>(), {
	property: undefined,
	optionFilter: undefined,
	placeholder: undefined,
	name: 'value',
});

const emit = defineEmits<{
	(e: 'update:modelValue', value: string | number | boolean): void;
}>();

const { t } = useI18n();

const NUMERIC_DATA_TYPES: DevicesModuleChannelPropertyDataType[] = [
	DevicesModuleChannelPropertyDataType.int,
	DevicesModuleChannelPropertyDataType.uint,
	DevicesModuleChannelPropertyDataType.float,
	DevicesModuleChannelPropertyDataType.char,
	DevicesModuleChannelPropertyDataType.uchar,
	DevicesModuleChannelPropertyDataType.short,
	DevicesModuleChannelPropertyDataType.ushort,
];

const inputPlaceholder = computed<string>((): string => props.placeholder ?? t('devicesModule.fields.propertyValue.placeholder'));

const inputType = computed<IPropertyValueInputType>((): IPropertyValueInputType => {
	if (!props.property) return 'string';

	const dataType = props.property.dataType;

	if (dataType === DevicesModuleChannelPropertyDataType.bool) return 'boolean';
	if (dataType === DevicesModuleChannelPropertyDataType.enum) return 'enum';
	if (NUMERIC_DATA_TYPES.includes(dataType)) return 'number';

	return 'string';
});

// The string values of the format; an enum without any is edited as plain text
const enumValues = computed<string[] | null>((): string[] | null => {
	const format = props.property?.format;

	if (!Array.isArray(format)) return null;

	const stringValues = format.filter((value): value is string => typeof value === 'string');

	return stringValues.length > 0 ? stringValues : null;
});

const enumOptions = computed<string[]>((): string[] => {
	return (enumValues.value || []).filter((value) => !props.optionFilter || props.optionFilter(value));
});

const numberMin = computed<number | undefined>((): number | undefined => {
	const format = props.property?.format;

	if (!Array.isArray(format) || format.length < 1) return undefined;

	const min = format[0];

	return typeof min === 'number' ? min : undefined;
});

const numberMax = computed<number | undefined>((): number | undefined => {
	const format = props.property?.format;

	if (!Array.isArray(format) || format.length < 2) return undefined;

	const max = format[1];

	return typeof max === 'number' ? max : undefined;
});

const numberStep = computed<number>((): number => {
	return props.property?.step ?? 1;
});

const booleanValue = computed<boolean>({
	get: (): boolean => props.modelValue === true || props.modelValue === 'true' || props.modelValue === 1,
	set: (val: boolean): void => {
		emit('update:modelValue', val);
	},
});

const numberValue = computed<number>({
	get: (): number => (typeof props.modelValue === 'number' ? props.modelValue : parseFloat(String(props.modelValue)) || 0),
	set: (val: number): void => {
		emit('update:modelValue', val);
	},
});

const stringValue = computed<string>({
	get: (): string => (props.modelValue === null || props.modelValue === undefined ? '' : String(props.modelValue)),
	set: (val: string): void => {
		emit('update:modelValue', val);
	},
});

const onEnumUpdate = (val: string): void => {
	emit('update:modelValue', val);
};
</script>
