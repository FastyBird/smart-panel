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
			:title="t('buddyWhatsappPlugin.headings.aboutWhatsappSettings')"
			:description="t('buddyWhatsappPlugin.texts.aboutWhatsappSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('buddyWhatsappPlugin.fields.config.enabled.title')"
			prop="enabled"
			label-position="left"
			class="mt-3"
		>
			<el-switch
				v-model="model.enabled"
				name="enabled"
			/>
		</el-form-item>

		<!-- Connection status & QR code -->
		<div
			v-if="model.enabled"
			class="mb-4"
		>
			<el-alert
				v-if="connectionStatus === 'connected'"
				type="success"
				:title="t('buddyWhatsappPlugin.texts.status.connected')"
				:closable="false"
			>
				<template #default>
					<el-button
						type="danger"
						plain
						size="small"
						class="mt-2"
						@click="handleLogout"
					>
						{{ t('buddyWhatsappPlugin.buttons.logout') }}
					</el-button>
				</template>
			</el-alert>

			<template v-else-if="connectionStatus === 'qr_ready' && qrDataUrl">
				<el-alert
					type="warning"
					:title="t('buddyWhatsappPlugin.texts.status.qrReady')"
					:closable="false"
				/>
				<div class="flex justify-center mt-3">
					<img
						:src="qrDataUrl"
						alt="WhatsApp QR Code"
						class="rounded"
						style="width: 260px; height: 260px"
					/>
				</div>
			</template>

			<el-alert
				v-else-if="connectionStatus === 'connecting'"
				type="info"
				:title="t('buddyWhatsappPlugin.texts.status.connecting')"
				:closable="false"
			/>

			<el-alert
				v-else
				type="warning"
				:title="t('buddyWhatsappPlugin.texts.status.disconnected')"
				:closable="false"
			/>
		</div>

		<el-form-item
			:label="t('buddyWhatsappPlugin.fields.config.allowedPhoneNumbers.title')"
			prop="allowedPhoneNumbers"
		>
			<el-input
				v-model="model.allowedPhoneNumbers"
				:placeholder="t('buddyWhatsappPlugin.fields.config.allowedPhoneNumbers.placeholder')"
				name="allowedPhoneNumbers"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyWhatsappPlugin.fields.config.allowedPhoneNumbers.description') }}
			</div>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import QRCode from 'qrcode';
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElForm, ElFormItem, ElInput, ElSwitch, type FormRules } from 'element-plus';

import { injectStoresManager } from '../../../common';
import { sessionStoreKey } from '../../../modules/auth/store/keys';
import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { IWhatsappConfigEditForm } from '../schemas/config.types';

import type { IWhatsappConfigFormProps } from './whatsapp-config-form.types';

defineOptions({
	name: 'WhatsappConfigForm',
});

const props = withDefaults(defineProps<IWhatsappConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IWhatsappConfigEditForm>({
	config: props.config,
	messages: {
		success: t('buddyWhatsappPlugin.messages.config.edited'),
		error: t('buddyWhatsappPlugin.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IWhatsappConfigEditForm>>({});

const storesManager = injectStoresManager();
const sessionStore = storesManager.getStore(sessionStoreKey);

const connectionStatus = ref<string>('disconnected');
const qrDataUrl = ref<string | null>(null);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const backendBaseUrl = `${window.location.protocol}//${window.location.hostname}:${import.meta.env.MODE === 'development' ? import.meta.env.FB_ADMIN_PORT : import.meta.env.FB_BACKEND_PORT}/api/v1`;

const authHeaders = (): HeadersInit => {
	const token = sessionStore.accessToken();

	return token ? { Authorization: `Bearer ${token}` } : {};
};

const fetchStatus = async (): Promise<void> => {
	try {
		const res = await fetch(`${backendBaseUrl}/plugins/buddy-whatsapp/status`, {
			headers: authHeaders(),
		});
		const json = (await res.json()) as { data: { status: string; qr: string | null } };

		connectionStatus.value = json.data.status;

		if (json.data.qr) {
			qrDataUrl.value = await QRCode.toDataURL(json.data.qr, { width: 260, margin: 2 });
		} else {
			qrDataUrl.value = null;
		}
	} catch {
		// Ignore fetch errors
	}
};

const handleLogout = async (): Promise<void> => {
	try {
		await fetch(`${backendBaseUrl}/plugins/buddy-whatsapp/logout`, {
			method: 'POST',
			headers: authHeaders(),
		});

		startPolling();
	} catch {
		// Ignore
	}
};

const startPolling = (): void => {
	stopPolling();

	void fetchStatus();

	// Poll faster while waiting for QR/connection, slower once connected
	pollTimer = setInterval(() => {
		if (connectionStatus.value === 'connected') {
			stopPolling();

			return;
		}

		void fetchStatus();
	}, 3000);
};

const stopPolling = (): void => {
	if (pollTimer) {
		clearInterval(pollTimer);
		pollTimer = null;
	}
};

onMounted(() => {
	if (model.enabled) {
		startPolling();
	}
});

onBeforeUnmount(() => {
	stopPolling();
});

watch(
	() => model.enabled,
	(enabled) => {
		if (enabled) {
			startPolling();
		} else {
			stopPolling();
			connectionStatus.value = 'disconnected';
			qrDataUrl.value = null;
		}
	}
);

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
				// The form is not valid
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
</script>
