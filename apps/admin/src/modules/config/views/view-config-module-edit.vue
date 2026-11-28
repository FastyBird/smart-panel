<template>
	<view-header
		:title="moduleName"
		:subtitle="t('configModule.subHeadings.configModule')"
		:icon="CONFIG_MODULE_ICON"
		left="close"
		:primary="formComponent && formConfig !== null ? { label: t('configModule.buttons.save.title'), handler: onSave } : undefined"
		@back="onLeave"
	/>

	<app-breadcrumbs :items="breadcrumbs" />

	<div class="flex flex-col flex-1 min-h-0 overflow-hidden">
		<state-view
			v-if="loadError"
			kind="error"
			icon="mdi:package-variant"
			:title="t('configModule.messages.loadError')"
			class="flex-1"
			data-test-id="config-module-load-error"
		>
			<template #action>
				<el-button
					plain
					@click="onRetry"
				>
					{{ t('configModule.buttons.retry.title') }}
				</el-button>
			</template>
		</state-view>

		<state-view
			v-else-if="formConfig === null"
			kind="loading"
			:title="t('configModule.texts.loadingModuleConfig')"
			class="flex-1"
		/>

		<template v-else-if="formComponent">
			<!-- The same frame as a plugin's settings: what is being set, then the module's form and the host's footer -->
			<config-identity
				:icon="CONFIG_MODULE_ICON"
				:name="moduleName"
				:meta="module?.description"
			/>

			<el-scrollbar class="flex-1">
				<div class="p-4 tp:p-5">
					<component
						:is="formComponent"
						v-model:remote-form-submit="remoteFormSubmit"
						v-model:remote-form-result="remoteFormResult"
						v-model:remote-form-reset="remoteFormReset"
						v-model:remote-form-changed="remoteFormChanged"
						:config="formConfig"
					/>
				</div>
			</el-scrollbar>

			<!-- Wherever the phone app bar is not there to carry Save: in the drawer, and on a page kept open past 720 px -->
			<form-footer
				v-show="inDrawer || !isPhone"
				:dirty="remoteFormChanged"
				:saving="remoteFormResult === FormResult.WORKING"
				:can-save="remoteFormChanged && remoteFormResult === FormResult.NONE"
				@save="onSave"
				@discard="onLeave"
				@close="onClose"
			/>
		</template>

		<state-view
			v-else
			kind="not-found"
			icon="mdi:package-variant"
			:title="errorTitle"
			:description="errorMessage"
			class="flex-1"
			data-test-id="config-module-not-found"
		/>
	</div>
</template>

<script setup lang="ts">
import { type Component, computed, onBeforeMount, ref, shallowRef, toRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElButton, ElScrollbar } from 'element-plus';

import { AppBreadcrumbs, FormFooter, StateView, ViewHeader, useEditDrawer, useSizeClass } from '../../../common';
import { ConfigIdentity } from '../components/components';
import { useConfigDiscard } from '../composables/useConfigDiscard';
import { useConfigModule } from '../composables/useConfigModule';
import { useModule } from '../composables/useModule';
import { FormResult, RouteNames } from '../config.constants';
import type { IConfigModule } from '../store/config-modules.store.types';
import { CONFIG_MODULE_ICON } from '../utils/config-families';

import type { IViewConfigModuleEditProps } from './view-config-module-edit.types';

defineOptions({
	name: 'ViewConfigModuleEdit',
});

const props = defineProps<IViewConfigModuleEditProps>();

const emit = defineEmits<{
	(e: 'update:remoteFormChanged', formChanged: boolean): void;
}>();

const { t } = useI18n();
const router = useRouter();
const { meta } = useMeta({});

const { inDrawer } = useEditDrawer();
const { isPhone } = useSizeClass();

const { confirmDiscard } = useConfigDiscard();

const moduleType = toRef(props, 'module');

const { configModule, fetchConfigModule } = useConfigModule({ type: moduleType });
const { module, element } = useModule({ name: moduleType });

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResult>(FormResult.NONE);
const remoteFormReset = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);
const loadError = ref<boolean>(false);

// The object the form edits, taken once it is read, so a newer copy the store receives meanwhile does not swap it
const formConfig = shallowRef<IConfigModule | null>(null);

const formComponent = computed<Component | undefined>((): Component | undefined => element.value?.components?.moduleConfigEditForm);

const moduleName = computed<string>((): string => module.value?.name || props.module);

const errorTitle = computed<string>((): string => {
	if (!module.value) {
		return t('configModule.messages.moduleNotFound.title');
	}

	if (!element.value) {
		return t('configModule.messages.moduleElementNotFound.title');
	}

	return t('configModule.messages.moduleFormNotFound.title');
});

const errorMessage = computed<string>((): string => {
	if (!module.value) {
		return t('configModule.messages.moduleNotFound.message', { module: props.module });
	}

	if (!element.value) {
		return t('configModule.messages.moduleElementNotFound.message', { module: moduleName.value });
	}

	if (!element.value.components) {
		return t('configModule.messages.moduleComponentsNotFound.message', { module: moduleName.value });
	}

	return t('configModule.messages.moduleFormNotFound.message', { module: moduleName.value });
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => [
		{
			label: t('configModule.breadcrumbs.config'),
			route: router.resolve({ name: RouteNames.CONFIG }),
		},
		{
			label: t('configModule.breadcrumbs.configModules'),
			route: router.resolve({ name: RouteNames.CONFIG_MODULES }),
		},
		{
			label: moduleName.value,
			route: router.resolve({ name: RouteNames.CONFIG_MODULE_EDIT, params: { module: props.module } }),
		},
	]
);

const onClose = (): void => {
	if (inDrawer.value) {
		void router.replace({ name: RouteNames.CONFIG_MODULES });
	} else {
		void router.push({ name: RouteNames.CONFIG_MODULES });
	}
};

// Close, or Discard when there are changes: those are confirmed first
const onLeave = async (): Promise<void> => {
	if (remoteFormChanged.value && !(await confirmDiscard())) {
		return;
	}

	remoteFormChanged.value = false;

	onClose();
};

const onSave = (): void => {
	remoteFormSubmit.value = true;
};

const load = async (): Promise<void> => {
	loadError.value = false;
	formConfig.value = null;

	try {
		await fetchConfigModule();
	} catch {
		loadError.value = true;

		return;
	}

	formConfig.value = configModule.value;

	if (formConfig.value === null) {
		loadError.value = true;
	}
};

const onRetry = (): void => {
	void load();
};

watch(remoteFormChanged, (changed: boolean): void => {
	emit('update:remoteFormChanged', changed);
});

// Saved: the settings go back to the list
watch(remoteFormResult, (result: FormResult): void => {
	if (result === FormResult.OK) {
		remoteFormChanged.value = false;

		onClose();
	}
});

watch(
	moduleName,
	(name: string): void => {
		meta.title = t('configModule.meta.configModuleEdit.title', { module: name });
	},
	{ immediate: true }
);

onBeforeMount((): void => {
	void load();
});
</script>
