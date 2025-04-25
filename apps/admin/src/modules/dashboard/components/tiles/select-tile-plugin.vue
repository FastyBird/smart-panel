<template>
	<el-form-item
		:label="t('dashboardModule.fields.tiles.plugin.title')"
		label-position="top"
	>
		<el-select
			v-model="selectedType"
			:placeholder="t('dashboardModule.fields.tiles.plugin.placeholder')"
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
import { useTilesPlugins } from '../../composables/useTilesPlugins';
import type { ITilePluginsComponents, ITilePluginsSchemas } from '../../dashboard.types';

import type { ISelectTilePluginProps } from './select-tile-plugin.types';

defineOptions({
	name: 'SelectTilePlugin',
});

const props = defineProps<ISelectTilePluginProps>();

const emit = defineEmits<{
	(e: 'update:modelValue', type: IPlugin['type'] | undefined): void;
}>();

const { t } = useI18n();

const { plugins, options: typesOptions } = useTilesPlugins();

const selectedType = ref<IPlugin['type'] | undefined>(props.modelValue);

const plugin = computed<IPlugin<ITilePluginsComponents, ITilePluginsSchemas> | undefined>(() => {
	return plugins.value.find((plugin) => plugin.type === selectedType.value);
});

watch(
	(): IPlugin['type'] | undefined => selectedType.value,
	(val: IPlugin['type'] | undefined) => {
		emit('update:modelValue', val);
	}
);
</script>
