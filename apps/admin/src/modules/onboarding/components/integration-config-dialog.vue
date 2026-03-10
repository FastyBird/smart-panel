<template>
	<el-dialog
		:model-value="visible"
		:title="t('onboardingModule.integrations.configDialog.title', { name: pluginName })"
		width="560px"
		:close-on-click-modal="false"
		@update:model-value="(val: boolean) => emit('update:visible', val)"
	>
		<el-scrollbar max-height="60vh">
			<div
				v-loading="isLoading"
				class="min-h-[120px]"
			>
				<component
					:is="configFormComponent"
					v-if="configPlugin && configFormComponent"
					v-model:remote-form-submit="remoteFormSubmit"
					v-model:remote-form-result="remoteFormResult"
					v-model:remote-form-reset="remoteFormReset"
					v-model:remote-form-changed="remoteFormChanged"
					:config="configPlugin"
				/>
				<el-empty
					v-else-if="!isLoading"
					:description="t('onboardingModule.integrations.configDialog.noConfig')"
				/>
			</div>
		</el-scrollbar>
		<!-- Validation errors -->
		<div
			v-if="validationResult && !validationResult.valid"
			class="mt-3 px-1"
		>
			<el-alert
				type="error"
				:title="t('onboardingModule.integrations.configDialog.messages.validationFailed')"
				:closable="true"
				show-icon
				@close="validationResult = null"
			>
				<template
					v-if="validationResult.errors?.length"
					#default
				>
					<ul class="list-disc pl-4 mt-1 text-xs">
						<li
							v-for="(err, idx) in validationResult.errors"
							:key="idx"
						>
							<span v-if="err.field">{{ err.field }}: </span>{{ err.message }}
						</li>
					</ul>
				</template>
			</el-alert>
		</div>
		<template #footer>
			<div class="flex justify-between">
				<el-button @click="emit('update:visible', false)">
					{{ t('onboardingModule.integrations.configDialog.buttons.cancel') }}
				</el-button>
				<div class="flex gap-2">
					<el-button
						:loading="isValidating"
						:disabled="!remoteFormChanged"
						@click="handleValidate"
					>
						{{ t('onboardingModule.integrations.configDialog.buttons.validate') }}
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

import { ElAlert, ElButton, ElDialog, ElEmpty, ElScrollbar, vLoading } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { CONFIG_MODULE_PLUGIN_TYPE, FormResult, type FormResultType } from '../../../modules/config/config.constants';
import type { IPluginsComponents, IPluginsSchemas } from '../../../modules/config/config.types';
import { configPluginsStoreKey } from '../../../modules/config/store/keys';
import type { IConfigPluginValidationResult } from '../../../modules/config/store/config-plugins.store.types';
import { usePlugins } from '../../../modules/config/composables/usePlugins';

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
const { getByName } = usePlugins();

const isLoading = ref(false);
const isSaving = ref(false);
const isValidating = ref(false);
const validationResult = ref<IConfigPluginValidationResult | null>(null);
const remoteFormSubmit = ref(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormReset = ref(false);
const remoteFormChanged = ref(false);

const plugin = computed(() => getByName(props.pluginType));

const configFormComponent = computed(() => {
	const element = plugin.value?.elements?.find(
		(el: { type: string; components?: IPluginsComponents; schemas?: IPluginsSchemas }) => el.type === CONFIG_MODULE_PLUGIN_TYPE
	);
	return element?.components?.pluginConfigEditForm ?? null;
});

const configPlugin = computed(() => configPluginsStore.findByType(props.pluginType));

const fetchConfig = async (): Promise<void> => {
	if (configPlugin.value) return;

	isLoading.value = true;

	try {
		await configPluginsStore.get({ type: props.pluginType });
	} catch {
		// Config may not exist yet
	} finally {
		isLoading.value = false;
	}
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
	if (!configPlugin.value) return;

	isValidating.value = true;
	validationResult.value = null;

	try {
		const result = await configPluginsStore.validateConfig({
			data: { ...configPlugin.value },
		});

		if (result.valid) {
			flashMessage.success(t('onboardingModule.integrations.configDialog.messages.validationSuccess'));
		} else {
			validationResult.value = result;
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

onBeforeUnmount(() => {
	clearSaveFallback();
});

watch(
	() => props.visible,
	(val: boolean) => {
		if (val) {
			fetchConfig();
		}
	}
);

onBeforeMount(() => {
	if (props.visible) {
		fetchConfig();
	}
});
</script>
