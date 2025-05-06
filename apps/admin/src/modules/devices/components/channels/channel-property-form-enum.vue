<template>
	<el-form-item
		:label="t('devicesModule.fields.channelsProperties.format.title.enum')"
		:prop="['format']"
	>
		<el-select
			v-if="predefined"
			v-model="format"
			:placeholder="t('devicesModule.fields.channelsProperties.format.placeholder.enum')"
			:disabled="props.disabled"
			name="format"
			multiple
		>
			<el-option
				v-for="val in value"
				:key="val"
				:value="val"
				:label="val"
			/>
		</el-select>

		<el-input-tag
			v-else
			v-model="format"
			:placeholder="t('devicesModule.fields.channelsProperties.format.placeholder.enum')"
			:disabled="props.disabled"
			name="format"
		/>
	</el-form-item>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElFormItem, ElInputTag, ElOption, ElSelect } from 'element-plus';

import { useChannelPropertyFormSpec } from '../../composables/useChannelPropertyFormSpec';

import type { IChannelPropertyFormFormatProps } from './channel-property-form-enum.types';

defineOptions({
	name: 'ChannelPropertyFormEnum',
});

const props = withDefaults(defineProps<IChannelPropertyFormFormatProps>(), {
	disabled: false,
});

const emit = defineEmits<{
	(e: 'update:modelValue', value: string[]): void;
}>();

const { t } = useI18n();

const { value } = useChannelPropertyFormSpec<string[]>({
	channel: props.channelCategory,
	property: props.propertyCategory,
	field: 'format',
});

const format = ref<string[]>(value ?? []);

const predefined = ref<boolean>(typeof value !== 'undefined');

watch(
	(): string[] => format.value,
	(val: string[]) => {
		emit('update:modelValue', val);
	},
	{
		immediate: true,
	}
);
</script>
