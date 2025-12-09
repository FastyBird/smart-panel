<template>
	<el-select
		:model-value="modelValue"
		:placeholder="placeholder"
		clearable
		@update:model-value="onUpdate"
	>
		<el-option
			v-for="display in displays"
			:key="display.id"
			:label="display.name || display.macAddress"
			:value="display.id"
		/>
	</el-select>
</template>

<script setup lang="ts">
import { ElOption, ElSelect } from 'element-plus';

import { useDisplays } from '../composables/composables';
import type { IDisplay } from '../store/displays.store.types';

defineOptions({
	name: 'DisplaySelect',
});

withDefaults(
	defineProps<{
		modelValue?: IDisplay['id'] | null;
		placeholder?: string;
	}>(),
	{
		modelValue: null,
		placeholder: 'Select display',
	}
);

const emit = defineEmits<{
	(e: 'update:modelValue', value: IDisplay['id'] | null): void;
}>();

const { displays } = useDisplays();

const onUpdate = (value: IDisplay['id'] | null): void => {
	emit('update:modelValue', value);
};
</script>
