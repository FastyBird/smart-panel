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
					v-if="effectiveProgress && effectiveProgress.state === 'running'"
					class="flex items-center gap-2 text-sm mb-4"
				>
					<el-icon class="is-loading">
						<icon icon="mdi:loading" />
					</el-icon>
					<span>{{ effectiveProgress.message || effectiveProgress.step || t('remoteAccessTailscalePlugin.wizard.settingUp') }}</span>
				</div>

				<el-alert
					v-if="effectiveProgress && (effectiveProgress.state === 'failed' || effectiveProgress.state === 'timeout')"
					type="error"
					:title="effectiveProgress.message || t('remoteAccessTailscalePlugin.wizard.setupFailed')"
					:closable="false"
					class="mb-4!"
				/>

				<el-alert
					v-if="installErrorHintKey"
					type="warning"
					:title="t(installErrorHintKey)"
					:closable="false"
					show-icon
					class="mb-4!"
				/>

				<!-- D12: privileged setup is available - offer the automated button, plus a manual fallback for anyone who prefers doing it by hand. -->
				<template v-if="!privilegedSetupUnavailable">
					<el-button
						type="primary"
						:loading="isInstalling || effectiveProgress?.state === 'running'"
						@click="onInstall"
					>
						{{ t('remoteAccessTailscalePlugin.wizard.buttons.startSetup') }}
					</el-button>

					<el-collapse
						v-if="remedyPlan.commands.length > 0 || remedyPlan.notes.length > 0"
						class="mt-4"
					>
						<el-collapse-item
							:title="t('remoteAccessTailscalePlugin.wizard.buttons.runItYourself')"
							name="manual"
						>
							<div
								v-if="remedyPlan.commands.length > 0"
								class="flex items-start gap-2"
							>
								<pre class="font-mono text-xs bg-gray-100 rounded px-2 py-1 flex-1 whitespace-pre-wrap break-all">{{ remedyCommandText }}</pre>
								<el-button
									size="small"
									@click="onCopyRemedyCommands"
								>
									{{ t('remoteAccessTailscalePlugin.wizard.buttons.copy') }}
								</el-button>
							</div>
							<p
								v-for="(note, index) in remedyPlan.notes"
								:key="index"
								class="text-sm"
							>
								{{ note }}
							</p>
						</el-collapse-item>
					</el-collapse>
				</template>

				<!-- D12: privileged setup is unavailable - show why, plus the manual remedy for every unsatisfied requirement. -->
				<template v-else>
					<el-alert
						type="warning"
						:title="privilegedSetupReason || t('remoteAccessTailscalePlugin.wizard.setupUnavailable')"
						:closable="false"
						show-icon
						class="mb-4!"
					/>

					<div
						v-if="remedyPlan.commands.length > 0"
						class="flex items-start gap-2 mb-4"
					>
						<pre class="font-mono text-xs bg-gray-100 rounded px-2 py-1 flex-1 whitespace-pre-wrap break-all">{{ remedyCommandText }}</pre>
						<el-button
							size="small"
							@click="onCopyRemedyCommands"
						>
							{{ t('remoteAccessTailscalePlugin.wizard.buttons.copy') }}
						</el-button>
					</div>
					<p
						v-for="(note, index) in remedyPlan.notes"
						:key="index"
						class="text-sm mb-4"
					>
						{{ note }}
					</p>

					<el-button
						:loading="isRechecking"
						@click="onRecheck"
					>
						{{ t('remoteAccessTailscalePlugin.wizard.buttons.recheck') }}
					</el-button>
				</template>
			</template>

			<!-- Sign in -->
			<template v-else-if="currentStep === 'signin'">
				<el-alert
					v-if="loginErrorHintKey"
					type="warning"
					:title="t(loginErrorHintKey)"
					:closable="false"
					show-icon
					class="mb-4!"
				/>

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

import {
	ElAlert,
	ElButton,
	ElCollapse,
	ElCollapseItem,
	ElDialog,
	ElForm,
	ElFormItem,
	ElIcon,
	ElInput,
	ElStep,
	ElSteps,
	ElTabPane,
	ElTabs,
} from 'element-plus';

import { Icon } from '@iconify/vue';

import { useClipboard, useFlashMessage } from '../../../common';
import { FormResult, type FormResultType, useConfigPlugin } from '../../../modules/config';
import { useTailscaleLogin, useTailscaleSetup, useTailscaleStatus } from '../composables';
import { REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME } from '../remote-access-tailscale.constants';
import { RemoteAccessTailscaleApiException } from '../remote-access-tailscale.exceptions';
import { buildTailscaleRemedyPlan, flashTailscaleApiError, resolveTailscaleErrorHintKey } from '../utils/provider-actions';

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
const { copy } = useClipboard();

const steps: TailscaleWizardStep[] = ['setup', 'signin', 'options', 'done'];

const currentStep = ref<TailscaleWizardStep>(props.initialStep);

const stepIndex = computed<number>((): number => steps.indexOf(currentStep.value));

const goToStep = (step: TailscaleWizardStep): void => {
	currentStep.value = step;
};

const { status, requirements, setup, privilegedSetup, fetchStatus } = useTailscaleStatus();
const { progress, isInstalling, install, stopPolling: stopSetupPolling } = useTailscaleSetup();
const { isLoggingIn, isPolling, login, stopPolling } = useTailscaleLogin();
const { configPlugin, fetchConfigPlugin } = useConfigPlugin({ type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME });

const signInTab = ref<'interactive' | 'advanced'>('interactive');
const authKey = ref<string>('');
const authUrl = ref<string | undefined>(undefined);
const qr = ref<string | undefined>(undefined);

const optionsFormSubmit = ref<boolean>(false);
const optionsFormResult = ref<FormResultType>(FormResult.NONE);

const isRechecking = ref<boolean>(false);
const installErrorCode = ref<string | null>(null);
const loginErrorCode = ref<string | null>(null);

const endpoints = computed(() => status.value?.endpoints ?? []);

// Prefers the live `Setup.Progress` websocket event; falls back to the polled `GET /status`
// `setup` job (kept current by `useTailscaleSetup`'s own poll) once a websocket event has arrived
// at least once, or right after a page reload before any websocket event has arrived at all -
// this is what lets the progress view resume purely from `GET /status`, with no extra endpoint.
// A polled *terminal* state always wins over a stale `running` websocket event, though: if the
// websocket's final tick was ever missed, `progress.value.state` would stay 'running' forever and
// strand the spinner - the poll is the fallback specifically for that case, so it must be allowed
// to override once it reports the job is actually done.
const effectiveProgress = computed(() => {
	if (setup.value && setup.value.state !== 'running') {
		return { state: setup.value.state, step: setup.value.step ?? undefined, message: setup.value.message ?? undefined };
	}

	if (progress.value) {
		return progress.value;
	}

	if (setup.value) {
		return { state: setup.value.state, step: setup.value.step ?? undefined, message: setup.value.message ?? undefined };
	}

	return null;
});

const privilegedSetupUnavailable = computed<boolean>(() => privilegedSetup.value !== null && !privilegedSetup.value.available);

const privilegedSetupReason = computed<string | null>(() => privilegedSetup.value?.reason ?? null);

// D12: every unsatisfied requirement's manual remedy, concatenated into one copyable block (used
// both by the "Run it yourself" disclosure when setup is available, and as the primary fallback
// when it is not).
const remedyPlan = computed(() => buildTailscaleRemedyPlan(requirements.value));

const remedyCommandText = computed<string>(() => remedyPlan.value.commands.join('\n'));

const installErrorHintKey = computed<string | null>(() => resolveTailscaleErrorHintKey(installErrorCode.value));

const loginErrorHintKey = computed<string | null>(() => resolveTailscaleErrorHintKey(loginErrorCode.value));

// The backend gives a specific, actionable reason for these status codes (install: 409 a setup
// job is already running - transient, retry shortly; 422 this platform/override can never run
// one - permanent. login: 409 a sign-in is already in flight). Anything else (a plain 500, a
// network failure) has no such structured reason, so it falls back to a translated generic
// message instead of surfacing raw, unlocalized backend text.
const flashApiError = (error: unknown, meaningfulCodes: number[], fallback: string): void =>
	flashTailscaleApiError(error, meaningfulCodes, fallback, flashMessage.error);

const onInstall = async (): Promise<void> => {
	installErrorCode.value = null;

	try {
		await install();
	} catch (error) {
		installErrorCode.value = error instanceof RemoteAccessTailscaleApiException ? error.errorCode : null;

		flashApiError(error, [409, 422], t('remoteAccessTailscalePlugin.messages.setupFailed'));
	}
};

const onRecheck = async (): Promise<void> => {
	isRechecking.value = true;

	try {
		await fetchStatus();
	} catch (error) {
		flashApiError(error, [409, 422], t('remoteAccessTailscalePlugin.messages.requestError'));
	} finally {
		isRechecking.value = false;
	}
};

const onCopyRemedyCommands = async (): Promise<void> => {
	const copied = await copy(remedyCommandText.value);

	if (copied) {
		flashMessage.success(t('remoteAccessTailscalePlugin.messages.commandCopied'));
	} else {
		flashMessage.error(t('remoteAccessTailscalePlugin.messages.commandCopyFailed'));
	}
};

const onInteractiveLogin = async (): Promise<void> => {
	loginErrorCode.value = null;

	try {
		const result = await login();

		authUrl.value = result.authUrl;
		qr.value = result.qr;
	} catch (error) {
		loginErrorCode.value = error instanceof RemoteAccessTailscaleApiException ? error.errorCode : null;

		flashApiError(error, [409], t('remoteAccessTailscalePlugin.messages.loginFailed'));
	}
};

const onKeyedLogin = async (): Promise<void> => {
	loginErrorCode.value = null;

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
		loginErrorCode.value = error instanceof RemoteAccessTailscaleApiException ? error.errorCode : null;

		flashApiError(error, [409], t('remoteAccessTailscalePlugin.messages.loginFailed'));
	}
};

const onSaveOptions = (): void => {
	optionsFormSubmit.value = true;
};

const copyUrl = async (url: string): Promise<void> => {
	const copied = await copy(url);

	if (copied) {
		flashMessage.success(t('remoteAccessTailscalePlugin.messages.urlCopied'));
	} else {
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
// anything. Watches `effectiveProgress` (websocket, or the polled status as a fallback) so this
// still fires when the websocket event was missed and only the poll ever saw `complete`.
watch(
	(): string | undefined => effectiveProgress.value?.state,
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

			return;
		}

		// A sign-in that was waiting for approval (authUrl already shown) landed on a
		// non-progressing state without ever reaching 'connected' - e.g. the control server
		// rejecting an already-approved auth path, or the daemon reporting setup-required
		// again. useTailscaleLogin's poll already stopped itself on this same widened
		// terminal check (see its own doc); surface the reason here instead of leaving the
		// QR/link panel showing a dead link with no explanation ("frozen").
		if (
			currentStep.value === 'signin' &&
			authUrl.value &&
			!isPolling.value &&
			state !== undefined &&
			state !== 'connected' &&
			state !== 'pending-auth' &&
			state !== 'connecting'
		) {
			flashMessage.error(status.value?.message ?? t('remoteAccessTailscalePlugin.messages.loginFailed'));

			authUrl.value = undefined;
			qr.value = undefined;
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
			installErrorCode.value = null;
			loginErrorCode.value = null;

			void fetchStatus();
		} else {
			stopPolling();
			stopSetupPolling();
		}
	},
	{ immediate: true }
);

// The sign-in request answers `pending-auth` without a link when the daemon is slow to produce it (the
// backend gives the first CLI block 30 s, then hands over to status polling), so the link and QR code
// are picked up from the polled status once they arrive. The link and the QR code come from separate CLI
// output blocks, so they can also arrive in separate status responses and are mirrored independently; a QR
// code is only accepted for the link currently shown.
watch(
	() => [status.value?.authUrl, status.value?.qr] as const,
	([nextAuthUrl, nextQr]) => {
		if (nextAuthUrl && !authUrl.value) {
			authUrl.value = nextAuthUrl;
		}

		if (nextAuthUrl && nextQr && !qr.value && nextAuthUrl === authUrl.value) {
			qr.value = nextQr;
		}
	}
);

// The `visible` watcher stops both polls when the dialog closes; leaving the page with the dialog
// still open would otherwise keep polling until the login timeout (sign-in) or forever (setup, an
// unmount is the only thing that stops it once the job is genuinely still running).
onUnmounted(() => {
	stopPolling();
	stopSetupPolling();
});
</script>
