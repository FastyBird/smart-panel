<template>
	<el-form-item
		:label="t('devicesModule.fields.channelsProperties.step.title')"
		:prop="['step']"
		:class="[{ 'hidden!': hidden }]"
	>
		<el-input
			v-model="step"
			:placeholder="t('devicesModule.fields.channelsProperties.step.placeholder')"
			:disabled="props.disabled"
			name="step"
		/>
	</el-form-item>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElFormItem, ElInput } from 'element-plus';

import { useChannelPropertyFormSpec } from '../../composables/useChannelPropertyFormSpec';

import type { IChannelPropertyFormStepProps } from './channel-property-form-step.types';

defineOptions({
	name: 'ChannelPropertyFormStep',
});

const props = withDefaults(defineProps<IChannelPropertyFormStepProps>(), {
	disabled: false,
});

const emit = defineEmits<{
	(e: 'update:modelValue', value: string | null): void;
}>();

const { t } = useI18n();

const { value } = useChannelPropertyFormSpec<string>({
	channel: props.channelCategory,
	property: props.propertyCategory,
	field: 'step',
});

const step = ref<string>(value ?? '');

const hidden = ref<boolean>(typeof value !== 'undefined');

watch(
	(): string => step.value,
	(val: string) => {
		emit('update:modelValue', val || null);
	},
	{
		immediate: true,
	}
);
</script>
