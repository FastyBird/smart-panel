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
			:title="t('camerasModule.config.about.title')"
			:description="t('camerasModule.config.about.text')"
			:closable="false"
		/>

		<el-form-item
			:label="t('camerasModule.config.fields.mode.title')"
			prop="go2rtc.mode"
			class="mt-3"
		>
			<el-radio-group
				v-model="model.go2rtc.mode"
				name="mode"
			>
				<el-radio
					v-for="mode in modes"
					:key="mode"
					:value="mode"
				>
					{{ t(`camerasModule.config.modes.${mode}`) }}
				</el-radio>
			</el-radio-group>
		</el-form-item>

		<el-form-item
			v-if="model.go2rtc.mode === CamerasModuleDataGo2rtcConfigMode.managed"
			:label="t('camerasModule.config.fields.binaryPath.title')"
			prop="go2rtc.binaryPath"
		>
			<el-input
				v-model="model.go2rtc.binaryPath"
				name="binaryPath"
				placeholder="/usr/local/lib/smart-panel/go2rtc/go2rtc"
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
			/>
		</el-form-item>

		<el-form-item
			v-if="model.go2rtc.mode === CamerasModuleDataGo2rtcConfigMode.external"
			:label="t('camerasModule.config.fields.externalUrl.title')"
			prop="go2rtc.externalUrl"
		>
			<el-input
				v-model="externalUrl"
				name="externalUrl"
				placeholder="http://192.168.1.5:1984"
				inputmode="url"
				autocomplete="off"
				autocapitalize="off"
				autocorrect="off"
				spellcheck="false"
			/>
		</el-form-item>

		<el-form-item
			:label="t('camerasModule.config.fields.maxSessions.title')"
			prop="maxSessions"
		>
			<el-input-number
				v-model="model.maxSessions"
				:min="1"
				:max="32"
				name="maxSessions"
			/>
		</el-form-item>

		<el-form-item
			:label="t('camerasModule.config.fields.maxSessionsPerCamera.title')"
			prop="maxSessionsPerCamera"
		>
			<el-input-number
				v-model="model.maxSessionsPerCamera"
				:min="1"
				:max="16"
				name="maxSessionsPerCamera"
			/>
		</el-form-item>

		<el-divider />

		<strong>{{ t('camerasModule.config.relayPanel.title') }}</strong>

		<relay-status-panel
			:status="relayStatus"
			class="mt-2"
		/>
	</el-form>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElDivider, ElForm, ElFormItem, ElInput, ElInputNumber, ElRadio, ElRadioGroup, type FormRules } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { CamerasModuleDataGo2rtcConfigMode } from '../../../openapi.constants';
import { FormResult, type FormResultType, Layout, type LayoutType, useConfigModuleEditForm } from '../../config';
import type { IConfigModule } from '../../config/store/config-modules.store.types';
import { type ICamerasConfigEditForm, isValidGo2rtcBinaryPath, isValidGo2rtcExternalUrl } from '../schemas/config.schemas';
import { relayStatusStoreKey } from '../store/keys';
import type { IRelayStatus } from '../store/relay-status.store.types';

import RelayStatusPanel from './relay-status-panel.vue';

defineOptions({
	name: 'CamerasConfigForm',
});

const props = withDefaults(
	defineProps<{
		config: IConfigModule;
		remoteFormSubmit?: boolean;
		remoteFormResult?: FormResultType;
		remoteFormReset?: boolean;
		remoteFormChanged?: boolean;
		layout?: LayoutType;
	}>(),
	{
		remoteFormResult: FormResult.NONE,
		remoteFormReset: false,
		remoteFormChanged: false,
		layout: Layout.DEFAULT,
	}
);

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const modes = [CamerasModuleDataGo2rtcConfigMode.managed, CamerasModuleDataGo2rtcConfigMode.external, CamerasModuleDataGo2rtcConfigMode.disabled];

const { formEl, model, formChanged, submit, formResult } = useConfigModuleEditForm<ICamerasConfigEditForm>({
	config: props.config,
	messages: {
		success: t('camerasModule.config.messages.edited'),
		error: t('camerasModule.config.messages.notEdited'),
	},
});

// `el-input` wants a string; the model keeps `null` for "no URL".
const externalUrl = computed<string>({
	get: (): string => model.go2rtc.externalUrl ?? '',
	set: (value: string): void => {
		model.go2rtc.externalUrl = value;
	},
});

const relayStatusStore = injectStoresManager().getStore(relayStatusStoreKey);

const relayStatus = computed<IRelayStatus | null>(() => relayStatusStore.status);

let releasePolling: (() => void) | null = null;

onMounted((): void => {
	releasePolling = relayStatusStore.startPolling();
});

onBeforeUnmount((): void => {
	releasePolling?.();

	releasePolling = null;
});

const rules = reactive<FormRules<ICamerasConfigEditForm>>({
	'go2rtc.binaryPath': [
		{
			validator: (_rule, value: unknown, callback): void => {
				callback(isValidGo2rtcBinaryPath(value) ? undefined : new Error(t('camerasModule.config.fields.binaryPath.validation.invalid')));
			},
			trigger: 'change',
		},
	],
	'go2rtc.externalUrl': [
		{
			validator: (_rule, value: unknown, callback): void => {
				if (typeof value !== 'string' || value.trim() === '') {
					callback(new Error(t('camerasModule.config.fields.externalUrl.validation.required')));
				} else {
					callback(isValidGo2rtcExternalUrl(value.trim()) ? undefined : new Error(t('camerasModule.config.fields.externalUrl.validation.invalid')));
				}
			},
			trigger: 'change',
		},
	],
	maxSessions: [
		{ required: true, message: t('camerasModule.config.fields.maxSessions.validation.range'), trigger: 'change' },
		{ type: 'number', min: 1, max: 32, message: t('camerasModule.config.fields.maxSessions.validation.range'), trigger: 'change' },
	],
	maxSessionsPerCamera: [
		{ required: true, message: t('camerasModule.config.fields.maxSessionsPerCamera.validation.range'), trigger: 'change' },
		{ type: 'number', min: 1, max: 16, message: t('camerasModule.config.fields.maxSessionsPerCamera.validation.range'), trigger: 'change' },
	],
});

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

			submit().catch((): void => {
				// A failed save is already reported by the edit form, which marks the result as an error first; anything
				// else is a model that did not validate, which would otherwise fail without a word.
				if (formResult.value !== FormResult.ERROR) {
					flashMessage.error(t('camerasModule.config.messages.invalid'));
				}
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
