<template>
	<el-dialog
		:model-value="visible"
		:title="t('remoteAccessTailscalePlugin.wizard.title')"
		width="560px"
		:close-on-click-modal="false"
		@update:model-value="onDialogUpdate"
	>
		<el-steps
			:active="stepIndex"
			finish-status="success"
			align-center
			class="mb-6"
		>
			<el-step
				v-for="step in steps"
				:key="step"
				:title="t(`remoteAccessTailscalePlugin.wizard.steps.${step}`)"
			/>
		</el-steps>

		<div class="min-h-[220px]">
			<!-- Set up -->
			<template v-if="currentStep === 'setup'">
				<el-alert
					type="info"
					:title="t('remoteAccessTailscalePlugin.wizard.setupDescription')"
					:closable="false"
					show-icon
					class="mb-4!"
				/>

				<ul
					v-if="requirements.length > 0"
					class="flex flex-col gap-1 mb-4"
				>
					<li
						v-for="requirement in requirements"
						:key="requirement.code"
						class="flex items-center gap-2 text-sm"
					>
						<el-icon :class="requirement.satisfied ? 'text-green-500' : 'text-gray-400'">
							<icon :icon="requirement.satisfied ? 'mdi:check-circle' : 'mdi:circle-outline'" />
						</el-icon>
						<span>{{ requirement.message }}</span>
					</li>
				</ul>

				<div
					v-if="progress && progress.state === 'running'"
					class="flex items-center gap-2 text-sm mb-4"
				>
					<el-icon class="is-loading">
						<icon icon="mdi:loading" />
					</el-icon>
					<span>{{ progress.message || progress.step || t('remoteAccessTailscalePlugin.wizard.settingUp') }}</span>
				</div>

				<el-alert
					v-if="progress && (progress.state === 'failed' || progress.state === 'timeout')"
					type="error"
					:title="progress.message || t('remoteAccessTailscalePlugin.wizard.setupFailed')"
					:closable="false"
					class="mb-4!"
				/>

				<el-button
					type="primary"
					:loading="isInstalling || progress?.state === 'running'"
					@click="onInstall"
				>
					{{ t('remoteAccessTailscalePlugin.wizard.buttons.startSetup') }}
				</el-button>
			</template>

			<!-- Sign in -->
			<template v-else-if="currentStep === 'signin'">
				<el-tabs v-model="signInTab">
					<el-tab-pane
						:label="t('remoteAccessTailscalePlugin.wizard.tabs.interactive')"
						name="interactive"
					>
						<el-alert
							type="info"
							:title="t('remoteAccessTailscalePlugin.wizard.signInDescription')"
							:closable="false"
							show-icon
							class="mb-4!"
						/>

						<div
							v-if="authUrl"
							class="flex flex-col items-center gap-3"
						>
							<img
								v-if="qr"
								:src="qr"
								:alt="t('remoteAccessTailscalePlugin.wizard.qrAlt')"
								width="180"
								height="180"
							/>

							<a
								:href="authUrl"
								target="_blank"
								rel="noopener noreferrer"
								class="text-sm font-mono break-all text-center"
							>
								{{ authUrl }}
							</a>

							<div class="flex items-center gap-2 text-sm text-gray-500">
								<el-icon
									v-if="isPolling"
									class="is-loading"
								>
									<icon icon="mdi:loading" />
								</el-icon>
								<span>{{ t('remoteAccessTailscalePlugin.wizard.waitingForApproval') }}</span>
							</div>
						</div>

						<div
							v-else-if="isPolling"
							class="flex items-center gap-2 text-sm text-gray-500"
						>
							<el-icon class="is-loading">
								<icon icon="mdi:loading" />
							</el-icon>
							<span>{{ t('remoteAccessTailscalePlugin.wizard.waitingForLink') }}</span>
						</div>

						<el-button
							v-else
							type="primary"
							:loading="isLoggingIn"
							:disabled="isLoggingIn"
							@click="onInteractiveLogin"
						>
							{{ t('remoteAccessTailscalePlugin.wizard.buttons.getSignInLink') }}
						</el-button>
					</el-tab-pane>

					<el-tab-pane
						:label="t('remoteAccessTailscalePlugin.wizard.tabs.advanced')"
						name="advanced"
					>
						<el-alert
							type="info"
							:title="t('remoteAccessTailscalePlugin.wizard.advancedDescription')"
							:closable="false"
							show-icon
							class="mb-4!"
						/>

						<el-form label-position="top">
							<el-form-item :label="t('remoteAccessTailscalePlugin.wizard.fields.authKey.title')">
								<el-input
									v-model="authKey"
									:placeholder="t('remoteAccessTailscalePlugin.wizard.fields.authKey.placeholder')"
									type="password"
									show-password
									name="authKey"
								/>
							</el-form-item>
						</el-form>

						<el-button
							type="primary"
							:loading="isLoggingIn"
							:disabled="!authKey || isLoggingIn"
							@click="onKeyedLogin"
						>
							{{ t('remoteAccessTailscalePlugin.wizard.buttons.signIn') }}
						</el-button>
					</el-tab-pane>
				</el-tabs>
			</template>

			<!-- Options -->
			<template v-else-if="currentStep === 'options'">
				<tailscale-config-form
					v-if="configPlugin"
					v-model:remote-form-submit="optionsFormSubmit"
					v-model:remote-form-result="optionsFormResult"
					:config="configPlugin"
				/>

				<div class="flex justify-end gap-2 mt-4">
					<el-button @click="goToStep('done')">
						{{ t('remoteAccessTailscalePlugin.wizard.buttons.skip') }}
					</el-button>
					<el-button
						type="primary"
						:loading="optionsFormResult === FormResult.WORKING"
						@click="onSaveOptions"
					>
						{{ t('remoteAccessTailscalePlugin.wizard.buttons.saveAndContinue') }}
					</el-button>
				</div>
			</template>

			<!-- Done -->
			<template v-else-if="currentStep === 'done'">
				<el-alert
					type="success"
					:title="t('remoteAccessTailscalePlugin.wizard.doneDescription')"
					:closable="false"
					show-icon
					class="mb-4!"
				/>

				<ul
					v-if="endpoints.length > 0"
					class="flex flex-col gap-2 mb-4"
				>
					<li
						v-for="endpoint in endpoints"
						:key="endpoint.url"
						class="flex items-center gap-2 text-sm"
					>
						<span class="font-medium">{{ endpoint.label }}</span>
						<span class="font-mono flex-1 break-all">{{ endpoint.url }}</span>
						<el-button
							size="small"
							:aria-label="t('remoteAccessTailscalePlugin.wizard.buttons.copy')"
							@click="copyUrl(endpoint.url)"
						>
							<icon icon="mdi:content-copy" />
						</el-button>
					</li>
				</ul>

				<div class="flex justify-end">
					<el-button
						type="primary"
						@click="close"
					>
						{{ t('remoteAccessTailscalePlugin.wizard.buttons.close') }}
					</el-button>
				</div>
			</template>
		</div>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElDialog, ElForm, ElFormItem, ElIcon, ElInput, ElStep, ElSteps, ElTabPane, ElTabs } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useFlashMessage } from '../../../common';
import { FormResult, type FormResultType, useConfigPlugin } from '../../../modules/config';
import { useTailscaleLogin, useTailscaleSetup, useTailscaleStatus } from '../composables';
import { REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME } from '../remote-access-tailscale.constants';
import { RemoteAccessTailscaleApiException } from '../remote-access-tailscale.exceptions';

import TailscaleConfigForm from './tailscale-config-form.vue';
import type { ITailscaleSetupWizardProps, TailscaleWizardStep } from './tailscale-setup-wizard.types';

defineOptions({
	name: 'TailscaleSetupWizard',
});

const props = withDefaults(defineProps<ITailscaleSetupWizardProps>(), {
	initialStep: 'setup',
});

const emit = defineEmits<{
	(e: 'update:visible', visible: boolean): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const steps: TailscaleWizardStep[] = ['setup', 'signin', 'options', 'done'];

const currentStep = ref<TailscaleWizardStep>(props.initialStep);

const stepIndex = computed<number>((): number => steps.indexOf(currentStep.value));

const goToStep = (step: TailscaleWizardStep): void => {
	currentStep.value = step;
};

const { status, requirements, fetchStatus } = useTailscaleStatus();
const { progress, isInstalling, install } = useTailscaleSetup();
const { isLoggingIn, isPolling, login, stopPolling } = useTailscaleLogin();
const { configPlugin, fetchConfigPlugin } = useConfigPlugin({ type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME });

const signInTab = ref<'interactive' | 'advanced'>('interactive');
const authKey = ref<string>('');
const authUrl = ref<string | undefined>(undefined);
const qr = ref<string | undefined>(undefined);

const optionsFormSubmit = ref<boolean>(false);
const optionsFormResult = ref<FormResultType>(FormResult.NONE);

const endpoints = computed(() => status.value?.endpoints ?? []);

// The backend gives a specific, actionable reason for these status codes (install: 409 a setup
// job is already running - transient, retry shortly; 422 this platform/override can never run
// one - permanent. login: 409 a sign-in is already in flight). Anything else (a plain 500, a
// network failure) has no such structured reason, so it falls back to a translated generic
// message instead of surfacing raw, unlocalized backend text.
const flashApiError = (error: unknown, meaningfulCodes: number[], fallback: string): void => {
	if (error instanceof RemoteAccessTailscaleApiException && error.code !== null && meaningfulCodes.includes(error.code)) {
		flashMessage.error(error.message);

		return;
	}

	flashMessage.error(fallback);
};

const onInstall = async (): Promise<void> => {
	try {
		await install();
	} catch (error) {
		flashApiError(error, [409, 422], t('remoteAccessTailscalePlugin.messages.setupFailed'));
	}
};

const onInteractiveLogin = async (): Promise<void> => {
	try {
		const result = await login();

		authUrl.value = result.authUrl;
		qr.value = result.qr;
	} catch (error) {
		flashApiError(error, [409], t('remoteAccessTailscalePlugin.messages.loginFailed'));
	}
};

const onKeyedLogin = async (): Promise<void> => {
	try {
		const result = await login(authKey.value);

		// A one-shot value: forwarded to the request and discarded immediately after, whether the
		// sign-in succeeded or not - it is never kept around in this component either.
		authKey.value = '';

		if (result.state === 'pending-auth') {
			authUrl.value = result.authUrl;
			qr.value = result.qr;

			return;
		}

		goToStep('options');
	} catch (error) {
		authKey.value = '';

		flashApiError(error, [409], t('remoteAccessTailscalePlugin.messages.loginFailed'));
	}
};

const onSaveOptions = (): void => {
	optionsFormSubmit.value = true;
};

const copyUrl = async (url: string): Promise<void> => {
	try {
		await navigator.clipboard.writeText(url);
		flashMessage.success(t('remoteAccessTailscalePlugin.messages.urlCopied'));
	} catch {
		flashMessage.error(t('remoteAccessTailscalePlugin.messages.copyFailed'));
	}
};

const close = (): void => {
	emit('update:visible', false);
};

const onDialogUpdate = (value: boolean): void => {
	if (!value) {
		close();
	}
};

// Progress reaching a terminal state re-checks the requirements/status and, once satisfied,
// moves on to sign-in on its own - the admin does not have to notice the job finished and press
// anything.
watch(
	(): string | undefined => progress.value?.state,
	async (state): Promise<void> => {
		if (state !== 'complete') {
			return;
		}

		await fetchStatus();

		if (currentStep.value === 'setup') {
			goToStep('signin');
		}
	}
);

// The interactive poll updates the shared status store directly - watch it here instead of
// polling a second time, and move on as soon as the node is connected.
watch(
	(): string | undefined => status.value?.state,
	(state): void => {
		if (state === 'connected' && currentStep.value === 'signin') {
			goToStep('options');
		}
	}
);

// `immediate: true` because `currentStep` starts life already set to `props.initialStep` (see
// its `ref()` initializer below) - if the card opens the wizard directly on `options`, assigning
// `currentStep.value = props.initialStep` in the `visible` watcher below is a same-value no-op
// that Vue never reports as a change, so a non-immediate watcher here would never fire and the
// config would never be fetched.
watch(
	(): TailscaleWizardStep => currentStep.value,
	(step): void => {
		if (step === 'options') {
			void fetchConfigPlugin();
		}
	},
	{ immediate: true }
);

watch(
	(): FormResultType => optionsFormResult.value,
	(result): void => {
		if (result === FormResult.OK) {
			goToStep('done');
		}
	}
);

watch(
	(): boolean => props.visible,
	(visible): void => {
		if (visible) {
			currentStep.value = props.initialStep;
			authUrl.value = undefined;
			qr.value = undefined;
			authKey.value = '';
			signInTab.value = 'interactive';

			void fetchStatus();
		} else {
			stopPolling();
		}
	},
	{ immediate: true }
);

// The sign-in request answers `pending-auth` without a link when the daemon is slow to produce it (the
// backend gives the first CLI block 30 s, then hands over to status polling), so the link and QR code
// are picked up from the polled status once they arrive.
watch(
	() => [status.value?.authUrl, status.value?.qr] as const,
	([nextAuthUrl, nextQr]) => {
		if (!nextAuthUrl || authUrl.value) {
			return;
		}

		authUrl.value = nextAuthUrl;
		qr.value = nextQr;
	}
);

// The `visible` watcher stops the sign-in poll when the dialog closes; leaving the page with the dialog
// still open would otherwise keep polling until the login timeout.
onUnmounted(() => {
	stopPolling();
});
</script>
