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
			:title="t('buddyOpenaiCodexPlugin.headings.aboutApiSettings')"
			:description="t('buddyOpenaiCodexPlugin.texts.aboutApiSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('buddyOpenaiCodexPlugin.fields.config.enabled.title')"
			prop="enabled"
			label-position="left"
			class="mt-3"
		>
			<el-switch
				v-model="model.enabled"
				name="enabled"
			/>
		</el-form-item>

		<div class="mt-3 mb-4">
			<div class="flex items-center gap-3">
				<template v-if="!isConnected">
					<el-button
						type="primary"
						:loading="isLoadingUrl"
						@click="handleGetUrl"
					>
						{{ t('buddyOpenaiCodexPlugin.buttons.getUrl') }}
					</el-button>
					<el-tag
						type="info"
						effect="light"
					>
						{{ t('buddyOpenaiCodexPlugin.statuses.notConnected') }}
					</el-tag>
				</template>
				<template v-else>
					<el-button
						type="danger"
						@click="handleDisconnect"
					>
						{{ t('buddyOpenaiCodexPlugin.buttons.disconnect') }}
					</el-button>
					<el-tag
						type="success"
						effect="light"
					>
						{{ t('buddyOpenaiCodexPlugin.statuses.connected') }}
					</el-tag>
				</template>
			</div>

			<template v-if="!isConnected && authorizeUrl">
				<el-alert
					type="info"
					:closable="false"
					show-icon
					class="mt-2!"
				>
					<ol class="list-decimal list-inside m-0 p-0 text-xs leading-relaxed">
						<li>{{ t('buddyOpenaiCodexPlugin.texts.oauthStep1') }}</li>
						<li>{{ t('buddyOpenaiCodexPlugin.texts.oauthStep2') }}</li>
						<li>{{ t('buddyOpenaiCodexPlugin.texts.oauthStep3') }}</li>
						<li>{{ t('buddyOpenaiCodexPlugin.texts.oauthStep4') }}</li>
					</ol>
				</el-alert>

				<div class="mt-3">
					<el-input
						:model-value="authorizeUrl"
						readonly
					>
						<template #append>
							<el-button @click="handleCopyUrl">
								{{ t('buddyOpenaiCodexPlugin.buttons.copyUrl') }}
							</el-button>
							<el-button @click="handleOpenUrl">
								{{ t('buddyOpenaiCodexPlugin.buttons.openUrl') }}
							</el-button>
						</template>
					</el-input>
				</div>

				<div class="mt-3">
					<el-input
						v-model="callbackUrl"
						:placeholder="t('buddyOpenaiCodexPlugin.fields.config.callbackUrl.placeholder')"
					/>
				</div>

				<div class="mt-2">
					<el-button
						type="success"
						:loading="isExchanging"
						:disabled="!callbackUrl"
						@click="handleExchange"
					>
						{{ isExchanging ? t('buddyOpenaiCodexPlugin.buttons.exchanging') : t('buddyOpenaiCodexPlugin.buttons.exchange') }}
					</el-button>
				</div>
			</template>

		</div>

		<el-form-item
			:label="t('buddyOpenaiCodexPlugin.fields.config.clientId.title')"
			prop="clientId"
		>
			<el-input
				v-model="model.clientId"
				:placeholder="t('buddyOpenaiCodexPlugin.fields.config.clientId.placeholder')"
				name="clientId"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyOpenaiCodexPlugin.fields.config.clientId.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('buddyOpenaiCodexPlugin.fields.config.model.title')"
			prop="model"
		>
			<el-select
				v-model="model.model"
				:placeholder="t('buddyOpenaiCodexPlugin.fields.config.model.placeholder')"
				filterable
				allow-create
				default-first-option
				class="w-full"
			>
				<el-option
					v-for="option in modelOptions"
					:key="option"
					:label="option"
					:value="option"
				/>
			</el-select>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyOpenaiCodexPlugin.fields.config.model.description') }}
			</div>
		</el-form-item>

		<el-collapse class="mt-3">
			<el-collapse-item :title="t('buddyOpenaiCodexPlugin.headings.advancedSettings')">
				<el-form-item
					:label="t('buddyOpenaiCodexPlugin.fields.config.clientSecret.title')"
					prop="clientSecret"
				>
					<el-input
						v-model="model.clientSecret"
						:placeholder="t('buddyOpenaiCodexPlugin.fields.config.clientSecret.placeholder')"
						name="clientSecret"
						type="password"
						show-password
					/>
				</el-form-item>

				<el-form-item
					:label="t('buddyOpenaiCodexPlugin.fields.config.accessToken.title')"
					prop="accessToken"
				>
					<el-input
						v-model="model.accessToken"
						:placeholder="t('buddyOpenaiCodexPlugin.fields.config.accessToken.placeholder')"
						name="accessToken"
						type="password"
						show-password
					/>
				</el-form-item>

				<el-form-item
					:label="t('buddyOpenaiCodexPlugin.fields.config.refreshToken.title')"
					prop="refreshToken"
				>
					<el-input
						v-model="model.refreshToken"
						:placeholder="t('buddyOpenaiCodexPlugin.fields.config.refreshToken.placeholder')"
						name="refreshToken"
						type="password"
						show-password
					/>
				</el-form-item>
			</el-collapse-item>
		</el-collapse>
	</el-form>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElCollapse,
	ElCollapseItem,
	ElForm,
	ElFormItem,
	ElInput,
	ElOption,
	ElSelect,
	ElSwitch,
	ElTag,
	type FormRules,
} from 'element-plus';

import { useFlashMessage } from '../../../common/composables/useFlashMessage';
import { injectStoresManager } from '../../../common/services/store';
import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import { configPluginsStoreKey } from '../../../modules/config/store/keys';
import { BUDDY_OPENAI_CODEX_MODELS } from '../buddy-openai-codex.models';
import { BUDDY_OPENAI_CODEX_PLUGIN_NAME, BUDDY_OPENAI_CODEX_PLUGIN_PREFIX } from '../buddy-openai-codex.constants';
import type { IOpenAiCodexConfigEditForm } from '../schemas/config.types';

import type { IOpenAiCodexConfigFormProps } from './openai-codex-config-form.types';

defineOptions({
	name: 'OpenAiCodexConfigForm',
});

const props = withDefaults(defineProps<IOpenAiCodexConfigFormProps>(), {
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

const storesManager = injectStoresManager();
const configPluginsStore = storesManager.getStore(configPluginsStoreKey);

const { formEl, model, formChanged, submit, formResult, markSaved } = useConfigPluginEditForm<IOpenAiCodexConfigEditForm>({
	config: props.config,
	messages: {
		success: t('buddyOpenaiCodexPlugin.messages.config.edited'),
		error: t('buddyOpenaiCodexPlugin.messages.config.notEdited'),
	},
});

const modelOptions = BUDDY_OPENAI_CODEX_MODELS;

const rules = reactive<FormRules<IOpenAiCodexConfigEditForm>>({});

const authorizeUrl = ref<string | null>(null);
const callbackUrl = ref<string>('');
const isLoadingUrl = ref<boolean>(false);
const isExchanging = ref<boolean>(false);

const isConnected = computed<boolean>(() => {
	return !!(model.accessToken || model.refreshToken);
});

const handleDisconnect = (): void => {
	model.accessToken = '';
	model.refreshToken = '';
	authorizeUrl.value = null;
	callbackUrl.value = '';

	submit();
};

const handleGetUrl = async (): Promise<void> => {
	isLoadingUrl.value = true;
	authorizeUrl.value = null;
	callbackUrl.value = '';

	try {
		const clientId = model.clientId || 'app_EMoamEEZ73f0CkXaXp7hrann';
		const endpoint = `/api/v1/plugins/${BUDDY_OPENAI_CODEX_PLUGIN_PREFIX}/oauth/authorize?client_id=${encodeURIComponent(clientId)}`;

		const response = await fetch(endpoint);

		if (!response.ok) {
			throw new Error(`Failed to get authorization URL: ${response.status}`);
		}

		const result = (await response.json()) as { data: { authorize_url: string } };

		authorizeUrl.value = result.data.authorize_url;
	} catch (error) {
		flashMessage.error(error instanceof Error ? error.message : t('buddyOpenaiCodexPlugin.messages.oauth.exchangeError'));
	} finally {
		isLoadingUrl.value = false;
	}
};

const handleCopyUrl = async (): Promise<void> => {
	if (!authorizeUrl.value) return;

	try {
		await navigator.clipboard.writeText(authorizeUrl.value);
	} catch {
		// Clipboard API not available
	}
};

const handleOpenUrl = (): void => {
	if (!authorizeUrl.value) return;

	window.open(authorizeUrl.value, '_blank');
};

const handleExchange = async (): Promise<void> => {
	if (!callbackUrl.value) return;

	isExchanging.value = true;

	try {
		const endpoint = `/api/v1/plugins/${BUDDY_OPENAI_CODEX_PLUGIN_PREFIX}/oauth/exchange`;

		const response = await fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ callback_url: callbackUrl.value }),
		});

		if (!response.ok) {
			throw new Error(`Exchange failed: ${response.status}`);
		}

		const result = (await response.json()) as { data: { success: boolean; error?: string } };

		if (!result.data.success) {
			throw new Error(result.data.error || t('buddyOpenaiCodexPlugin.messages.oauth.exchangeError'));
		}

		const updatedConfig = await configPluginsStore.get({ type: BUDDY_OPENAI_CODEX_PLUGIN_NAME });

		if (updatedConfig.clientId) {
			model.clientId = updatedConfig.clientId as string;
		}

		if (updatedConfig.accessToken) {
			model.accessToken = updatedConfig.accessToken as string;
		}

		if (updatedConfig.refreshToken) {
			model.refreshToken = updatedConfig.refreshToken as string;
		}

		markSaved();

		authorizeUrl.value = null;
		callbackUrl.value = '';
	} catch (error) {
		flashMessage.error(error instanceof Error ? error.message : t('buddyOpenaiCodexPlugin.messages.oauth.exchangeError'));
	} finally {
		isExchanging.value = false;
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
