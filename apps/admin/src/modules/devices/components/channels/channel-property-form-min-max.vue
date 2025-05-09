<template>
	<div class="flex flex-row gap-4">
		<el-form-item
			:label="t('devicesModule.fields.channelsProperties.format.title.min')"
			:prop="['format']"
			class="grow-1"
		>
			<el-input-number
				v-model="minValue"
				:placeholder="t('devicesModule.fields.channelsProperties.format.placeholder.min')"
				:min="typeof value[0] === 'number' ? value[0] : undefined"
				:max="maxValue"
				:disabled="props.disabled"
				name="minValue"
				class="w-full!"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesModule.fields.channelsProperties.format.title.max')"
			:prop="['format']"
			class="grow-1"
		>
			<el-input-number
				v-model="maxValue"
				:placeholder="t('devicesModule.fields.channelsProperties.format.placeholder.max')"
				:min="minValue"
				:max="typeof value[1] === 'number' ? value[1] : undefined"
				:disabled="props.disabled"
				name="maxValue"
				class="w-full!"
			/>
		</el-form-item>
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElFormItem, ElInputNumber } from 'element-plus';

import { useChannelPropertyFormSpec } from '../../composables/useChannelPropertyFormSpec';

import type { IChannelPropertyFormMinMaxProps } from './channel-property-form-min-max.types';

defineOptions({
	name: 'ChannelPropertyFormMinMax',
});

const props = withDefaults(defineProps<IChannelPropertyFormMinMaxProps>(), {
	disabled: false,
});

const emit = defineEmits<{
	(e: 'update:minValue', value: number | undefined): void;
	(e: 'update:maxValue', value: number | undefined): void;
}>();

const { t } = useI18n();

const { value: rawValue } = useChannelPropertyFormSpec<number[]>({
	channel: props.channelCategory,
	property: props.propertyCategory,
	field: 'format',
});

const value: [number | undefined, number | undefined] = [rawValue?.[0] ?? undefined, rawValue?.[1] ?? undefined];

const minValue = ref<number | undefined>(props.minValue ?? value[0] ?? undefined);
const maxValue = ref<number | undefined>(props.maxValue ?? value[1] ?? undefined);

watch(
	(): number | undefined => minValue.value,
	(val: number | undefined) => {
		emit('update:minValue', val);
	},
	{
		immediate: true,
	}
);

watch(
	(): number | undefined => maxValue.value,
	(val: number | undefined) => {
		emit('update:maxValue', val);
	},
	{
		immediate: true,
	}
);
</script>
