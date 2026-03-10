<template>
	<el-dialog
		:model-value="visible"
		:title="t('onboardingModule.integrations.configDialog.title', { name: pluginName })"
		width="560px"
		:close-on-click-modal="false"
		@update:model-value="(val: boolean) => emit('update:visible', val)"
	>
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
		<template #footer>
			<div class="flex justify-end gap-2">
				<el-button @click="emit('update:visible', false)">
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
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDialog, ElEmpty, vLoading } from 'element-plus';

import { injectStoresManager } from '../../../common';
import { CONFIG_MODULE_PLUGIN_TYPE, FormResult, type FormResultType } from '../../../modules/config/config.constants';
import type { IPluginsComponents, IPluginsSchemas } from '../../../modules/config/config.types';
import { configPluginsStoreKey } from '../../../modules/config/store/keys';
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
const storesManager = injectStoresManager();
const configPluginsStore = storesManager.getStore(configPluginsStoreKey);
const { getByName } = usePlugins();

const isLoading = ref(false);
const isSaving = ref(false);
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

const handleSave = (): void => {
	isSaving.value = true;
	remoteFormSubmit.value = true;
};

watch(
	() => remoteFormResult.value,
	(val: FormResultType) => {
		if (val === FormResult.OK) {
			isSaving.value = false;
			emit('saved');
			emit('update:visible', false);
		} else if (val === FormResult.ERROR) {
			isSaving.value = false;
		}
	}
);

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
