<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-alert
			type="info"
			:title="t('devicesHomeKitPlugin.headings.aboutSettings')"
			:description="t('devicesHomeKitPlugin.texts.aboutSettings')"
			:closable="false"
			class="mb-4!"
		/>

		<el-alert
			v-if="isOutOfSync"
			type="error"
			:title="t('devicesHomeKitPlugin.texts.outOfSyncTitle')"
			:closable="false"
			show-icon
			class="mb-4!"
		>
			<template #default>
				<p class="text-xs mt-1">
					{{ t('devicesHomeKitPlugin.texts.outOfSyncDescription') }}
				</p>
				<div class="mt-2">
					<el-button
						size="small"
						type="danger"
						plain
						:loading="isRetryingRefresh"
						@click="handleRetryRefresh"
					>
						{{ t('devicesHomeKitPlugin.buttons.retryRefresh') }}
					</el-button>
				</div>
			</template>
		</el-alert>

		<fieldset
			:disabled="isOutOfSync"
			class="border-0 p-0 m-0 min-w-0"
		>
			<el-form-item
				:label="t('devicesHomeKitPlugin.fields.config.enabled.title')"
				prop="enabled"
				label-position="left"
				class="mt-3 mb-4"
			>
				<el-switch
					v-model="model.enabled"
					name="enabled"
				/>
			</el-form-item>

			<!-- Bridge Status & Actions Card -->
			<el-card
				shadow="never"
				class="mb-4"
				header-class="py-2!"
				body-class="py-3!"
				footer-class="py-2! px-4!"
			>
				<template #header>
					<div class="flex items-center justify-between gap-2 flex-wrap">
						<span class="font-medium text-base text-gray-900 dark:text-gray-100">
							{{ store.status?.bridgeName || model.bridgeName }}
						</span>
						<div class="flex items-center gap-1.5 flex-wrap">
							<el-tag
								:type="store.status?.running ? 'success' : 'info'"
								size="small"
							>
								{{ store.status?.running ? t('devicesHomeKitPlugin.status.running') : t('devicesHomeKitPlugin.status.stopped') }}
							</el-tag>

							<el-tag
								v-if="store.status?.paired"
								type="success"
								effect="plain"
								size="small"
							>
								{{ t('devicesHomeKitPlugin.status.pairedWithCount', { count: store.status.pairedClientsCount }) }}
							</el-tag>
							<el-tag
								v-else-if="store.status?.running"
								type="warning"
								effect="plain"
								size="small"
							>
								{{ t('devicesHomeKitPlugin.status.notPaired') }}
							</el-tag>
						</div>
					</div>
				</template>

				<div class="flex flex-col gap-3">
					<span class="text-xs text-gray-500">
						{{ t('devicesHomeKitPlugin.status.exposedCount', { count: store.status?.exposedDevicesCount || 0 }) }}
					</span>

					<!-- QR Code preview if running -->
					<div
						v-if="store.status?.running && store.status?.qrCodeDataUri"
						class="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-4"
					>
						<img
							:src="store.status.qrCodeDataUri"
							alt="HomeKit QR Code"
							width="80"
							height="80"
							class="p-1 bg-white rounded border border-gray-200 shrink-0"
						/>
						<div class="flex flex-col gap-1 min-w-0">
							<span class="text-xs text-gray-500">{{ t('devicesHomeKitPlugin.wizard.setupCode') }}</span>
							<div class="flex items-center gap-2">
								<span class="text-lg font-mono font-bold">{{ store.status.pincode }}</span>
								<el-button
									size="small"
									circle
									@click="copyPinCode"
								>
									<el-icon><icon icon="mdi:content-copy" /></el-icon>
								</el-button>
							</div>
						</div>
					</div>
				</div>

				<template #footer>
					<div class="flex items-center justify-end gap-2 flex-nowrap">
						<el-button
							type="primary"
							:disabled="isOutOfSync"
							@click="openWizard('devices')"
						>
							<el-icon class="mr-1"><icon icon="mdi:cog" /></el-icon>
							{{ t('devicesHomeKitPlugin.buttons.configureDevices') }}
						</el-button>

						<el-tooltip :content="t('devicesHomeKitPlugin.buttons.showPairing')">
							<el-button
								v-if="store.status?.running"
								:disabled="isOutOfSync"
								:aria-label="t('devicesHomeKitPlugin.buttons.showPairing')"
								class="px-2!"
								@click="openWizard('pairing')"
							>
								<el-icon><icon icon="mdi:qrcode" /></el-icon>
							</el-button>
						</el-tooltip>

						<el-tooltip :content="t('devicesHomeKitPlugin.buttons.resetPairing')">
							<el-button
								v-if="store.status?.paired"
								type="danger"
								plain
								:disabled="isOutOfSync || store.resettingPairing"
								:loading="store.resettingPairing"
								:aria-label="t('devicesHomeKitPlugin.buttons.resetPairing')"
								class="px-2!"
								@click="onResetPairing"
							>
								<el-icon><icon icon="mdi:link-variant-off" /></el-icon>
							</el-button>
						</el-tooltip>
					</div>
				</template>
			</el-card>

			<el-form-item
				:label="t('devicesHomeKitPlugin.fields.config.name.title')"
				prop="bridgeName"
			>
				<el-input
					v-model="model.bridgeName"
					:placeholder="t('devicesHomeKitPlugin.fields.config.name.placeholder')"
					name="bridgeName"
				/>
				<div class="text-xs text-gray-500 mt-1">
					{{ t('devicesHomeKitPlugin.fields.config.name.description') }}
				</div>
			</el-form-item>

			<el-form-item
				:label="t('devicesHomeKitPlugin.fields.config.port.title')"
				prop="port"
			>
				<div class="flex flex-col gap-1.5 w-full">
					<el-input-number
						v-model="model.port"
						:min="1024"
						:max="65535"
						:step="1"
						:precision="0"
						:controls="false"
						name="port"
						class="w-full! port-input [&_input]:text-left!"
						@keydown="filterPortKeydown"
					/>
					<div class="text-xs text-gray-500">
						{{ t('devicesHomeKitPlugin.fields.config.port.description') }}
					</div>
				</div>
			</el-form-item>

			<el-form-item
				:label="t('devicesHomeKitPlugin.fields.config.pinCode.title')"
				prop="pincode"
			>
				<div class="flex flex-col gap-1.5 w-full">
					<el-input
						v-model="model.pincode"
						:placeholder="t('devicesHomeKitPlugin.fields.config.pinCode.placeholder')"
						name="pincode"
						maxlength="10"
						@input="onPinInput"
						@keydown="filterPinKeydown"
					>
						<template #suffix>
							<el-tooltip :content="t('devicesHomeKitPlugin.buttons.generatePin')">
								<el-button
									link
									:disabled="isOutOfSync"
									class="px-1!"
									@click="generateNewPin"
								>
									<el-icon :size="16"><icon icon="mdi:dice-multiple-outline" /></el-icon>
								</el-button>
							</el-tooltip>
						</template>
					</el-input>
					<div class="text-xs text-gray-500">
						{{ t('devicesHomeKitPlugin.fields.config.pinCode.description') }}
					</div>
				</div>
			</el-form-item>
		</fieldset>

		<!-- Wizard Dialog -->
		<HomeKitSetupWizard
			v-model:visible="wizardVisible"
			:initial-step="wizardInitialStep"
			@completed="onWizardCompleted"
		/>
	</el-form>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElCard,
	ElForm,
	ElFormItem,
	ElIcon,
	ElInput,
	ElInputNumber,
	ElMessageBox,
	ElSwitch,
	ElTag,
	ElTooltip,
	type FormRules,
} from 'element-plus';

import { Icon } from '@iconify/vue';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { IConfigPlugin } from '../../../modules/config/store/config-plugins.store.types';
import { configPluginsStoreKey } from '../../../modules/config/store/keys';
import { DEVICES_HOMEKIT_PLUGIN_NAME } from '../devices-homekit.constants';
import type { IHomeKitConfigEditForm } from '../schemas/config.types';
import { useHomeKitBridge } from '../store/homekit-bridge.store';

import type { IHomeKitConfigFormProps } from './homekit-config-form.types';
import type { HomeKitWizardStep } from './homekit-setup-wizard.types';
import HomeKitSetupWizard from './homekit-setup-wizard.vue';

defineOptions({
	name: 'HomeKitConfigForm',
});

const props = withDefaults(defineProps<IHomeKitConfigFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
	layout: Layout.DEFAULT,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();
const store = useHomeKitBridge();
const storesManager = injectStoresManager();
const configPluginsStore = storesManager.getStore(configPluginsStoreKey);

const { formEl, model, formChanged, submit, formResult, markSaved, reconcile } = useConfigPluginEditForm<IHomeKitConfigEditForm>({
	config: props.config,
	messages: {
		success: t('devicesHomeKitPlugin.messages.config.edited'),
		error: t('devicesHomeKitPlugin.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IHomeKitConfigEditForm>>({
	bridgeName: [{ required: true, message: t('devicesHomeKitPlugin.fields.config.name.validation.required'), trigger: 'blur' }],
	port: [{ required: true, message: t('devicesHomeKitPlugin.fields.config.port.validation.required'), trigger: 'blur' }],
	pincode: [
		{
			required: true,
			pattern: /^\d{3}-\d{2}-\d{3}$/,
			message: t('devicesHomeKitPlugin.fields.config.pinCode.validation.format'),
			trigger: 'blur',
		},
	],
});

const wizardVisible = ref(false);
const wizardInitialStep = ref<HomeKitWizardStep>('devices');
const isOutOfSync = ref(false);
const isRetryingRefresh = ref(false);

const filterPortKeydown = (e: Event | KeyboardEvent): void => {
	if (!(e instanceof KeyboardEvent)) {
		return;
	}
	if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key) || e.ctrlKey || e.metaKey) {
		return;
	}
	if (!/^[0-9]$/.test(e.key)) {
		e.preventDefault();
	}
};

const filterPinKeydown = (e: Event | KeyboardEvent): void => {
	if (!(e instanceof KeyboardEvent)) {
		return;
	}
	if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key) || e.ctrlKey || e.metaKey) {
		return;
	}
	if (!/^[0-9]$/.test(e.key)) {
		e.preventDefault();
	}
};

const onPinInput = (val: string): void => {
	const digits = val.replace(/\D/g, '').slice(0, 8);
	let formatted = '';
	if (digits.length <= 3) {
		formatted = digits;
	} else if (digits.length <= 5) {
		formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
	} else {
		formatted = `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 8)}`;
	}
	model.pincode = formatted;
};

const generateNewPin = (): void => {
	const p1 = Math.floor(100 + Math.random() * 900);
	const p2 = Math.floor(10 + Math.random() * 90);
	const p3 = Math.floor(100 + Math.random() * 900);
	model.pincode = `${p1}-${p2}-${p3}`;
};

const refreshPluginConfig = async (): Promise<void> => {
	try {
		const freshConfig = (await configPluginsStore.get({
			type: DEVICES_HOMEKIT_PLUGIN_NAME,
			force: true,
		})) as IConfigPlugin | undefined;

		if (freshConfig) {
			reconcile(freshConfig);
			markSaved();
			isOutOfSync.value = false;
		}
	} catch (error) {
		isOutOfSync.value = true;
		throw error;
	}
};

const handleRetryRefresh = async (): Promise<void> => {
	isRetryingRefresh.value = true;
	try {
		await refreshPluginConfig();
		await store.fetchStatus();
		flashMessage.success(t('devicesHomeKitPlugin.messages.refreshSuccess'));
	} catch {
		flashMessage.error(t('devicesHomeKitPlugin.messages.refreshFailed'));
	} finally {
		isRetryingRefresh.value = false;
	}
};

const openWizard = (step: HomeKitWizardStep): void => {
	if (isOutOfSync.value) {
		flashMessage.error(t('devicesHomeKitPlugin.messages.outOfSyncBlock'));
		return;
	}

	if (formChanged.value) {
		flashMessage.warning(t('devicesHomeKitPlugin.messages.saveBeforeAction'));
		return;
	}

	wizardInitialStep.value = step;
	wizardVisible.value = true;
};

const onWizardCompleted = async (): Promise<void> => {
	try {
		await refreshPluginConfig();
		await store.fetchStatus();
	} catch {
		// Handled in store
	}
};

const copyPinCode = async (): Promise<void> => {
	if (!store.status?.pincode) return;

	try {
		await navigator.clipboard.writeText(store.status.pincode);
		flashMessage.success(t('devicesHomeKitPlugin.messages.pinCopied'));
	} catch {
		flashMessage.error(t('devicesHomeKitPlugin.messages.copyFailed'));
	}
};

const onResetPairing = async (): Promise<void> => {
	if (isOutOfSync.value) {
		flashMessage.error(t('devicesHomeKitPlugin.messages.outOfSyncBlock'));
		return;
	}

	if (formChanged.value) {
		flashMessage.warning(t('devicesHomeKitPlugin.messages.saveBeforeAction'));
		return;
	}

	try {
		await ElMessageBox.confirm(t('devicesHomeKitPlugin.messages.confirmResetPairing'), t('devicesHomeKitPlugin.headings.resetPairing'), {
			type: 'warning',
			confirmButtonText: t('devicesHomeKitPlugin.buttons.resetPairing'),
			cancelButtonText: t('devicesHomeKitPlugin.wizard.buttons.cancel'),
		});

		await store.resetPairing();
		await refreshPluginConfig();
		flashMessage.success(t('devicesHomeKitPlugin.messages.pairingResetSuccess'));
	} catch (error) {
		if (error !== 'cancel') {
			flashMessage.error(t('devicesHomeKitPlugin.messages.pairingResetFailed'));
		}
	}
};

watch(
	(): FormResultType => formResult.value,
	async (val: FormResultType): Promise<void> => {
		emit('update:remote-form-result', val);
	}
);

watch(
	(): boolean => props.remoteFormSubmit,
	async (val: boolean): Promise<void> => {
		if (val) {
			emit('update:remote-form-submit', false);

			if (isOutOfSync.value) {
				flashMessage.error(t('devicesHomeKitPlugin.messages.outOfSyncBlock'));
				return;
			}

			submit().catch(() => {
				// Form invalid
			});
		}
	}
);

watch(
	(): boolean => props.remoteFormReset,
	(val: boolean): void => {
		emit('update:remote-form-reset', false);

		if (val) {
			if (!formEl.value) return;

			formEl.value.resetFields();
		}
	}
);

watch(
	(): boolean => formChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);

onMounted(async () => {
	try {
		await store.fetchStatus();
	} catch {
		// Handled in store
	}
});
</script>

<style scoped>
:deep(.port-input .el-input__inner) {
	text-align: left;
}
</style>
