<template>
	<el-dialog
		:model-value="visible"
		:title="t('remoteAccessCloudflareTunnelPlugin.wizard.title')"
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
				:title="t(`remoteAccessCloudflareTunnelPlugin.wizard.steps.${step}`)"
			/>
		</el-steps>

		<div class="min-h-[220px]">
			<!-- Install -->
			<template v-if="currentStep === 'install'">
				<el-alert
					type="info"
					:title="t('remoteAccessCloudflareTunnelPlugin.wizard.installDescription')"
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
					<span>{{ effectiveProgress.message || effectiveProgress.step || t('remoteAccessCloudflareTunnelPlugin.wizard.settingUp') }}</span>
				</div>

				<el-alert
					v-if="effectiveProgress && (effectiveProgress.state === 'failed' || effectiveProgress.state === 'timeout')"
					type="error"
					:title="effectiveProgress.message || t('remoteAccessCloudflareTunnelPlugin.wizard.setupFailed')"
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
						{{ t('remoteAccessCloudflareTunnelPlugin.wizard.buttons.startSetup') }}
					</el-button>

					<el-collapse
						v-if="remedyPlan.commands.length > 0 || remedyPlan.notes.length > 0"
						class="mt-4"
					>
						<el-collapse-item
							:title="t('remoteAccessCloudflareTunnelPlugin.wizard.buttons.runItYourself')"
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
									{{ t('remoteAccessCloudflareTunnelPlugin.wizard.buttons.copy') }}
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
						:title="privilegedSetupReason || t('remoteAccessCloudflareTunnelPlugin.wizard.setupUnavailable')"
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
							{{ t('remoteAccessCloudflareTunnelPlugin.wizard.buttons.copy') }}
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
						{{ t('remoteAccessCloudflareTunnelPlugin.wizard.buttons.recheck') }}
					</el-button>
				</template>
			</template>

			<!-- Token and hostname -->
			<template v-else-if="currentStep === 'config'">
				<el-alert
					type="info"
					:title="t('remoteAccessCloudflareTunnelPlugin.wizard.configDescription')"
					:closable="false"
					show-icon
					class="mb-4!"
				/>

				<cloudflare-tunnel-config-form
					v-if="configPlugin"
					v-model:remote-form-submit="configFormSubmit"
					v-model:remote-form-result="configFormResult"
					:config="configPlugin"
				/>

				<div class="flex justify-end gap-2 mt-4">
					<el-button
						type="primary"
						:loading="configFormResult === FormResult.WORKING"
						@click="onSaveConfig"
					>
						{{ t('remoteAccessCloudflareTunnelPlugin.wizard.buttons.saveAndContinue') }}
					</el-button>
				</div>
			</template>

			<!-- Done -->
			<template v-else-if="currentStep === 'done'">
				<el-alert
					type="success"
					:title="t('remoteAccessCloudflareTunnelPlugin.wizard.doneDescription')"
					:closable="false"
					show-icon
					class="mb-4!"
				/>

				<div
					v-if="publicUrl"
					class="flex flex-col items-center gap-3 mb-4"
				>
					<img
						v-if="qr"
						:src="qr"
						:alt="t('remoteAccessCloudflareTunnelPlugin.wizard.qrAlt')"
						width="180"
						height="180"
					/>

					<div class="flex items-center gap-2 w-full">
						<span class="font-mono text-sm flex-1 break-all">{{ publicUrl }}</span>
						<el-button
							size="small"
							:aria-label="t('remoteAccessCloudflareTunnelPlugin.wizard.buttons.copy')"
							@click="copyUrl(publicUrl)"
						>
							<icon icon="mdi:content-copy" />
						</el-button>
					</div>
				</div>

				<el-alert
					type="warning"
					:title="t('remoteAccessCloudflareTunnelPlugin.wizard.accessRecommendation')"
					:closable="false"
					show-icon
					class="mb-4!"
				/>

				<div class="flex justify-end">
					<el-button
						type="primary"
						@click="close"
					>
						{{ t('remoteAccessCloudflareTunnelPlugin.wizard.buttons.close') }}
					</el-button>
				</div>
			</template>
		</div>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCollapse, ElCollapseItem, ElDialog, ElIcon, ElStep, ElSteps } from 'element-plus';
import QRCode from 'qrcode';

import { Icon } from '@iconify/vue';

import { useClipboard, useFlashMessage } from '../../../common';
import { FormResult, type FormResultType, useConfigPlugin } from '../../../modules/config';
import { useCloudflareTunnelSetup, useCloudflareTunnelStatus } from '../composables';
import { REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME } from '../remote-access-cloudflare-tunnel.constants';
import { RemoteAccessCloudflareTunnelApiException } from '../remote-access-cloudflare-tunnel.exceptions';
import { buildCloudflareTunnelRemedyPlan, flashCloudflareTunnelApiError, resolveCloudflareTunnelErrorHintKey } from '../utils/provider-actions';

import CloudflareTunnelConfigForm from './cloudflare-tunnel-config-form.vue';
import type { CloudflareTunnelWizardStep, ICloudflareTunnelSetupWizardProps } from './cloudflare-tunnel-setup-wizard.types';

defineOptions({
	name: 'CloudflareTunnelSetupWizard',
});

const props = withDefaults(defineProps<ICloudflareTunnelSetupWizardProps>(), {
	initialStep: 'install',
});

const emit = defineEmits<{
	(e: 'update:visible', visible: boolean): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();
const { copy } = useClipboard();

const steps: CloudflareTunnelWizardStep[] = ['install', 'config', 'done'];

const currentStep = ref<CloudflareTunnelWizardStep>(props.initialStep);

const stepIndex = computed<number>((): number => steps.indexOf(currentStep.value));

const goToStep = (step: CloudflareTunnelWizardStep): void => {
	currentStep.value = step;
};

const { status, requirements, setup, privilegedSetup, fetchStatus } = useCloudflareTunnelStatus();
const { progress, isInstalling, install, stopPolling: stopSetupPolling } = useCloudflareTunnelSetup();
const { configPlugin, fetchConfigPlugin } = useConfigPlugin({ type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME });

const configFormSubmit = ref<boolean>(false);
const configFormResult = ref<FormResultType>(FormResult.NONE);

const isRechecking = ref<boolean>(false);
const installErrorCode = ref<string | null>(null);

const qr = ref<string | undefined>(undefined);

const publicUrl = computed<string | undefined>(() => status.value?.endpoints.find((endpoint) => endpoint.https)?.url);

// Prefers the live `Setup.Progress` websocket event; falls back to the polled `GET /status`
// `setup` job (kept current by `useCloudflareTunnelSetup`'s own poll) once a websocket event has
// arrived at least once, or right after a page reload before any websocket event has arrived at
// all - this is what lets the progress view resume purely from `GET /status`, with no extra
// endpoint. A polled *terminal* state always wins over a stale `running` websocket event, though:
// if the websocket's final tick was ever missed, `progress.value.state` would stay 'running'
// forever and strand the spinner - the poll is the fallback specifically for that case, so it must
// be allowed to override once it reports the job is actually done. Mirrors the Tailscale wizard's
// own `effectiveProgress`.
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
const remedyPlan = computed(() => buildCloudflareTunnelRemedyPlan(requirements.value));

const remedyCommandText = computed<string>(() => remedyPlan.value.commands.join('\n'));

const installErrorHintKey = computed<string | null>(() => resolveCloudflareTunnelErrorHintKey(installErrorCode.value));

// `POST /install`'s 422 gives a specific, actionable reason (a permanently unsupported platform or
// a currently-unavailable privileged worker) - anything else (a busy-job 409, a plain 500, a
// network failure) has no such structured reason, so it falls back to a translated generic message
// instead of surfacing raw, unlocalized backend text.
const flashApiError = (error: unknown, meaningfulCodes: number[], fallback: string): void =>
	flashCloudflareTunnelApiError(error, meaningfulCodes, fallback, flashMessage.error);

const onInstall = async (): Promise<void> => {
	installErrorCode.value = null;

	try {
		await install();

		// install() only returns the job id - data.value.setup (what the polling fallback in
		// useCloudflareTunnelSetup watches) stays whatever it was before this call until the
		// next GET /status. The websocket Setup.Progress event usually arrives first, but if it
		// is ever lost between here and its first tick, the polling fallback would never start
		// without this - refetch immediately so it always has something current to watch.
		await fetchStatus();
	} catch (error) {
		installErrorCode.value = error instanceof RemoteAccessCloudflareTunnelApiException ? error.errorCode : null;

		flashApiError(error, [422], t('remoteAccessCloudflareTunnelPlugin.messages.setupFailed'));
	}
};

const onRecheck = async (): Promise<void> => {
	isRechecking.value = true;

	try {
		await fetchStatus();
	} catch (error) {
		flashApiError(error, [422], t('remoteAccessCloudflareTunnelPlugin.messages.requestError'));
	} finally {
		isRechecking.value = false;
	}
};

const onCopyRemedyCommands = async (): Promise<void> => {
	const copied = await copy(remedyCommandText.value);

	if (copied) {
		flashMessage.success(t('remoteAccessCloudflareTunnelPlugin.messages.commandCopied'));
	} else {
		flashMessage.error(t('remoteAccessCloudflareTunnelPlugin.messages.commandCopyFailed'));
	}
};

const onSaveConfig = (): void => {
	configFormSubmit.value = true;
};

const copyUrl = async (url: string): Promise<void> => {
	const copied = await copy(url);

	if (copied) {
		flashMessage.success(t('remoteAccessCloudflareTunnelPlugin.messages.urlCopied'));
	} else {
		flashMessage.error(t('remoteAccessCloudflareTunnelPlugin.messages.copyFailed'));
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

// Progress reaching a terminal state re-checks the requirements/status and, once satisfied, moves
// on to the token/hostname step on its own - the admin does not have to notice the job finished
// and press anything. Watches `effectiveProgress` (websocket, or the polled status as a fallback)
// so this still fires when the websocket event was missed and only the poll ever saw `complete`.
watch(
	(): string | undefined => effectiveProgress.value?.state,
	async (state): Promise<void> => {
		if (state !== 'complete') {
			return;
		}

		await fetchStatus();

		if (currentStep.value === 'install') {
			goToStep('config');
		}
	}
);

// `immediate: true` because `currentStep` starts life already set to `props.initialStep` (see its
// `ref()` initializer below) - if the card opens the wizard directly on `config` (the "Configure"
// action), assigning `currentStep.value = props.initialStep` in the `visible` watcher below is a
// same-value no-op Vue never reports as a change, so a non-immediate watcher here would never
// fire and the config would never be fetched. Once loaded, force `enabled: true` on the config the
// form binds to - submitting from this step is what "sets up" the tunnel end to end, matching the
// contract in the epic body ("submitting writes both through the plugin config store and enables
// the plugin"): the admin never has to notice a separate enabled switch to make the tunnel useful.
watch(
	(): CloudflareTunnelWizardStep => currentStep.value,
	(step): void => {
		if (step === 'config') {
			void fetchConfigPlugin().then((): void => {
				if (configPlugin.value) {
					configPlugin.value.enabled = true;
				}
			});
		}
	},
	{ immediate: true }
);

watch(
	(): FormResultType => configFormResult.value,
	(result): void => {
		if (result === FormResult.OK) {
			goToStep('done');
		}
	}
);

// The done step's QR code is generated client-side (no backend equivalent for an arbitrary public
// URL, unlike the Tailscale wizard's sign-in QR which the backend itself renders) - mirrors
// `access-urls-list.vue`'s own `QRCode.toDataURL()` usage.
watch(
	(): string | undefined => publicUrl.value,
	async (url): Promise<void> => {
		if (!url) {
			qr.value = undefined;

			return;
		}

		try {
			qr.value = await QRCode.toDataURL(url, { width: 180, margin: 2 });
		} catch {
			qr.value = undefined;
		}
	},
	{ immediate: true }
);

watch(
	(): boolean => props.visible,
	(visible): void => {
		if (visible) {
			currentStep.value = props.initialStep;
			installErrorCode.value = null;

			void fetchStatus();
		} else {
			stopSetupPolling();
		}
	},
	{ immediate: true }
);

// The `visible` watcher stops the poll when the dialog closes; leaving the page with the dialog
// still open would otherwise keep polling forever (an unmount is the only other thing that stops
// it once the job is genuinely still running).
onUnmounted(() => {
	stopSetupPolling();
});
</script>
