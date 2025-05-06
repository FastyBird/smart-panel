<template>
	<el-form-item
		:label="t('devicesModule.fields.channelsProperties.invalid.title')"
		:prop="['invalid']"
		:class="[{ 'hidden!': hidden }]"
	>
		<el-input
			v-model="invalid"
			:placeholder="t('devicesModule.fields.channelsProperties.invalid.placeholder')"
			:disabled="props.disabled"
			name="invalid"
		/>
	</el-form-item>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElFormItem, ElInput, ElSelect } from 'element-plus';

import { useChannelPropertyFormSpec } from '../../composables/useChannelPropertyFormSpec';

import type { IChannelPropertyFormInvalidProps } from './channel-property-form-invalid.types';

defineOptions({
	name: 'ChannelPropertyFormInvalid',
});

const props = withDefaults(defineProps<IChannelPropertyFormInvalidProps>(), {
	disabled: false,
});

const emit = defineEmits<{
	(e: 'update:modelValue', value: string | null): void;
}>();

const { t } = useI18n();

const { value } = useChannelPropertyFormSpec<string>({
	channel: props.channelCategory,
	property: props.propertyCategory,
	field: 'invalid',
});

const invalid = ref<string>(value ?? '');

const hidden = ref<boolean>(typeof value !== 'undefined');

watch(
	(): string => invalid.value,
	(val: string) => {
		emit('update:modelValue', val || null);
	},
	{
		immediate: true,
	}
);
</script>
