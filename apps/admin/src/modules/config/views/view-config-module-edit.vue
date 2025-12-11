<template>
	<view-header
		:heading="moduleName"
		:sub-heading="t('configModule.subHeadings.configModule')"
		icon="mdi:package-variant"
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

	<config-module
		v-model:remote-form-submit="remoteFormSubmit"
		v-model:remote-form-result="remoteFormResult"
		v-model:remote-form-reset="remoteFormReset"
		:type="moduleType"
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
import { ConfigModule } from '../components/components';
import { useModule } from '../composables/useModule';
import { FormResult } from '../config.constants';

import type { IViewConfigModuleEditProps } from './view-config-module-edit.types';

defineOptions({
	name: 'ViewConfigModuleEdit',
});

const props = withDefaults(defineProps<IViewConfigModuleEditProps>(), {
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

const moduleType = computed<string>((): string => {
	const moduleParam = route.params.module;
	return (Array.isArray(moduleParam) ? moduleParam[0] : moduleParam) || '';
});

const moduleComposable = useModule({ name: moduleType.value });
const moduleName = computed<string>((): string => {
	return moduleComposable.module.value?.name || moduleType.value;
});

watch(
	(): string => moduleName.value,
	(name: string): void => {
		meta.title = t('configModule.meta.configModuleEdit.title', { module: name });
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
