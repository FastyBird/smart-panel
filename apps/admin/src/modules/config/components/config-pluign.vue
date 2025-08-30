<template>
	<div
		v-loading="isLoading || configPlugin === null"
		:element-loading-text="t('configModule.texts.loadingPluginConfig')"
	>
		<component
			:is="element.components.pluginConfigEditForm"
			v-if="configPlugin && element?.components?.pluginConfigEditForm"
			v-model:remote-form-submit="remoteFormSubmit"
			v-model:remote-form-result="remoteFormResult"
			v-model:remote-form-reset="remoteFormReset"
			:config="configPlugin"
			:layout="props.layout"
		/>
	</div>
</template>

<script setup lang="ts">
import { onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { vLoading } from 'element-plus';

import { useConfigPlugin } from '../composables/useConfigPlugin';
import { usePlugin } from '../composables/usePlugin';
import { FormResult, type FormResultType } from '../config.constants';
import { ConfigException } from '../config.exceptions';

import type { IConfigPluginProps } from './config-pluign.types';

defineOptions({
	name: 'ConfigPlugin',
});

const props = withDefaults(defineProps<IConfigPluginProps>(), {
	remoteFormSubmit: false,
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
});

const emit = defineEmits<{
	(e: 'update:remoteFormSubmit', remoteFormSubmit: boolean): void;
	(e: 'update:remoteFormResult', remoteFormResult: FormResultType): void;
	(e: 'update:remoteFormReset', remoteFormReset: boolean): void;
}>();

const { t } = useI18n();

const { element } = usePlugin({ name: props.type });
const { configPlugin, isLoading, fetchConfigPlugin } = useConfigPlugin({ type: props.type });

const remoteFormSubmit = ref<boolean>(props.remoteFormSubmit);
const remoteFormResult = ref<FormResultType>(props.remoteFormResult);
const remoteFormReset = ref<boolean>(props.remoteFormReset);

onBeforeMount(async (): Promise<void> => {
	fetchConfigPlugin().catch((error: unknown): void => {
		const err = error as Error;

		throw new ConfigException('Something went wrong', err);
	});
});

watch(
	(): boolean => props.remoteFormSubmit,
	async (val: boolean): Promise<void> => {
		remoteFormSubmit.value = val;
	}
);

watch(
	(): boolean => props.remoteFormReset,
	async (val: boolean): Promise<void> => {
		remoteFormReset.value = val;
	}
);

watch(
	(): boolean => remoteFormSubmit.value,
	async (val: boolean): Promise<void> => {
		emit('update:remoteFormSubmit', val);
	}
);

watch(
	(): FormResultType => remoteFormResult.value,
	async (val: FormResultType): Promise<void> => {
		emit('update:remoteFormResult', val);
	}
);

watch(
	(): boolean => remoteFormReset.value,
	async (val: boolean): Promise<void> => {
		emit('update:remoteFormReset', val);
	}
);
</script>
