<template>
	<div class="flex flex-row gap-2 w-full">
		<el-input-number
			:model-value="amount"
			:min="1"
			:max="Math.max(1, Math.floor(props.max / UNIT_SECONDS[unit]))"
			:precision="0"
			:name="props.name"
			:disabled="props.disabled"
			:value-on-clear="null"
			controls-position="right"
			class="grow-1"
			data-test-id="duration-amount"
			@update:model-value="onAmount"
		/>
		<el-select
			:model-value="unit"
			:disabled="props.disabled"
			:name="`${props.name}-unit`"
			:aria-label="t('automations.editor.fields.duration.unit')"
			class="w-[110px]! flex-none"
			data-test-id="duration-unit"
			@update:model-value="onUnit"
		>
			<el-option
				v-for="option in UNITS"
				:key="option"
				:label="t(`automations.editor.fields.duration.units.${option}`)"
				:value="option"
			/>
		</el-select>
	</div>
</template>

<script setup lang="ts">
/*
 * A duration in whole seconds, entered in seconds, minutes or hours. The configuration holds seconds.
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElInputNumber, ElOption, ElSelect } from 'element-plus';

import type { IAutomationDurationInputProps } from './automation-duration-input.types';

defineOptions({
	name: 'AutomationDurationInput',
});

type Unit = 'seconds' | 'minutes' | 'hours';

const UNITS: Unit[] = ['seconds', 'minutes', 'hours'];

const UNIT_SECONDS: Record<Unit, number> = { seconds: 1, minutes: 60, hours: 3600 };

const props = withDefaults(defineProps<IAutomationDurationInputProps>(), {
	name: 'duration',
	disabled: false,
});

const emit = defineEmits<{
	(e: 'update:modelValue', seconds: number | undefined): void;
}>();

const { t } = useI18n();

// The largest unit the duration is a whole number of
const unitOf = (seconds: number | undefined): Unit => {
	if (typeof seconds !== 'number' || seconds <= 0) return 'seconds';
	if (seconds % 3600 === 0) return 'hours';
	if (seconds % 60 === 0) return 'minutes';

	return 'seconds';
};

const unit = ref<Unit>(unitOf(props.modelValue));

// A duration changed from outside (undo) is shown in its own unit; one typed here keeps the unit chosen
watch(
	(): number | undefined => props.modelValue,
	(seconds: number | undefined): void => {
		if (typeof seconds === 'number' && seconds % UNIT_SECONDS[unit.value] !== 0) {
			unit.value = unitOf(seconds);
		}
	}
);

const amount = computed<number | undefined>((): number | undefined =>
	typeof props.modelValue === 'number' ? props.modelValue / UNIT_SECONDS[unit.value] : undefined
);

const onAmount = (value: number | null | undefined): void => {
	emit('update:modelValue', typeof value === 'number' ? Math.round(value * UNIT_SECONDS[unit.value]) : undefined);
};

const onUnit = (next: Unit): void => {
	const current = amount.value;

	unit.value = next;

	// The number entered stays and means the new unit: "5 minutes" becomes "5 hours", not "0.08 hours" -
	// as far as the longest duration taken, which it stops at
	if (typeof current === 'number') {
		emit('update:modelValue', Math.min(Math.round(current * UNIT_SECONDS[next]), props.max));
	}
};
</script>
