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

		<!-- Bridge Status & Actions Card -->
		<el-card
			shadow="never"
			class="mb-4 bg-gray-50 dark:bg-gray-800/50"
		>
			<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
				<div class="flex flex-col gap-2">
					<div class="flex items-center gap-2">
						<span class="font-semibold text-gray-900 dark:text-gray-100">
							{{ t('devicesHomeKitPlugin.headings.bridgeStatus') }}
						</span>
						<el-tag
							v-if="store.status?.running"
							type="success"
							size="small"
						>
							{{ t('devicesHomeKitPlugin.status.running') }}
						</el-tag>
						<el-tag
							v-else
							type="info"
							size="small"
						>
							{{ t('devicesHomeKitPlugin.status.stopped') }}
						</el-tag>

						<el-tag
							v-if="store.status?.paired"
							type="success"
							effect="dark"
							size="small"
						>
							{{ t('devicesHomeKitPlugin.status.pairedWithCount', { count: store.status.pairedClientsCount }) }}
						</el-tag>
						<el-tag
							v-else
							type="warning"
							effect="plain"
							size="small"
						>
							{{ t('devicesHomeKitPlugin.status.notPaired') }}
						</el-tag>
					</div>

					<span class="text-xs text-gray-500">
						{{ t('devicesHomeKitPlugin.status.exposedCount', { count: store.status?.exposedDevicesCount || 0 }) }}
					</span>
				</div>

				<div class="flex items-center gap-2 w-full sm:w-auto">
					<el-button
						type="primary"
						@click="openWizard('devices')"
					>
						<el-icon class="mr-1"><icon icon="mdi:cog" /></el-icon>
						{{ t('devicesHomeKitPlugin.buttons.configureDevices') }}
					</el-button>

					<el-button
						v-if="store.status?.running"
						@click="openWizard('pairing')"
					>
						<el-icon class="mr-1"><icon icon="mdi:qrcode" /></el-icon>
						{{ t('devicesHomeKitPlugin.buttons.showPairing') }}
					</el-button>

					<el-button
						v-if="store.status?.paired"
						type="danger"
						plain
						:loading="store.resettingPairing"
						@click="onResetPairing"
					>
						{{ t('devicesHomeKitPlugin.buttons.resetPairing') }}
					</el-button>
				</div>
			</div>

			<!-- QR Code preview if running -->
			<div
				v-if="store.status?.running && store.status?.qrCodeDataUri"
				class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4"
			>
				<img
					:src="store.status.qrCodeDataUri"
					alt="HomeKit QR Code"
					width="80"
					height="80"
					class="p-1 bg-white rounded border border-gray-200"
				/>
				<div class="flex flex-col gap-1">
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
		</el-card>

		<!-- General Settings -->
		<el-form-item
			:label="t('devicesHomeKitPlugin.fields.config.enabled.title')"
			prop="enabled"
			label-position="left"
			class="mt-3"
		>
			<el-switch
				v-model="model.enabled"
				name="enabled"
			/>
		</el-form-item>

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
			<el-input-number
				v-model="model.port"
				:min="1024"
				:max="65535"
				name="port"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('devicesHomeKitPlugin.fields.config.port.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('devicesHomeKitPlugin.fields.config.pinCode.title')"
			prop="pincode"
		>
			<el-input
				v-model="model.pincode"
				:placeholder="t('devicesHomeKitPlugin.fields.config.pinCode.placeholder')"
				name="pincode"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('devicesHomeKitPlugin.fields.config.pinCode.description') }}
			</div>
		</el-form-item>

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
	type FormRules,
} from 'element-plus';

import { Icon } from '@iconify/vue';

import { useFlashMessage } from '../../../common';
import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { IHomeKitConfigEditForm } from '../schemas/config.types';
import { useHomeKitBridge } from '../store/homekit-bridge.store';

import type { IHomeKitConfigFormProps } from './homekit-config-form.types';
import HomeKitSetupWizard from './homekit-setup-wizard.vue';
import type { HomeKitWizardStep } from './homekit-setup-wizard.types';

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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IHomeKitConfigEditForm>({
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

const openWizard = (step: HomeKitWizardStep): void => {
	wizardInitialStep.value = step;
	wizardVisible.value = true;
};

const onWizardCompleted = async (): Promise<void> => {
	try {
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
	try {
		await ElMessageBox.confirm(
			t('devicesHomeKitPlugin.messages.confirmResetPairing'),
			t('devicesHomeKitPlugin.headings.resetPairing'),
			{
				type: 'warning',
				confirmButtonText: t('devicesHomeKitPlugin.buttons.resetPairing'),
				cancelButtonText: t('devicesHomeKitPlugin.wizard.buttons.cancel'),
			}
		);

		await store.resetPairing();
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
