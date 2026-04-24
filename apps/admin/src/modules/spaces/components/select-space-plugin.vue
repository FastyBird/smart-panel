<template>
	<el-form-item
		:label="t('spacesModule.fields.spaces.plugin.title')"
		label-position="top"
	>
		<el-select
			v-model="selectedType"
			:placeholder="t('spacesModule.fields.spaces.plugin.placeholder')"
			name="plugin"
			filterable
		>
			<el-option
				v-for="item in creatableOptions"
				:key="item.value"
				:label="item.label"
				:value="item.value"
				:disabled="item.disabled"
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

import type { IPlugin, IPluginElement } from '../../../common';
import { useSpacesPlugins } from '../composables/useSpacesPlugins';
import type { ISpacePluginRoutes, ISpacePluginsComponents, ISpacePluginsSchemas } from '../spaces.types';

import type { ISelectSpacePluginProps } from './select-space-plugin.types';

defineOptions({
	name: 'SelectSpacePlugin',
});

const props = defineProps<ISelectSpacePluginProps>();

const emit = defineEmits<{
	(e: 'update:modelValue', type: IPluginElement['type'] | undefined): void;
}>();

const { t } = useI18n();

const { plugins, options } = useSpacesPlugins();

// Only surface types whose plugin contributes a `spaceAddForm` component —
// singletons like master/entry register no add form (they're backend-seeded)
// and plugin-contributed types that haven't wired an add form yet would
// render a blank dispatch. Either way, picking them from the creation flow
// is a dead end, so they're hidden rather than shown-and-disabled.
const creatableOptions = computed(() => {
	return options.value.filter((opt) => {
		const element = plugins.value
			.flatMap((p) => p.elements ?? [])
			.find((el) => el.type === opt.value);
		return !!element?.components?.spaceAddForm;
	});
});

const selectedType = ref<IPluginElement['type'] | undefined>(props.modelValue);

const plugin = computed<IPlugin<ISpacePluginsComponents, ISpacePluginsSchemas, ISpacePluginRoutes> | undefined>(() => {
	return plugins.value.find((plugin) => (plugin?.elements ?? []).some((element) => element.type === selectedType.value));
});

const element = computed<IPluginElement<ISpacePluginsComponents, ISpacePluginsSchemas> | undefined>(() => {
	return (plugin.value?.elements ?? []).find((element) => element.type === selectedType.value);
});

// Keep the local ref in sync with parent-driven changes (v-model contract).
// Without this a parent reset — e.g. clearing the picker after save — would
// be invisible in the dropdown.
watch(
	(): IPluginElement['type'] | undefined => props.modelValue,
	(val: IPluginElement['type'] | undefined): void => {
		if (val !== selectedType.value) {
			selectedType.value = val;
		}
	},
);

watch(
	(): IPluginElement['type'] | undefined => selectedType.value,
	(val: IPluginElement['type'] | undefined) => {
		emit('update:modelValue', val);
	}
);
</script>
