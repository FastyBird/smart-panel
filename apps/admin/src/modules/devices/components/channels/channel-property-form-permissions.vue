<template>
	<el-form-item
		:label="t('devicesModule.fields.channelsProperties.permissions.title')"
		:prop="['permissions']"
		:class="[{ 'hidden!': hidden }]"
	>
		<el-select
			v-model="permissions"
			:placeholder="t('devicesModule.fields.channelsProperties.permissions.placeholder')"
			:disabled="props.disabled"
			name="permissions"
			multiple
		>
			<el-option
				v-for="item in props.permissionsOptions"
				:key="item.value"
				:label="item.label"
				:value="item.value"
			/>
		</el-select>
	</el-form-item>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElFormItem, ElOption, ElSelect } from 'element-plus';

import type { DevicesModuleChannelPropertyPermissions } from '../../../../openapi';
import { useChannelPropertyFormSpec } from '../../composables/useChannelPropertyFormSpec';

import type { IChannelPropertyFormPermissionsProps } from './channel-property-form-permissions.types';

defineOptions({
	name: 'ChannelPropertyFormPermissions',
});

const props = withDefaults(defineProps<IChannelPropertyFormPermissionsProps>(), {
	disabled: false,
});

const emit = defineEmits<{
	(e: 'update:modelValue', value: DevicesModuleChannelPropertyPermissions[]): void;
}>();

const { t } = useI18n();

const { value } = useChannelPropertyFormSpec<DevicesModuleChannelPropertyPermissions[]>({
	channel: props.channelCategory,
	property: props.propertyCategory,
	field: 'permissions',
});

const hidden = ref<boolean>(typeof value !== 'undefined');

const permissions = ref<DevicesModuleChannelPropertyPermissions[]>(!hidden.value && props.modelValue ? props.modelValue : (value ?? []));

watch(
	(): DevicesModuleChannelPropertyPermissions[] => permissions.value,
	(val: DevicesModuleChannelPropertyPermissions[]) => {
		emit('update:modelValue', val);
	},
	{
		immediate: true,
	}
);
</script>
