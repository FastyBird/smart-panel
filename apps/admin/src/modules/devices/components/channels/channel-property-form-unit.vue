<template>
	<el-form-item
		:label="t('devicesModule.fields.channelsProperties.unit.title')"
		:prop="['unit']"
		:class="[{ 'hidden!': hidden }]"
	>
		<el-input
			v-model="unit"
			:placeholder="t('devicesModule.fields.channelsProperties.unit.placeholder')"
			:disabled="props.disabled"
			name="unit"
		/>
	</el-form-item>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElFormItem, ElInput, ElSelect } from 'element-plus';

import { useChannelPropertyFormSpec } from '../../composables/useChannelPropertyFormSpec';

import type { IChannelPropertyFormUnitProps } from './channel-property-form-unit.types';

defineOptions({
	name: 'ChannelPropertyFormUnit',
});

const props = withDefaults(defineProps<IChannelPropertyFormUnitProps>(), {
	disabled: false,
});

const emit = defineEmits<{
	(e: 'update:modelValue', value: string | null): void;
}>();

const { t } = useI18n();

const { value } = useChannelPropertyFormSpec<string>({
	channel: props.channelCategory,
	property: props.propertyCategory,
	field: 'unit',
});

const unit = ref<string>(props.modelValue ?? value ?? '');

const hidden = ref<boolean>(typeof value !== 'undefined');

watch(
	(): string => unit.value,
	(val: string) => {
		emit('update:modelValue', val || null);
	},
	{
		immediate: true,
	}
);
</script>
