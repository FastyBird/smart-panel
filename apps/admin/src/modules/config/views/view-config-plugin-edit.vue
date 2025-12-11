<template>
	<view-header
		:heading="pluginName"
		:sub-heading="t('configModule.subHeadings.configPlugin')"
		icon="mdi:toy-brick"
	>
		<template #extra>
			<div class="flex items-center">
				<el-button
					plain
					:loading="remoteFormResult === FormResult.WORKING"
					:disabled="remoteFormResult === FormResult.WORKING"
					type="primary"
					class="px-4! ml-2!"
					@click="onSave"
				>
					<template #icon>
						<icon icon="mdi:content-save" />
					</template>
					{{ t('configModule.buttons.save.title') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<config-plugin
		v-model:remote-form-submit="remoteFormSubmit"
		v-model:remote-form-result="remoteFormResult"
		v-model:remote-form-reset="remoteFormReset"
		:type="pluginType"
	/>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { useRoute } from 'vue-router';

import { ElButton } from 'element-plus';

import { Icon } from '@iconify/vue';

import { ViewHeader } from '../../../common';
import { ConfigPlugin } from '../components/components';
import { usePlugin } from '../composables/usePlugin';
import { FormResult } from '../config.constants';

import type { IViewConfigPluginEditProps } from './view-config-plugin-edit.types';

defineOptions({
	name: 'ViewConfigPluginEdit',
});

const props = withDefaults(defineProps<IViewConfigPluginEditProps>(), {
	remoteFormSubmit: false,
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
});

const emit = defineEmits<{
	(e: 'update:remoteFormSubmit', remoteFormSubmit: boolean): void;
	(e: 'update:remoteFormResult', remoteFormResult: FormResult): void;
	(e: 'update:remoteFormReset', remoteFormReset: boolean): void;
}>();

const { t } = useI18n();
const route = useRoute();
const { meta } = useMeta({});

const remoteFormSubmit = ref<boolean>(props.remoteFormSubmit);
const remoteFormResult = ref<FormResult>(props.remoteFormResult);
const remoteFormReset = ref<boolean>(props.remoteFormReset);

const pluginType = computed<string>((): string => {
	const pluginParam = route.params.plugin;
	return (Array.isArray(pluginParam) ? pluginParam[0] : pluginParam) || '';
});

// Use a ref to track the current plugin type and update it when route changes
const currentPluginType = ref<string>(pluginType.value);
watch(
	(): string => pluginType.value,
	(val: string): void => {
		currentPluginType.value = val;
	},
	{ immediate: true }
);

const pluginComposable = computed(() => {
	// Re-create composable when plugin type changes
	return usePlugin({ name: currentPluginType.value });
});

const pluginName = computed<string>((): string => {
	return pluginComposable.value.plugin.value?.name || pluginType.value;
});

watch(
	(): string => pluginName.value,
	(name: string): void => {
		meta.title = t('configModule.meta.configPluginEdit.title', { plugin: name });
	},
	{ immediate: true }
);

const onSave = (): void => {
	remoteFormSubmit.value = true;
};

watch(
	(): boolean => props.remoteFormSubmit,
	(val: boolean): void => {
		remoteFormSubmit.value = val;
	}
);

watch(
	(): FormResult => props.remoteFormResult,
	(val: FormResult): void => {
		remoteFormResult.value = val;
	}
);

watch(
	(): boolean => props.remoteFormReset,
	(val: boolean): void => {
		remoteFormReset.value = val;
	}
);

watch(
	(): boolean => remoteFormSubmit.value,
	(val: boolean): void => {
		emit('update:remoteFormSubmit', val);
	}
);

watch(
	(): FormResult => remoteFormResult.value,
	(val: FormResult): void => {
		emit('update:remoteFormResult', val);
	}
);

watch(
	(): boolean => remoteFormReset.value,
	(val: boolean): void => {
		emit('update:remoteFormReset', val);
	}
);
</script>
