<template>
	<el-form-item
		:label="t('devicesModule.fields.channelsProperties.dataType.title')"
		:prop="['dataType']"
		:class="[{ 'hidden!': hidden }]"
	>
		<el-select
			v-model="dataType"
			:placeholder="t('devicesModule.fields.channelsProperties.dataType.placeholder')"
			:disabled="props.disabled"
			name="dataType"
		>
			<el-option
				v-for="item in props.dataTypesOptions"
				:key="item.value"
				:label="item.label"
				:value="item.value"
			/>
		</el-select>
	</el-form-item>

	<el-alert
		v-if="dataType && !hidden"
		type="info"
		:closable="false"
	>
		{{ t(`devicesModule.texts.channelsProperties.dataTypes.${dataType}`) }}
	</el-alert>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElFormItem, ElOption, ElSelect } from 'element-plus';

import { DevicesModuleChannelPropertyDataType } from '../../../../openapi.constants';
import { useChannelPropertyFormSpec } from '../../composables/useChannelPropertyFormSpec';

import type { IChannelPropertyFormDataTypeProps } from './channel-property-form-data-type.types';

defineOptions({
	name: 'ChannelPropertyFormDataType',
});

const props = withDefaults(defineProps<IChannelPropertyFormDataTypeProps>(), {
	disabled: false,
});

const emit = defineEmits<{
	(e: 'update:modelValue', value: DevicesModuleChannelPropertyDataType): void;
}>();

const { t } = useI18n();

const { value } = useChannelPropertyFormSpec<DevicesModuleChannelPropertyDataType>({
	channel: props.channelCategory,
	property: props.propertyCategory,
	field: 'data_type',
});

const hidden = ref<boolean>(typeof value !== 'undefined');

const dataType = ref<DevicesModuleChannelPropertyDataType>(
	!hidden.value && props.modelValue ? props.modelValue : (value ?? DevicesModuleChannelPropertyDataType.unknown)
);

watch(
	(): DevicesModuleChannelPropertyDataType => dataType.value,
	(val: DevicesModuleChannelPropertyDataType) => {
		emit('update:modelValue', val);
	},
	{
		immediate: true,
	}
);
</script>
