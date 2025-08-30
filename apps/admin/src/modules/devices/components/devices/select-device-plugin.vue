<template>
	<el-form-item
		:label="t('devicesModule.fields.devices.plugin.title')"
		label-position="top"
	>
		<el-select
			v-model="selectedType"
			:placeholder="t('devicesModule.fields.devices.plugin.placeholder')"
			name="plugin"
			filterable
		>
			<el-option
				v-for="item in typesOptions"
				:key="item.value"
				:label="item.label"
				:value="item.value"
			/>
		</el-select>
	</el-form-item>

	<el-alert
		v-if="element"
		:description="element.description ?? plugin?.description"
		:closable="false"
		show-icon
		type="info"
	/>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElFormItem, ElOption, ElSelect } from 'element-plus';

import type { IPlugin, IPluginElement } from '../../../../common';
import { useDevicesPlugins } from '../../composables/useDevicesPlugins';
import type { IDevicePluginsComponents, IDevicePluginsSchemas } from '../../devices.types';

import type { ISelectDevicePluginProps } from './select-device-plugin.types';

defineOptions({
	name: 'SelectDevicePlugin',
});

const props = defineProps<ISelectDevicePluginProps>();

const emit = defineEmits<{
	(e: 'update:modelValue', type: IPluginElement['type'] | undefined): void;
}>();

const { t } = useI18n();

const { plugins, options: typesOptions } = useDevicesPlugins();

const selectedType = ref<IPluginElement['type'] | undefined>(props.modelValue);

const plugin = computed<IPlugin<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined>(() => {
	return plugins.value.find((plugin) => plugin.type === selectedType.value);
});

const element = computed<IPluginElement<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined>(() => {
	return plugin.value?.elements.find((element) => element.type === selectedType.value);
});

watch(
	(): IPluginElement['type'] | undefined => selectedType.value,
	(val: IPluginElement['type'] | undefined) => {
		emit('update:modelValue', val);
	}
);
</script>
