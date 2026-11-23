<template>
	<el-dialog
		:model-value="visible"
		:title="t('remoteAccessTailscalePlugin.wizard.title')"
		:fullscreen="isPhone"
		:class="isPhone ? 'flex! flex-col' : undefined"
		:body-class="isPhone ? 'flex-1 flex flex-col min-h-0' : undefined"
		width="min(760px, calc(100vw - 32px))"
		:close-on-click-modal="false"
		@update:model-value="onDialogUpdate"
	>
		<!-- Spec section 7: provider setup runs in wizard-shell. The flow moves forward on its own (a setup job
			completing, an approved sign-in), so it never goes back to a completed step; Options can be skipped -->
		<!-- On phone the dialog fills the screen and the footer sits at its bottom -->
		<wizard-shell
			:steps="shellSteps"
			class="flex-1"
			:current="currentStep"
			:next-label="nextLabel"
			:next-visible="nextVisible"
			:can-continue="canContinue"
			:busy="isBusy"
			:skippable="currentStep === 'options'"
			:cancellable="currentStep !== 'done'"
			:backable="false"
			:navigable="false"
			@next="onNext"
			@skip="goToStep('done')"
			@cancel="close"
		>
			<div class="flex flex-col gap-4 p-4 tp:p-5">
				<ul
					v-if="visible && setupStages.length > 0"
					class="flex flex-col gap-1 m-0 p-0 list-none"
					:aria-label="t('remoteAccessTailscalePlugin.wizard.setupProgress.title')"
					aria-live="polite"
				>
					<li
						v-for="stage in setupStages"
						:key="stage.step"
						:data-setup-step="stage.step"
						:data-setup-state="stage.state"
						class="flex items-center gap-2 text-body"
					>
						<el-icon :class="{ 'is-loading': stage.state === 'running' }">
							<icon
								:icon="setupStageIcons[stage.state]"
								:class="stage.state === 'complete' ? 'text-success' : stage.state === 'running' ? undefined : 'text-muted'"
							/>
						</el-icon>
						<span>{{ t(`remoteAccessTailscalePlugin.wizard.setupProgress.steps.${stage.step}`) }}</span>
						<span class="text-caption">{{ t(`remoteAccessTailscalePlugin.wizard.setupProgress.states.${stage.state}`) }}</span>
					</li>
				</ul>

				<!-- Set up -->
				<template v-if="currentStep === 'setup'">
					<el-alert
						type="info"
						:title="t('remoteAccessTailscalePlugin.wizard.setupDescription')"
						:closable="false"
						show-icon
					/>

					<ul
						v-if="requirements.length > 0"
						class="flex flex-col gap-1 m-0 p-0 list-none"
					>
						<li
							v-for="requirement in requirements"
							:key="requirement.code"
							class="flex items-center gap-2 text-body"
						>
							<el-icon>
								<icon
									:icon="requirement.satisfied ? 'mdi:check-circle' : 'mdi:circle-outline'"
									:class="requirement.satisfied ? 'text-success' : 'text-muted'"
								/>
							</el-icon>
							<span>{{ requirement.message }}</span>
						</li>
					</ul>

					<div
						v-if="effectiveProgress && effectiveProgress.state === 'running'"
						class="flex items-center gap-2 text-body"
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
					/>

					<el-alert
						v-if="installErrorHintKey"
						type="warning"
						:title="t(installErrorHintKey)"
						:closable="false"
						show-icon
					/>

					<!-- D12: privileged setup is available - Next starts it; the manual fallback stays one click away -->
					<el-collapse v-if="!privilegedSetupUnavailable && (remedyPlan.commands.length > 0 || remedyPlan.notes.length > 0)">
						<el-collapse-item
							:title="t('remoteAccessTailscalePlugin.wizard.buttons.runItYourself')"
							name="manual"
						>
							<div class="flex flex-col gap-3">
								<div
									v-if="remedyPlan.commands.length > 0"
									class="flex items-start gap-2"
								>
									<pre class="flex-1 m-0 px-2 py-1 rounded bg-fill text-mono whitespace-pre-wrap break-all">{{ remedyCommandText }}</pre>
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
									class="m-0 text-body"
								>
									{{ note }}
								</p>
							</div>
						</el-collapse-item>
					</el-collapse>

					<!-- D12: privileged setup is unavailable - show why, plus the manual remedy for every unsatisfied requirement -->
					<template v-else-if="privilegedSetupUnavailable">
						<el-alert
							type="warning"
							:title="privilegedSetupReason || t('remoteAccessTailscalePlugin.wizard.setupUnavailable')"
							:closable="false"
							show-icon
						/>

						<div
							v-if="remedyPlan.commands.length > 0"
							class="flex items-start gap-2"
						>
							<pre class="flex-1 m-0 px-2 py-1 rounded bg-fill text-mono whitespace-pre-wrap break-all">{{ remedyCommandText }}</pre>
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
							class="m-0 text-body"
						>
							{{ note }}
						</p>

						<div>
							<el-button
								:loading="isRechecking"
								@click="onRecheck"
							>
								{{ t('remoteAccessTailscalePlugin.wizard.buttons.recheck') }}
							</el-button>
						</div>
					</template>
				</template>

				<!-- Sign in: Next asks for the link, or signs in with the auth key on the Advanced tab -->
				<template v-else-if="currentStep === 'signin'">
					<el-alert
						v-if="loginErrorHintKey"
						type="warning"
						:title="t(loginErrorHintKey)"
						:closable="false"
						show-icon
					/>

					<el-tabs v-model="signInTab">
						<el-tab-pane
							:label="t('remoteAccessTailscalePlugin.wizard.tabs.interactive')"
							name="interactive"
						>
							<div class="flex flex-col gap-4">
								<el-alert
									type="info"
									:title="t('remoteAccessTailscalePlugin.wizard.signInDescription')"
									:closable="false"
									show-icon
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
										class="text-mono text-primary break-all text-center"
									>
										{{ authUrl }}
									</a>

									<div class="flex items-center gap-2 text-help">
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
									class="flex items-center gap-2 text-help"
								>
									<el-icon class="is-loading">
										<icon icon="mdi:loading" />
									</el-icon>
									<span>{{ t('remoteAccessTailscalePlugin.wizard.waitingForLink') }}</span>
								</div>
							</div>
						</el-tab-pane>

						<el-tab-pane
							:label="t('remoteAccessTailscalePlugin.wizard.tabs.advanced')"
							name="advanced"
						>
							<div class="flex flex-col gap-4">
								<el-alert
									type="info"
									:title="t('remoteAccessTailscalePlugin.wizard.advancedDescription')"
									:closable="false"
									show-icon
								/>

								<el-form
									label-position="top"
									@submit.prevent="onNext"
								>
									<el-form-item :label="t('remoteAccessTailscalePlugin.wizard.fields.authKey.title')">
										<secret-input
											v-model="authKey"
											:placeholder="t('remoteAccessTailscalePlugin.wizard.fields.authKey.placeholder')"
											name="authKey"
										/>
									</el-form-item>
								</el-form>
							</div>
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
				</template>

				<!-- Done -->
				<template v-else-if="currentStep === 'done'">
					<el-alert
						type="success"
						:title="t('remoteAccessTailscalePlugin.wizard.doneDescription')"
						:closable="false"
						show-icon
					/>

					<ul
						v-if="endpoints.length > 0"
						class="flex flex-col gap-3 m-0 p-0 list-none"
					>
						<li
							v-for="endpoint in endpoints"
							:key="endpoint.url"
							class="flex flex-col gap-1"
						>
							<span class="text-label">{{ endpoint.label }}</span>
							<copy-field
								:value="endpoint.url"
								data-test-id="tailscale-wizard-url"
							/>
						</li>
					</ul>
				</template>
			</div>
		</wizard-shell>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCollapse, ElCollapseItem, ElDialog, ElForm, ElFormItem, ElIcon, ElTabPane, ElTabs } from 'element-plus';

import { Icon } from '@iconify/vue';

import { CopyField, SecretInput, WizardShell, type WizardShellStep, useClipboard, useFlashMessage, useSizeClass } from '../../../common';
import { FormResult, type FormResultType, useConfigPlugin } from '../../../modules/config';
import { RemoteAccessTailscalePluginControlAction } from '../../../openapi.constants';
import { useTailscaleLogin, useTailscaleSetup, useTailscaleStatus } from '../composables';
import { REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME } from '../remote-access-tailscale.constants';
import { RemoteAccessTailscaleApiException } from '../remote-access-tailscale.exceptions';
import { buildTailscaleRemedyPlan, canResumeTailscaleSignIn, flashTailscaleApiError, resolveTailscaleErrorHintKey } from '../utils/provider-actions';
import { type TailscaleSetupStageState, getTailscaleSetupStages } from '../utils/setup-progress';

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
const { isPhone } = useSizeClass();

const steps: TailscaleWizardStep[] = ['setup', 'signin', 'options', 'done'];

const currentStep = ref<TailscaleWizardStep>(props.initialStep);

const shellSteps = computed<WizardShellStep[]>(() =>
	steps.map((step) => ({ id: step, label: t(`remoteAccessTailscalePlugin.wizard.steps.${step}`) }))
);

const goToStep = (step: TailscaleWizardStep): void => {
	currentStep.value = step;
};

const { status, requirements, privilegedSetup, fetchStatus, refreshStatus } = useTailscaleStatus();
const { progress: effectiveProgress, isInstalling, install, startPolling: startSetupPolling, stopPolling: stopSetupPolling } = useTailscaleSetup();
const setupStages = computed(() => getTailscaleSetupStages(effectiveProgress.value));
const setupStageIcons: Record<TailscaleSetupStageState, string> = {
	pending: 'mdi:circle-outline',
	running: 'mdi:loading',
	complete: 'mdi:check-circle',
	failed: 'mdi:alert-circle',
	interrupted: 'mdi:help-circle-outline',
};
const { isLoggingIn, isPolling, hasPollingTimedOut, login, resumePolling, stopPolling } = useTailscaleLogin();
const { configPlugin, fetchConfigPlugin } = useConfigPlugin({ type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME });

const signInTab = ref<'interactive' | 'advanced'>('interactive');
const authKey = ref<string>('');
const authUrl = ref<string | undefined>(undefined);
const qr = ref<string | undefined>(undefined);

const optionsFormSubmit = ref<boolean>(false);
const optionsFormResult = ref<FormResultType>(FormResult.NONE);

const isRechecking = ref<boolean>(false);
const installErrorCode = ref<string | null>(null);
let sessionGeneration = 0;
let recoveringSignIn = false;
let recoveredSignInEpoch: string | undefined;
const loginErrorCode = ref<string | null>(null);
const awaitingKeyedConnection = ref<boolean>(false);

const canLogin = computed(
	() =>
		status.value?.control?.enabled === true &&
		!status.value.control.operation &&
		status.value.control.availableActions.includes(RemoteAccessTailscalePluginControlAction.login)
);

const endpoints = computed(() => status.value?.endpoints ?? []);

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
	const generation = sessionGeneration;
	installErrorCode.value = null;

	try {
		await install();
	} catch (error) {
		if (!props.visible || generation !== sessionGeneration) return;

		installErrorCode.value = error instanceof RemoteAccessTailscaleApiException ? error.errorCode : null;

		flashApiError(error, [409, 422], t('remoteAccessTailscalePlugin.messages.setupFailed'));
	}
};

// Both completion paths use the privileged control snapshot to choose the next step.
const nextSetupStep = (): 'options' | 'signin' | null => {
	const control = status.value?.control;
	if (!control?.enabled || control.operation || !requirements.value.every((requirement) => requirement.satisfied === true)) return null;

	if (control.authentication === 'authenticated') return 'options';
	if (control.authentication === 'required' && canLogin.value) return 'signin';
	return null;
};

const onRecheck = async (): Promise<void> => {
	if (isRechecking.value || !props.visible || currentStep.value !== 'setup') return;
	const generation = sessionGeneration;
	const previousStatus = status.value;
	isRechecking.value = true;

	try {
		await refreshStatus();

		if (
			!props.visible ||
			generation !== sessionGeneration ||
			currentStep.value !== 'setup' ||
			status.value === previousStatus ||
			isInstalling.value ||
			effectiveProgress.value?.state === 'running' ||
			requirements.value.length === 0
		)
			return;

		const nextStep = nextSetupStep();
		const state = status.value?.state;
		if (
			(nextStep === 'options' && (state === 'connected' || state === 'disconnected')) ||
			(nextStep === 'signin' && (state === 'setup-required' || state === 'pending-auth'))
		) {
			goToStep(nextStep);
		}
	} catch (error) {
		if (!props.visible || generation !== sessionGeneration) return;

		flashApiError(error, [409, 422], t('remoteAccessTailscalePlugin.messages.requestError'));
	} finally {
		if (generation === sessionGeneration) isRechecking.value = false;
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
	if (!canLogin.value) return;
	awaitingKeyedConnection.value = false;
	const generation = sessionGeneration;
	loginErrorCode.value = null;

	try {
		const result = await login();

		if (!props.visible || generation !== sessionGeneration) return;

		authUrl.value = result.authUrl;
		qr.value = result.qr;
	} catch (error) {
		if (!props.visible || generation !== sessionGeneration) return;

		loginErrorCode.value = error instanceof RemoteAccessTailscaleApiException ? error.errorCode : null;

		flashApiError(error, [409], t('remoteAccessTailscalePlugin.messages.loginFailed'));
	}
};

const onKeyedLogin = async (): Promise<void> => {
	if (!canLogin.value) return;
	const generation = sessionGeneration;
	const key = authKey.value;
	awaitingKeyedConnection.value = false;
	authKey.value = '';
	loginErrorCode.value = null;

	try {
		const result = await login(key);

		if (!props.visible || generation !== sessionGeneration) return;

		// A one-shot value: forwarded to the request and discarded immediately after, whether the
		// sign-in succeeded or not - it is never kept around in this component either.
		authKey.value = '';

		if (result.state === 'pending-auth') {
			awaitingKeyedConnection.value = true;
			authUrl.value = result.authUrl;
			qr.value = result.qr;

			return;
		}

		if (result.state === 'connected') {
			goToStep('options');
		} else if (result.state === 'connecting' || result.state === 'pending-approval') {
			awaitingKeyedConnection.value = true;
		} else {
			flashMessage.error(t('remoteAccessTailscalePlugin.messages.loginFailed'));
		}
	} catch (error) {
		if (!props.visible || generation !== sessionGeneration) return;

		authKey.value = '';
		loginErrorCode.value = error instanceof RemoteAccessTailscaleApiException ? error.errorCode : null;

		flashApiError(error, [409], t('remoteAccessTailscalePlugin.messages.loginFailed'));
	}
};

const onSaveOptions = (): void => {
	optionsFormSubmit.value = true;
};

const close = (): void => {
	emit('update:visible', false);
};

// The footer's Next is each step's own action: start the setup job, ask for the sign-in link or sign in with the
// auth key, save the options, close
const nextLabel = computed<string>(() => {
	switch (currentStep.value) {
		case 'setup':
			return t('remoteAccessTailscalePlugin.wizard.buttons.startSetup');
		case 'signin':
			return signInTab.value === 'advanced'
				? t('remoteAccessTailscalePlugin.wizard.buttons.signIn')
				: t('remoteAccessTailscalePlugin.wizard.buttons.getSignInLink');
		case 'options':
			return t('remoteAccessTailscalePlugin.wizard.buttons.saveAndContinue');
		default:
			return t('remoteAccessTailscalePlugin.wizard.buttons.close');
	}
});

// Hidden without privileged setup (the step offers the manual commands and Re-check instead) and while a sign-in link
// is on its way or waiting for approval
const nextVisible = computed<boolean>(() => {
	switch (currentStep.value) {
		case 'setup':
			return !privilegedSetupUnavailable.value;
		case 'signin':
			return signInTab.value === 'advanced' || (!authUrl.value && !isPolling.value);
		default:
			return true;
	}
});

const canContinue = computed<boolean>(() => {
	switch (currentStep.value) {
		case 'signin':
			return canLogin.value && (signInTab.value !== 'advanced' || authKey.value !== '');
		case 'options':
			return configPlugin.value !== null;
		default:
			return true;
	}
});

const isBusy = computed<boolean>(() => {
	switch (currentStep.value) {
		case 'setup':
			return isInstalling.value || effectiveProgress.value?.state === 'running';
		case 'signin':
			return isLoggingIn.value;
		case 'options':
			return optionsFormResult.value === FormResult.WORKING;
		default:
			return false;
	}
});

const onNext = (): void => {
	if (isBusy.value || !canContinue.value || !nextVisible.value) return;

	switch (currentStep.value) {
		case 'setup':
			void onInstall();
			break;
		case 'signin':
			void (signInTab.value === 'advanced' ? onKeyedLogin() : onInteractiveLogin());
			break;
		case 'options':
			onSaveOptions();
			break;
		default:
			close();
	}
};

const onDialogUpdate = (value: boolean): void => {
	if (!value) {
		close();
	}
};

let completing = false;

// Revisit completion when requirements are refreshed after a transient read failure.
watch(
	[effectiveProgress, requirements],
	async ([completed]): Promise<void> => {
		if (completing || !props.visible || completed?.state !== 'complete' || currentStep.value !== 'setup') return;

		const generation = sessionGeneration;
		completing = true;

		try {
			await fetchStatus();

			// A second installation may have been accepted while this read was pending.
			const nextStep = nextSetupStep();
			if (
				props.visible &&
				generation === sessionGeneration &&
				effectiveProgress.value?.job === completed.job &&
				effectiveProgress.value?.state === 'complete' &&
				nextStep !== null
			) {
				goToStep(nextStep);
			}
		} catch (error) {
			if (!props.visible || generation !== sessionGeneration) return;

			flashApiError(error, [422], t('remoteAccessTailscalePlugin.messages.requestError'));
		} finally {
			completing = false;
		}
	},
	{ immediate: true }
);

// An absolute polling deadline can expire while the last status is still pending.
// Keep it distinct from cancellation and terminal states so a closed session never reports a timeout.
watch(hasPollingTimedOut, (timedOut): void => {
	if (!timedOut || !props.visible || currentStep.value !== 'signin') return;

	flashMessage.error(t('remoteAccessTailscalePlugin.messages.loginTimedOut'));
	awaitingKeyedConnection.value = false;
	authUrl.value = undefined;
	qr.value = undefined;
});

// Sign-in polling updates the shared status store directly - watch it here instead of
// polling a second time, and move on as soon as the node is connected.
watch([() => status.value?.state, isPolling], ([state]): void => {
	if (!props.visible) return;

	if (state === 'connected' && currentStep.value === 'signin') {
		awaitingKeyedConnection.value = false;
		goToStep('options');

		return;
	}

	// A sign-in that was waiting for a connection or approval landed on a
	// non-progressing state without ever reaching 'connected' - e.g. the control server
	// rejecting an already-approved auth path, or the daemon reporting setup-required
	// again. useTailscaleLogin's poll already stopped itself on this same widened
	// terminal check (see its own doc); surface the reason here instead of leaving the
	// QR/link panel showing a dead link with no explanation ("frozen").
	if (
		currentStep.value === 'signin' &&
		(authUrl.value || awaitingKeyedConnection.value) &&
		!isPolling.value &&
		state !== undefined &&
		state !== 'connected' &&
		state !== 'pending-auth' &&
		state !== 'connecting' &&
		state !== 'pending-approval'
	) {
		flashMessage.error(status.value?.message ?? t('remoteAccessTailscalePlugin.messages.loginFailed'));

		awaitingKeyedConnection.value = false;
		authUrl.value = undefined;
		qr.value = undefined;
	}
});

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
	(visible, previous): void => {
		if (previous !== undefined) sessionGeneration++;
		isRechecking.value = false;
		recoveringSignIn = false;
		recoveredSignInEpoch = undefined;
		awaitingKeyedConnection.value = false;
		if (visible) {
			currentStep.value = props.initialStep;
			authUrl.value = undefined;
			qr.value = undefined;
			authKey.value = '';
			signInTab.value = 'interactive';
			installErrorCode.value = null;
			loginErrorCode.value = null;

			startSetupPolling();
			void fetchStatus().catch((error: unknown) => flashApiError(error, [422], t('remoteAccessTailscalePlugin.messages.requestError')));
		} else {
			authUrl.value = undefined;
			qr.value = undefined;
			authKey.value = '';
			stopPolling();
			stopSetupPolling();
		}
	},
	{ immediate: true }
);

// Read the existing pending sign-in after a reload or reopening, including while its link is
// still being produced. Never call POST /login here: the backend operation already owns it.
watch(
	() => [props.visible, currentStep.value, status.value] as const,
	([visible, step, snapshot]) => {
		if (!visible || step !== 'signin' || !snapshot) return;
		const canResume = canResumeTailscaleSignIn(snapshot.state, snapshot.control);
		// A daemon can still report pending-auth after the backend has lost its RAM-only login
		// operation. Release the old capability and poll so the newly permitted login is usable.
		if (recoveringSignIn && (snapshot.epoch !== recoveredSignInEpoch || (snapshot.state === 'pending-auth' && !canResume))) {
			recoveringSignIn = false;
			authUrl.value = undefined;
			qr.value = undefined;
			awaitingKeyedConnection.value = false;
			stopPolling();
		}
		if (!canResume) return;

		if (!hasPollingTimedOut.value) {
			recoveringSignIn = true;
			recoveredSignInEpoch = snapshot.epoch;
			resumePolling();
			authUrl.value = snapshot.authUrl;
			qr.value = snapshot.authUrl ? snapshot.qr : undefined;
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
		if (!props.visible || currentStep.value !== 'signin') return;
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
	sessionGeneration++;
	stopPolling();
	stopSetupPolling();
});
</script>
