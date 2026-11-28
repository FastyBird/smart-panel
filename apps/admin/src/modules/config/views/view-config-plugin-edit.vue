<template>
	<view-header
		:title="pluginName"
		:subtitle="t('configModule.subHeadings.configPlugin')"
		:icon="family.icon"
		left="close"
		:primary="formComponent && formConfig !== null ? { label: t('configModule.buttons.save.title'), handler: onSave } : undefined"
		@back="onLeave"
	/>

	<app-breadcrumbs :items="breadcrumbs" />

	<div class="flex flex-col flex-1 min-h-0 overflow-hidden">
		<state-view
			v-if="loadError"
			kind="error"
			icon="mdi:toy-brick"
			:title="t('configModule.messages.loadError')"
			class="flex-1"
			data-test-id="config-plugin-load-error"
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
			:title="t('configModule.texts.loadingPluginConfig')"
			class="flex-1"
		/>

		<template v-else-if="formComponent">
			<!-- Spec section 7: the host draws who the plugin is, how its services run and whether it is on; the plugin
			     draws only its form sections, and the host's footer saves them -->
			<config-identity
				v-model:enabled="formConfig.enabled"
				:icon="family.icon"
				:name="pluginName"
				:meta="identityMeta"
				:status="identityStatus"
				toggleable
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
			icon="mdi:toy-brick"
			:title="errorTitle"
			:description="errorMessage"
			class="flex-1"
			data-test-id="config-plugin-not-found"
		/>
	</div>
</template>

<script setup lang="ts">
import { type Component, computed, onBeforeMount, ref, shallowRef, toRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElButton, ElScrollbar } from 'element-plus';

import { AppBreadcrumbs, FormFooter, StateView, ViewHeader, injectStoresManager, useEditDrawer, useSizeClass } from '../../../common';
import { useServices } from '../../extensions/composables/useServices';
import { extensionsStoreKey } from '../../extensions/store/keys';
import { ConfigIdentity } from '../components/components';
import { useConfigDiscard } from '../composables/useConfigDiscard';
import { useConfigPlugin } from '../composables/useConfigPlugin';
import { usePlugin } from '../composables/usePlugin';
import { FormResult, RouteNames } from '../config.constants';
import type { IConfigPlugin } from '../store/config-plugins.store.types';
import { configPluginFamily } from '../utils/config-families';
import { CONFIG_PLUGIN_STATUS_TAG, configPluginStatus } from '../utils/config-plugin-status';

import type { IViewConfigPluginEditProps } from './view-config-plugin-edit.types';

defineOptions({
	name: 'ViewConfigPluginEdit',
});

const props = defineProps<IViewConfigPluginEditProps>();

const emit = defineEmits<{
	(e: 'update:remoteFormChanged', formChanged: boolean): void;
}>();

const { t } = useI18n();
const router = useRouter();
const { meta } = useMeta({});

const { inDrawer } = useEditDrawer();
const { isPhone } = useSizeClass();

const { confirmDiscard } = useConfigDiscard();

const storesManager = injectStoresManager();
const extensionsStore = storesManager.getStore(extensionsStoreKey);

const pluginType = toRef(props, 'plugin');

const { configPlugin, fetchConfigPlugin } = useConfigPlugin({ type: pluginType });
const { plugin, element } = usePlugin({ name: pluginType });
const { services, fetchServices } = useServices();

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResult>(FormResult.NONE);
const remoteFormReset = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);
const loadError = ref<boolean>(false);

// The object the form edits, taken once it is read: a newer copy the store receives meanwhile does not swap it under the
// form, and the Enabled switch of the identity row writes to the same object, so it counts as a change of the form
const formConfig = shallowRef<IConfigPlugin | null>(null);

const formComponent = computed<Component | undefined>((): Component | undefined => element.value?.components?.pluginConfigEditForm);

const pluginName = computed<string>((): string => plugin.value?.name || props.plugin);

const family = computed(() => configPluginFamily(props.plugin));

const identityMeta = computed<string>((): string => {
	const version = extensionsStore.findByType(props.plugin)?.version;

	return [t(`configModule.families.${family.value.id}.title`), version].filter(Boolean).join(' · ');
});

const identityStatus = computed(() => {
	const status = configPluginStatus(services.value.filter((service) => service.extensionType === props.plugin));

	return status === null ? null : { status: CONFIG_PLUGIN_STATUS_TAG[status], label: t(`configModule.pluginStatus.${status}`) };
});

const errorTitle = computed<string>((): string => {
	if (!plugin.value) {
		return t('configModule.messages.pluginNotFound.title');
	}

	if (!element.value) {
		return t('configModule.messages.pluginElementNotFound.title');
	}

	return t('configModule.messages.pluginFormNotFound.title');
});

const errorMessage = computed<string>((): string => {
	if (!plugin.value) {
		return t('configModule.messages.pluginNotFound.message', { plugin: props.plugin });
	}

	if (!element.value) {
		return t('configModule.messages.pluginElementNotFound.message', { plugin: pluginName.value });
	}

	if (!element.value.components) {
		return t('configModule.messages.pluginComponentsNotFound.message', { plugin: pluginName.value });
	}

	return t('configModule.messages.pluginFormNotFound.message', { plugin: pluginName.value });
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => [
		{
			label: t('configModule.breadcrumbs.config'),
			route: router.resolve({ name: RouteNames.CONFIG }),
		},
		{
			label: t('configModule.breadcrumbs.configPlugins'),
			route: router.resolve({ name: RouteNames.CONFIG_PLUGINS }),
		},
		{
			label: pluginName.value,
			route: router.resolve({ name: RouteNames.CONFIG_PLUGIN_EDIT, params: { plugin: props.plugin } }),
		},
	]
);

const onClose = (): void => {
	if (inDrawer.value) {
		void router.replace({ name: RouteNames.CONFIG_PLUGINS });
	} else {
		void router.push({ name: RouteNames.CONFIG_PLUGINS });
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
		await fetchConfigPlugin();
	} catch {
		loadError.value = true;

		return;
	}

	formConfig.value = configPlugin.value;

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
	pluginName,
	(name: string): void => {
		meta.title = t('configModule.meta.configPluginEdit.title', { plugin: name });
	},
	{ immediate: true }
);

onBeforeMount((): void => {
	void load();

	// The connection state is extra: without it the form still works
	fetchServices().catch((): void => {});
});
</script>
