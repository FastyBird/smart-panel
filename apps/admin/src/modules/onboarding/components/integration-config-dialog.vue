<template>
	<el-dialog
		:model-value="visible"
		:title="t('onboardingModule.integrations.configDialog.title', { name: pluginName })"
		width="560px"
		:close-on-click-modal="false"
		@update:model-value="(val: boolean) => emit('update:visible', val)"
	>
		<!-- The form is mounted only while the dialog is open: ElDialog keeps its content after closing, and a form that holds
			 resources (the Protect status polling) must release them on close. -->
		<el-scrollbar max-height="60vh">
			<div
				v-loading="isLoading"
				class="min-h-[120px] overflow-x-hidden"
			>
				<component
					:is="configFormComponent"
					v-if="visible && !isLoading && formConfig && configFormComponent"
					v-model:remote-form-submit="remoteFormSubmit"
					v-model:remote-form-result="remoteFormResult"
					v-model:remote-form-reset="remoteFormReset"
					v-model:remote-form-changed="remoteFormChanged"
					:config="formConfig"
					:remote-form-errors="formFieldErrors"
				/>
				<empty-state
					v-else-if="visible && !isLoading"
					:icon="loadFailed ? 'mdi:alert-circle-outline' : 'mdi:puzzle-outline'"
					:description="
						t(loadFailed ? 'onboardingModule.integrations.configDialog.loadFailed' : 'onboardingModule.integrations.configDialog.noConfig')
					"
					data-test-id="integration-config-empty"
				/>
			</div>
		</el-scrollbar>
		<template #footer>
			<div class="flex justify-between items-center">
				<el-button
					:loading="isValidating"
					:disabled="!remoteFormChanged"
					@click="handleValidate"
				>
					{{ t('onboardingModule.integrations.configDialog.buttons.validate') }}
				</el-button>
				<div class="flex gap-2 items-center">
					<el-button
						link
						@click="emit('update:visible', false)"
					>
						{{ t('onboardingModule.integrations.configDialog.buttons.cancel') }}
					</el-button>
					<el-button
						type="primary"
						:loading="isSaving"
						:disabled="!remoteFormChanged"
						@click="handleSave"
					>
						{{ t('onboardingModule.integrations.configDialog.buttons.save') }}
					</el-button>
				</div>
			</div>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDialog, ElScrollbar, vLoading } from 'element-plus';

import { deepClone, injectStoresManager, useFlashMessage } from '../../../common';
import EmptyState from '../../../common/components/empty-state.vue';
import { usePlugins } from '../../../modules/config/composables/usePlugins';
import { CONFIG_MODULE_PLUGIN_TYPE, FormResult, type FormResultType } from '../../../modules/config/config.constants';
import type { IPluginsComponents, IPluginsSchemas } from '../../../modules/config/config.types';
import type { IConfigPlugin, IConfigPluginValidationResult } from '../../../modules/config/store/config-plugins.store.types';
import { configPluginsStoreKey } from '../../../modules/config/store/keys';
import { extensionsStoreKey } from '../../../modules/extensions/store/keys';

defineOptions({
	name: 'IntegrationConfigDialog',
});

const props = defineProps<{
	visible: boolean;
	pluginType: string;
	pluginName: string;
}>();

const emit = defineEmits<{
	(e: 'update:visible', value: boolean): void;
	(e: 'saved'): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();
const storesManager = injectStoresManager();
const configPluginsStore = storesManager.getStore(configPluginsStoreKey);
const extensionsStore = storesManager.getStore(extensionsStoreKey);
const { getByName } = usePlugins();

const isLoading = ref(false);
const isSaving = ref(false);
const isValidating = ref(false);
const validationResult = ref<IConfigPluginValidationResult | null>(null);
const remoteFormSubmit = ref(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormReset = ref(false);
const remoteFormChanged = ref(false);

const snakeToCamel = (str: string): string => {
	return str
		.split('.')
		.map((segment) => segment.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()))
		.join('.');
};

const formFieldErrors = computed(() => {
	if (!validationResult.value || validationResult.value.valid) return [];

	return (validationResult.value.errors ?? []).filter((err) => err.field).map((err) => ({ field: snakeToCamel(err.field!), message: err.message }));
});

const plugin = computed(() => getByName(props.pluginType));

const configFormComponent = computed(() => {
	const element = plugin.value?.elements?.find(
		(el: { type: string; components?: IPluginsComponents; schemas?: IPluginsSchemas }) => el.type === CONFIG_MODULE_PLUGIN_TYPE
	);
	return element?.components?.pluginConfigEditForm ?? null;
});

/**
 * The configuration the open form edits: a copy of the store's entry taken when the dialog opens. The form edits its
 * config in place, so handing it the store's own object would leave abandoned edits (and a typed secret) in the store
 * after Cancel, and the next form would take them for the saved configuration.
 */
const formConfig = ref<IConfigPlugin | null>(null);

/** The configuration could not be read, and the store's copy may be out of date, so no form is offered. */
const loadFailed = ref(false);

/** Types whose entry this dialog seeded because the backend had none to read; a failed read of those is expected. */
const seededTypes = new Set<string>();

/** Bumped on every open and close, so a read that lands after its dialog closed or reopened mounts nothing. */
let loadGeneration = 0;

/** Reads the configuration afresh on every open and mounts the form only on what that read returned. */
const loadConfig = async (): Promise<void> => {
	const generation = ++loadGeneration;
	const type = props.pluginType;

	formConfig.value = null;
	loadFailed.value = false;
	isLoading.value = true;

	let failed = false;

	try {
		await configPluginsStore.get({ type, force: true });

		seededTypes.delete(type);
	} catch {
		if (!configPluginsStore.findByType(type)) {
			// Config may not exist yet — seed a default entry so the form can render
			try {
				const extension = extensionsStore.findByType(type);
				configPluginsStore.set({ data: { type, enabled: extension?.enabled ?? false } as { type: string } });
				seededTypes.add(type);
			} catch {
				// Schema validation failure — nothing we can do
			}
		} else if (!seededTypes.has(type)) {
			failed = true;
		}
	}

	if (generation !== loadGeneration) {
		return;
	}

	const config = configPluginsStore.findByType(type);

	loadFailed.value = failed;
	formConfig.value = !failed && config ? deepClone(config) : null;
	isLoading.value = false;
};

let saveFallbackTimer: ReturnType<typeof setTimeout> | undefined;

const clearSaveFallback = (): void => {
	if (saveFallbackTimer !== undefined) {
		clearTimeout(saveFallbackTimer);
		saveFallbackTimer = undefined;
	}
};

const handleSave = (): void => {
	isSaving.value = true;
	remoteFormSubmit.value = true;

	// Fallback: the child form's submit() can throw on validation failure
	// without setting formResult to ERROR (it stays at WORKING forever).
	// Use a safety timer to reset the saving state if no result arrives.
	clearSaveFallback();

	saveFallbackTimer = setTimeout(() => {
		if (isSaving.value) {
			isSaving.value = false;
		}
	}, 5000);
};

const handleValidate = async (): Promise<void> => {
	if (!formConfig.value) return;

	isValidating.value = true;
	validationResult.value = null;

	try {
		const result = await configPluginsStore.validateConfig({
			data: { ...formConfig.value },
		});

		if (result.valid) {
			flashMessage.success(t('onboardingModule.integrations.configDialog.messages.validationSuccess'));
		} else {
			validationResult.value = result;

			// Flash errors that have no field (can't be shown inline)
			// or all errors when none could be mapped to form fields
			const allErrors = result.errors ?? [];
			const unmappedErrors = allErrors.filter((err) => !err.field);

			if (unmappedErrors.length > 0 || formFieldErrors.value.length === 0) {
				const toShow = unmappedErrors.length > 0 ? unmappedErrors : allErrors;

				flashMessage.error(toShow.map((err) => err.message).join('; '));
			}
		}
	} catch {
		validationResult.value = {
			valid: false,
			errors: [{ message: t('onboardingModule.integrations.configDialog.messages.validationError') }],
		};
	} finally {
		isValidating.value = false;
	}
};

watch(
	() => remoteFormResult.value,
	(val: FormResultType) => {
		if (val === FormResult.OK) {
			clearSaveFallback();
			isSaving.value = false;
			emit('saved');
			emit('update:visible', false);
		} else if (val === FormResult.ERROR) {
			clearSaveFallback();
			isSaving.value = false;
		} else if (val === FormResult.NONE && isSaving.value) {
			// FormResult transitions back to NONE via the composable's clear() timer
			// after both OK and ERROR states. Also catches edge cases.
			clearSaveFallback();
			isSaving.value = false;
		}
	}
);

// Clear validation errors when user modifies the form
watch(
	() => remoteFormChanged.value,
	(val: boolean) => {
		if (val && validationResult.value) {
			validationResult.value = null;
		}
	}
);

onBeforeUnmount(() => {
	clearSaveFallback();
});

watch(
	() => props.visible,
	(val: boolean) => {
		if (val) {
			void loadConfig();
		} else {
			// The form unmounts with the dialog, so what it reported (changed, result, submit/reset requests)
			// and what the dialog derived from it must not outlive it: the next form starts clean.
			loadGeneration++;
			formConfig.value = null;
			loadFailed.value = false;
			isLoading.value = false;
			clearSaveFallback();
			isSaving.value = false;
			validationResult.value = null;
			remoteFormSubmit.value = false;
			remoteFormReset.value = false;
			remoteFormResult.value = FormResult.NONE;
			remoteFormChanged.value = false;
		}
	}
);

onBeforeMount(() => {
	if (props.visible) {
		void loadConfig();
	}
});
</script>
