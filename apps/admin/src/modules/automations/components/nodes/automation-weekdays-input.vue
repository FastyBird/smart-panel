<template>
	<div class="w-full">
		<el-checkbox-group
			:model-value="selected"
			:disabled="props.disabled"
			size="small"
			:aria-label="t('automations.editor.fields.weekdays.title')"
			data-test-id="weekdays"
			@update:model-value="onChange"
		>
			<el-checkbox-button
				v-for="day in AUTOMATION_WEEKDAYS_ORDER"
				:key="day"
				:value="day"
				:data-test-day="day"
			>
				{{ t(`automations.editor.weekdays.short.${day}`) }}
			</el-checkbox-button>
		</el-checkbox-group>
		<el-text
			tag="div"
			size="small"
			type="info"
			class="leading-4! mt-1"
		>
			{{ selected.length === 0 ? t('automations.editor.fields.weekdays.everyDay') : t('automations.editor.fields.weekdays.hint') }}
		</el-text>
	</div>
</template>

<script setup lang="ts">
/*
 * The weekdays a time card holds for; none picked is every day, and the key is then left out.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCheckboxButton, ElCheckboxGroup, ElText } from 'element-plus';

import { AUTOMATION_WEEKDAYS_ORDER } from '../../nodes/nodes.constants';

import type { IAutomationWeekdaysInputProps } from './automation-weekdays-input.types';

defineOptions({
	name: 'AutomationWeekdaysInput',
});

const props = withDefaults(defineProps<IAutomationWeekdaysInputProps>(), {
	disabled: false,
});

const emit = defineEmits<{
	(e: 'update:modelValue', weekdays: number[] | undefined): void;
}>();

const { t } = useI18n();

const selected = computed<number[]>((): number[] =>
	Array.isArray(props.modelValue) ? props.modelValue.filter((day): day is number => typeof day === 'number') : []
);

const onChange = (value: (string | number | boolean)[]): void => {
	const days = [...new Set(value.filter((day): day is number => typeof day === 'number'))].sort((a, b) => a - b);

	emit('update:modelValue', days.length > 0 ? days : undefined);
};
</script>
