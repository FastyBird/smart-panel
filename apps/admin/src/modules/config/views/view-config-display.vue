<template>
	<div
		v-loading="isLoading || configDisplay === null"
		:element-loading-text="t('configModule.texts.loadingDisplayConfig')"
	>
		<el-card v-if="isMDDevice">
			<config-display-form
				v-if="configDisplay"
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				:config="configDisplay"
			/>
		</el-card>

		<template v-else>
			<config-display-form
				v-if="configDisplay"
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				:config="configDisplay"
				:layout="Layout.PHONE"
			/>
		</template>
	</div>
</template>

<script setup lang="ts">
import { onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';

import { ElCard, vLoading } from 'element-plus';

import { useBreakpoints } from '../../../common';
import { ConfigDisplayForm } from '../components/components';
import { useConfigDisplay } from '../composables/composables';
import { FormResult, type FormResultType, Layout } from '../config.constants';
import { ConfigException } from '../config.exceptions';

import type { ViewConfigDisplayProps } from './view-config-display.types';

defineOptions({
	name: 'ViewConfigDisplay',
});

const props = withDefaults(defineProps<ViewConfigDisplayProps>(), {
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

const { isMDDevice } = useBreakpoints();

const { configDisplay, fetchConfigDisplay, isLoading } = useConfigDisplay();

const remoteFormSubmit = ref<boolean>(props.remoteFormSubmit);
const remoteFormResult = ref<FormResultType>(props.remoteFormResult);
const remoteFormReset = ref<boolean>(props.remoteFormReset);

onBeforeMount(async (): Promise<void> => {
	fetchConfigDisplay().catch((error: unknown): void => {
		const err = error as Error;

		throw new ConfigException('Something went wrong', err);
	});
});

watch(
	(): boolean => isLoading.value,
	(val: boolean): void => {
		if (!val && configDisplay.value === null) {
			throw new ConfigException('Something went wrong');
		}
	}
);

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

useMeta({
	title: t('configModule.meta.configDisplay.title'),
});
</script>
