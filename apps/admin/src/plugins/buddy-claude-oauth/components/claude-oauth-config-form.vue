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
			:title="t('buddyClaudeOauthPlugin.headings.aboutApiSettings')"
			:description="t('buddyClaudeOauthPlugin.texts.aboutApiSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('buddyClaudeOauthPlugin.fields.config.enabled.title')"
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
				<el-button
					type="primary"
					:loading="isAuthorizing"
					@click="handleAuthorize"
				>
					{{ isAuthorizing ? t('buddyClaudeOauthPlugin.buttons.authorizing') : t('buddyClaudeOauthPlugin.buttons.authorize') }}
				</el-button>
				<el-tag
					:type="isConnected ? 'success' : 'info'"
					effect="light"
				>
					{{ isConnected ? t('buddyClaudeOauthPlugin.statuses.connected') : t('buddyClaudeOauthPlugin.statuses.notConnected') }}
				</el-tag>
			</div>
			</div>

		<el-form-item
			:label="t('buddyClaudeOauthPlugin.fields.config.clientId.title')"
			prop="clientId"
		>
			<el-input
				v-model="model.clientId"
				:placeholder="t('buddyClaudeOauthPlugin.fields.config.clientId.placeholder')"
				name="clientId"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyClaudeOauthPlugin.fields.config.clientId.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('buddyClaudeOauthPlugin.fields.config.model.title')"
			prop="model"
		>
			<el-input
				v-model="model.model"
				:placeholder="t('buddyClaudeOauthPlugin.fields.config.model.placeholder')"
				name="model"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyClaudeOauthPlugin.fields.config.model.description') }}
			</div>
		</el-form-item>

		<el-collapse class="mt-3">
			<el-collapse-item :title="t('buddyClaudeOauthPlugin.headings.advancedSettings')">
				<el-form-item
					:label="t('buddyClaudeOauthPlugin.fields.config.clientSecret.title')"
					prop="clientSecret"
				>
					<el-input
						v-model="model.clientSecret"
						:placeholder="t('buddyClaudeOauthPlugin.fields.config.clientSecret.placeholder')"
						name="clientSecret"
						type="password"
						show-password
					/>
				</el-form-item>

				<el-form-item
					:label="t('buddyClaudeOauthPlugin.fields.config.accessToken.title')"
					prop="accessToken"
				>
					<el-input
						v-model="model.accessToken"
						:placeholder="t('buddyClaudeOauthPlugin.fields.config.accessToken.placeholder')"
						name="accessToken"
						type="password"
						show-password
					/>
				</el-form-item>

				<el-form-item
					:label="t('buddyClaudeOauthPlugin.fields.config.refreshToken.title')"
					prop="refreshToken"
				>
					<el-input
						v-model="model.refreshToken"
						:placeholder="t('buddyClaudeOauthPlugin.fields.config.refreshToken.placeholder')"
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
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCollapse, ElCollapseItem, ElForm, ElFormItem, ElInput, ElSwitch, ElTag, type FormRules } from 'element-plus';

import { useFlashMessage } from '../../../common/composables/useFlashMessage';
import { useOAuthPopup } from '../../../common/composables/useOAuthPopup';
import { injectStoresManager } from '../../../common/services/store';
import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import { configPluginsStoreKey } from '../../../modules/config/store/keys';
import { BUDDY_CLAUDE_OAUTH_PLUGIN_NAME, BUDDY_CLAUDE_OAUTH_PLUGIN_PREFIX } from '../buddy-claude-oauth.constants';
import type { IClaudeOauthConfigEditForm } from '../schemas/config.types';

import type { IClaudeOauthConfigFormProps } from './claude-oauth-config-form.types';

defineOptions({
	name: 'ClaudeOauthConfigForm',
});

const props = withDefaults(defineProps<IClaudeOauthConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult, markSaved } = useConfigPluginEditForm<IClaudeOauthConfigEditForm>({
	config: props.config,
	messages: {
		success: t('buddyClaudeOauthPlugin.messages.config.edited'),
		error: t('buddyClaudeOauthPlugin.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IClaudeOauthConfigEditForm>>({});

const { isAuthorizing, authError, startOAuth } = useOAuthPopup(BUDDY_CLAUDE_OAUTH_PLUGIN_NAME);

const isConnected = computed<boolean>(() => {
	return !!(model.accessToken || model.refreshToken);
});

const handleAuthorize = async (): Promise<void> => {
	const clientId = model.clientId || '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
	const authorizeEndpoint = `/api/v1/plugins/${BUDDY_CLAUDE_OAUTH_PLUGIN_PREFIX}/oauth/authorize`;

	const success = await startOAuth(authorizeEndpoint, clientId);

	if (success) {
		try {
			const updatedConfig = await configPluginsStore.get({ type: BUDDY_CLAUDE_OAUTH_PLUGIN_NAME });

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
		} catch {
			// Config refresh failed, but tokens are saved on the backend
		}
	}
};

watch(
	(): string | null => authError.value,
	(val: string | null): void => {
		if (val) {
			flashMessage.error(val);
			authError.value = null;
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
