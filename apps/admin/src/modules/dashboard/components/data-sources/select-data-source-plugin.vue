<template>
	<el-form-item
		:label="t('dashboardModule.fields.dataSources.plugin.title')"
		label-position="top"
	>
		<el-select
			v-model="selectedType"
			:placeholder="t('dashboardModule.fields.dataSources.plugin.placeholder')"
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
import { useDataSourcesPlugins } from '../../composables/useDataSourcesPlugins';
import type { IDataSourcePluginsComponents, IDataSourcePluginsSchemas } from '../../dashboard.types';

import type { ISelectDataSourcePluginProps } from './select-data-source-plugin.types';

defineOptions({
	name: 'SelectDataSourcePlugin',
});

const props = defineProps<ISelectDataSourcePluginProps>();

const emit = defineEmits<{
	(e: 'update:modelValue', type: IPlugin['type'] | undefined): void;
}>();

const { t } = useI18n();

const { plugins, options: typesOptions } = useDataSourcesPlugins();

const selectedType = ref<IPlugin['type'] | undefined>(props.modelValue);

const plugin = computed<IPlugin<IDataSourcePluginsComponents, IDataSourcePluginsSchemas> | undefined>(() => {
	return plugins.value.find((plugin) => plugin.elements.find((element) => element.type === selectedType.value));
});

const element = computed<IPluginElement<IDataSourcePluginsComponents, IDataSourcePluginsSchemas> | undefined>(() => {
	return plugin.value?.elements.find((element) => element.type === selectedType.value);
});

watch(
	(): IPlugin['type'] | undefined => selectedType.value,
	(val: IPlugin['type'] | undefined) => {
		emit('update:modelValue', val);
	}
);
</script>
