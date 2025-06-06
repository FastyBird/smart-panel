<template>
	<el-form-item
		:label="t('devicesModule.fields.channels.plugin.title')"
		label-position="top"
	>
		<el-select
			v-model="selectedType"
			:placeholder="t('devicesModule.fields.channels.plugin.placeholder')"
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
		v-if="plugin"
		:description="plugin.description"
		:closable="false"
		show-icon
		type="info"
	/>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElFormItem, ElOption, ElSelect } from 'element-plus';

import type { IPlugin } from '../../../../common';
import { useChannelsPlugins } from '../../composables/useChannelsPlugins';
import type { IChannelPluginsComponents, IChannelPluginsSchemas } from '../../devices.types';

import type { ISelectChannelPluginProps } from './select-channel-plugin.types';

defineOptions({
	name: 'SelectChannelPlugin',
});

const props = defineProps<ISelectChannelPluginProps>();

const emit = defineEmits<{
	(e: 'update:modelValue', type: IPlugin['type'] | undefined): void;
}>();

const { t } = useI18n();

const { plugins, options: typesOptions } = useChannelsPlugins();

const selectedType = ref<IPlugin['type'] | undefined>(props.modelValue);

const plugin = computed<IPlugin<IChannelPluginsComponents, IChannelPluginsSchemas> | undefined>(() => {
	return plugins.value.find((plugin) => plugin.type === selectedType.value);
});

watch(
	(): IPlugin['type'] | undefined => selectedType.value,
	(val: IPlugin['type'] | undefined) => {
		emit('update:modelValue', val);
	}
);
</script>
