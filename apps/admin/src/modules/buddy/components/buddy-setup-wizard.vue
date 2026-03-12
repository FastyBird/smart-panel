<template>
	<el-dialog
		:model-value="visible"
		:title="t('buddyModule.wizard.title')"
		width="640px"
		:close-on-click-modal="false"
		@update:model-value="(val: boolean) => emit('update:visible', val)"
	>
		<el-steps
			v-if="!isLoading"
			:key="stepSequenceKey"
			:active="currentStep"
			finish-status="success"
			align-center
			class="mb-6"
		>
			<el-step
				v-for="step in stepSequence"
				:key="step"
				:title="t(`buddyModule.wizard.steps.${step}`)"
			/>
		</el-steps>

		<div
			v-loading="isLoading"
			class="min-h-[200px]"
		>
			<!-- Step 1: LLM Provider Selection -->
			<template v-if="currentStepName === 'provider'">
				<p class="text-[var(--el-text-color-secondary)] mb-4">
					{{ t('buddyModule.wizard.providerDescription') }}
				</p>

				<div
					v-if="llmProviders.length === 0 && !isLoading"
					class="text-center py-8"
				>
					<el-empty :description="t('buddyModule.wizard.noProvidersAvailable')" />
				</div>

				<div
					v-else
					class="flex flex-col gap-2"
				>
					<div
						v-for="provider in llmProviders"
						:key="provider.type"
						class="border border-solid rounded-lg p-3 cursor-pointer transition-all"
						:class="[
							selectedLlmProvider === provider.type
								? 'border-[var(--el-color-primary)] bg-[var(--el-color-primary-light-9)]'
								: 'border-[var(--el-border-color)] hover:border-[var(--el-color-primary-light-5)]',
							!provider.enabled ? 'opacity-50 cursor-not-allowed' : '',
						]"
						@click="provider.enabled ? selectLlmProvider(provider.type) : undefined"
					>
						<div class="flex items-center justify-between">
							<div>
								<span class="font-medium">{{ provider.name }}</span>
								<span
									v-if="provider.default_model"
									class="text-xs text-[var(--el-text-color-secondary)] ml-2"
								>
									{{ provider.default_model }}
								</span>
							</div>
							<div class="flex items-center gap-2">
								<el-tag
									v-if="!provider.enabled"
									size="small"
									type="info"
								>
									{{ t('buddyModule.wizard.disabled') }}
								</el-tag>
								<el-tag
									v-else-if="provider.configured"
									size="small"
									type="success"
								>
									{{ t('buddyModule.wizard.configured') }}
								</el-tag>
								<el-tag
									v-else
									size="small"
									type="warning"
								>
									{{ t('buddyModule.wizard.needsSetup') }}
								</el-tag>
								<el-icon
									v-if="selectedLlmProvider === provider.type"
									color="var(--el-color-primary)"
								>
									<icon icon="mdi:check-circle" />
								</el-icon>
							</div>
						</div>
						<div class="text-sm text-[var(--el-text-color-secondary)] mt-1">
							{{ provider.description }}
						</div>
					</div>
				</div>

				<!-- Inline config form for selected provider that needs configuration -->
				<template v-if="selectedLlmProvider && selectedLlmProviderNeedsConfig">
					<el-divider />
					<h4 class="m-0 mb-3">
						{{ t('buddyModule.wizard.configureProvider', { name: selectedLlmProviderName }) }}
					</h4>
					<el-scrollbar max-height="40vh">
						<component
							:is="selectedLlmConfigForm"
							v-if="selectedLlmConfigPlugin && selectedLlmConfigForm"
							v-model:remote-form-submit="llmFormSubmit"
							v-model:remote-form-result="llmFormResult"
							v-model:remote-form-reset="llmFormReset"
							v-model:remote-form-changed="llmFormChanged"
							:config="selectedLlmConfigPlugin"
						/>
					</el-scrollbar>
				</template>
			</template>

			<!-- Step 2: Voice (TTS / STT) -->
			<template v-if="currentStepName === 'voice'">
				<p class="text-[var(--el-text-color-secondary)] mb-4">
					{{ t('buddyModule.wizard.voiceDescription') }}
				</p>

				<!-- TTS -->
				<h4 class="m-0 mb-2">
					{{ t('buddyModule.wizard.ttsHeading') }}
				</h4>
				<div class="flex flex-col gap-2 mb-4">
					<div
						v-for="provider in ttsProviders"
						:key="provider.type"
						class="border border-solid rounded-lg p-3 cursor-pointer transition-all"
						:class="[
							selectedTtsProvider === provider.type
								? 'border-[var(--el-color-primary)] bg-[var(--el-color-primary-light-9)]'
								: 'border-[var(--el-border-color)] hover:border-[var(--el-color-primary-light-5)]',
							!provider.enabled ? 'opacity-50 cursor-not-allowed' : '',
						]"
						@click="provider.enabled ? selectTtsProvider(provider.type) : undefined"
					>
						<div class="flex items-center justify-between">
							<span class="font-medium">{{ provider.name }}</span>
							<div class="flex items-center gap-2">
								<el-tag
									v-if="!provider.enabled"
									size="small"
									type="info"
								>
									{{ t('buddyModule.wizard.disabled') }}
								</el-tag>
								<el-tag
									v-else-if="provider.configured"
									size="small"
									type="success"
								>
									{{ t('buddyModule.wizard.configured') }}
								</el-tag>
								<el-tag
									v-else
									size="small"
									type="warning"
								>
									{{ t('buddyModule.wizard.needsSetup') }}
								</el-tag>
								<el-icon
									v-if="selectedTtsProvider === provider.type"
									color="var(--el-color-primary)"
								>
									<icon icon="mdi:check-circle" />
								</el-icon>
							</div>
						</div>
					</div>
				</div>

				<!-- STT -->
				<h4 class="m-0 mb-2">
					{{ t('buddyModule.wizard.sttHeading') }}
				</h4>
				<div class="flex flex-col gap-2">
					<div
						v-for="provider in sttProviders"
						:key="provider.type"
						class="border border-solid rounded-lg p-3 cursor-pointer transition-all"
						:class="[
							selectedSttProvider === provider.type
								? 'border-[var(--el-color-primary)] bg-[var(--el-color-primary-light-9)]'
								: 'border-[var(--el-border-color)] hover:border-[var(--el-color-primary-light-5)]',
							!provider.enabled ? 'opacity-50 cursor-not-allowed' : '',
						]"
						@click="provider.enabled ? selectSttProvider(provider.type) : undefined"
					>
						<div class="flex items-center justify-between">
							<span class="font-medium">{{ provider.name }}</span>
							<div class="flex items-center gap-2">
								<el-tag
									v-if="!provider.enabled"
									size="small"
									type="info"
								>
									{{ t('buddyModule.wizard.disabled') }}
								</el-tag>
								<el-tag
									v-else-if="provider.configured"
									size="small"
									type="success"
								>
									{{ t('buddyModule.wizard.configured') }}
								</el-tag>
								<el-tag
									v-else
									size="small"
									type="warning"
								>
									{{ t('buddyModule.wizard.needsSetup') }}
								</el-tag>
								<el-icon
									v-if="selectedSttProvider === provider.type"
									color="var(--el-color-primary)"
								>
									<icon icon="mdi:check-circle" />
								</el-icon>
							</div>
						</div>
					</div>
				</div>

				<!-- Inline config form for selected voice provider that needs configuration -->
				<template v-if="activeVoiceProviderNeedsConfig && activeVoiceConfigPlugin && activeVoiceConfigForm">
					<el-divider />
					<h4 class="m-0 mb-3">
						{{ t('buddyModule.wizard.configureProvider', { name: activeVoiceProviderName }) }}
					</h4>
					<el-scrollbar max-height="40vh">
						<component
							:is="activeVoiceConfigForm"
							v-model:remote-form-submit="voiceFormSubmit"
							v-model:remote-form-result="voiceFormResult"
							v-model:remote-form-reset="voiceFormReset"
							v-model:remote-form-changed="voiceFormChanged"
							:config="activeVoiceConfigPlugin"
						/>
					</el-scrollbar>
				</template>
			</template>

			<!-- Step 3: Messaging -->
			<template v-if="currentStepName === 'messaging'">
				<p class="text-[var(--el-text-color-secondary)] mb-4">
					{{ t('buddyModule.wizard.messagingDescription') }}
				</p>

				<div class="flex flex-col gap-2">
					<div
						v-for="provider in messagingProviders"
						:key="provider.type"
						class="border border-solid rounded-lg p-3 cursor-pointer transition-all"
						:class="[
							selectedMessagingProvider === provider.type
								? 'border-[var(--el-color-primary)] bg-[var(--el-color-primary-light-9)]'
								: 'border-[var(--el-border-color)] hover:border-[var(--el-color-primary-light-5)]',
							!provider.enabled ? 'opacity-50 cursor-not-allowed' : '',
						]"
						@click="provider.enabled ? selectMessagingProvider(provider.type) : undefined"
					>
						<div class="flex items-center justify-between">
							<span class="font-medium">{{ provider.name }}</span>
							<div class="flex items-center gap-2">
								<el-tag
									v-if="!provider.enabled"
									size="small"
									type="info"
								>
									{{ t('buddyModule.wizard.disabled') }}
								</el-tag>
								<el-tag
									v-else-if="provider.configured"
									size="small"
									type="success"
								>
									{{ t('buddyModule.wizard.configured') }}
								</el-tag>
								<el-tag
									v-else
									size="small"
									type="warning"
								>
									{{ t('buddyModule.wizard.needsSetup') }}
								</el-tag>
								<el-icon
									v-if="selectedMessagingProvider === provider.type"
									color="var(--el-color-primary)"
								>
									<icon icon="mdi:check-circle" />
								</el-icon>
							</div>
						</div>
						<div class="text-sm text-[var(--el-text-color-secondary)] mt-1">
							{{ provider.description }}
						</div>
					</div>
				</div>

				<!-- Inline config form for selected messaging provider that needs configuration -->
				<template v-if="selectedMessagingProviderNeedsConfig && selectedMessagingConfigPlugin && selectedMessagingConfigForm">
					<el-divider />
					<h4 class="m-0 mb-3">
						{{ t('buddyModule.wizard.configureProvider', { name: selectedMessagingProviderName }) }}
					</h4>
					<el-scrollbar max-height="40vh">
						<component
							:is="selectedMessagingConfigForm"
							v-model:remote-form-submit="messagingFormSubmit"
							v-model:remote-form-result="messagingFormResult"
							v-model:remote-form-reset="messagingFormReset"
							v-model:remote-form-changed="messagingFormChanged"
							:config="selectedMessagingConfigPlugin"
						/>
					</el-scrollbar>
				</template>
			</template>

			<!-- Step 4: Done -->
			<template v-if="currentStepName === 'done'">
				<div class="text-center py-6">
					<el-icon
						:size="48"
						color="var(--el-color-success)"
						class="mb-4"
					>
						<icon icon="mdi:check-circle-outline" />
					</el-icon>

					<h3 class="m-0 mb-2">
						{{ t('buddyModule.wizard.doneTitle') }}
					</h3>
					<p class="text-[var(--el-text-color-secondary)] m-0 mb-4">
						{{ t('buddyModule.wizard.doneDescription') }}
					</p>

					<div class="flex flex-col gap-2 max-w-sm mx-auto text-left">
						<div class="flex items-center gap-2">
							<el-icon :color="selectedLlmProvider ? 'var(--el-color-success)' : 'var(--el-color-info)'">
								<icon :icon="selectedLlmProvider ? 'mdi:check-circle' : 'mdi:minus-circle'" />
							</el-icon>
							<span>
								{{ t('buddyModule.wizard.summaryLlm') }}:
								<strong>{{ selectedLlmProviderName || t('buddyModule.wizard.notSelected') }}</strong>
							</span>
						</div>
						<div
							v-if="hasVoiceProviders"
							class="flex items-center gap-2"
						>
							<el-icon :color="selectedTtsProvider || selectedSttProvider ? 'var(--el-color-success)' : 'var(--el-color-info)'">
								<icon :icon="selectedTtsProvider || selectedSttProvider ? 'mdi:check-circle' : 'mdi:minus-circle'" />
							</el-icon>
							<span>
								{{ t('buddyModule.wizard.summaryVoice') }}:
								<strong>{{ voiceSummary || t('buddyModule.wizard.skipped') }}</strong>
							</span>
						</div>
						<div
							v-if="hasMessagingProviders"
							class="flex items-center gap-2"
						>
							<el-icon :color="selectedMessagingProvider ? 'var(--el-color-success)' : 'var(--el-color-info)'">
								<icon :icon="selectedMessagingProvider ? 'mdi:check-circle' : 'mdi:minus-circle'" />
							</el-icon>
							<span>
								{{ t('buddyModule.wizard.summaryMessaging') }}:
								<strong>{{ selectedMessagingProviderName || t('buddyModule.wizard.skipped') }}</strong>
							</span>
						</div>
					</div>
				</div>
			</template>
		</div>

		<template #footer>
			<div class="flex justify-between">
				<el-button
					v-if="currentStep > 0"
					@click="prevStep"
				>
					{{ t('buddyModule.wizard.buttons.back') }}
				</el-button>
				<div v-else />

				<div class="flex gap-2">
					<el-button
						v-if="canSkip"
						@click="handleSkip"
					>
						{{ t('buddyModule.wizard.buttons.skip') }}
					</el-button>

					<el-button
						v-if="currentStepName === 'provider' && selectedLlmProvider && selectedLlmProviderNeedsConfig && llmFormChanged"
						type="success"
						:loading="isSavingLlmConfig"
						@click="saveLlmConfig"
					>
						{{ t('buddyModule.wizard.buttons.saveConfig') }}
					</el-button>

					<el-button
						v-if="currentStepName === 'voice' && activeVoiceProviderNeedsConfig && activeVoiceConfigForm && voiceFormChanged"
						type="success"
						:loading="isSavingVoiceConfig"
						@click="saveVoiceConfig"
					>
						{{ t('buddyModule.wizard.buttons.saveConfig') }}
					</el-button>

					<el-button
						v-if="currentStepName === 'messaging' && selectedMessagingProviderNeedsConfig && selectedMessagingConfigForm && messagingFormChanged"
						type="success"
						:loading="isSavingMessagingConfig"
						@click="saveMessagingConfig"
					>
						{{ t('buddyModule.wizard.buttons.saveConfig') }}
					</el-button>

					<el-button
						v-if="currentStepName === 'done'"
						type="primary"
						@click="handleFinish"
					>
						{{ t('buddyModule.wizard.buttons.startChatting') }}
					</el-button>
					<el-button
						v-else
						type="primary"
						:disabled="isNextDisabled"
						:loading="isSavingModuleConfig"
						@click="handleNext"
					>
						{{ t('buddyModule.wizard.buttons.next') }}
					</el-button>
				</div>
			</div>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { type Component, computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDialog, ElDivider, ElEmpty, ElIcon, ElScrollbar, ElStep, ElSteps, ElTag, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { CONFIG_MODULE_PLUGIN_TYPE, FormResult, type FormResultType } from '../../config/config.constants';
import type { IPluginsComponents, IPluginsSchemas } from '../../config/config.types';
import { usePlugins } from '../../config/composables/usePlugins';
import { configModulesStoreKey, configPluginsStoreKey } from '../../config/store/keys';
import { LLM_PROVIDER_NONE, STT_PLUGIN_NONE, TTS_PLUGIN_NONE } from '../buddy.constants';
import type { IProviderStatus } from '../composables/useBuddyProviders';
import { useBuddyProviders } from '../composables/useBuddyProviders';
import { useBuddyTtsProviders } from '../composables/useBuddyTtsProviders';
import { useBuddySttProviders } from '../composables/useBuddySttProviders';
import { useBuddyMessagingProviders } from '../composables/useBuddyMessagingProviders';
import type { IVoiceProviderStatus } from '../composables/useBuddyVoiceProviders';

defineOptions({
	name: 'BuddySetupWizard',
});

const props = defineProps<{
	visible: boolean;
}>();

const emit = defineEmits<{
	(e: 'update:visible', value: boolean): void;
	(e: 'completed'): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();
const storesManager = injectStoresManager();
const configModulesStore = storesManager.getStore(configModulesStoreKey);
const configPluginsStore = storesManager.getStore(configPluginsStoreKey);
const { getByName } = usePlugins();

const { providerStatuses: llmProviders, fetchProviderStatuses: fetchLlmProviders } = useBuddyProviders();
const { ttsProviderStatuses: ttsProviders, fetchTtsProviderStatuses: fetchTtsProviders } = useBuddyTtsProviders();
const { sttProviderStatuses: sttProviders, fetchSttProviderStatuses: fetchSttProviders } = useBuddySttProviders();
const { messagingProviderStatuses: messagingProviders, fetchMessagingProviderStatuses: fetchMessagingProviders } = useBuddyMessagingProviders();

const isLoading = ref(false);
const currentStep = ref(0);
const isSavingModuleConfig = ref(false);

// Selected providers
const selectedLlmProvider = ref<string | null>(null);
const selectedTtsProvider = ref<string | null>(null);
const selectedSttProvider = ref<string | null>(null);
const selectedMessagingProvider = ref<string | null>(null);

// Track which voice provider the user last clicked for inline config
const activeVoiceConfigType = ref<string | null>(null);

// Dynamic step names based on available providers
const hasVoiceProviders = computed(() => ttsProviders.value.length > 0 || sttProviders.value.length > 0);
const hasMessagingProviders = computed(() => messagingProviders.value.length > 0);

type StepName = 'provider' | 'voice' | 'messaging' | 'done';

const stepSequence = computed<StepName[]>(() => {
	const steps: StepName[] = ['provider'];

	if (hasVoiceProviders.value) {
		steps.push('voice');
	}

	if (hasMessagingProviders.value) {
		steps.push('messaging');
	}

	steps.push('done');

	return steps;
});

// Key for el-steps to force full re-render when the step set changes
const stepSequenceKey = computed(() => stepSequence.value.join(','));

const currentStepName = computed<StepName>(() => stepSequence.value[currentStep.value] ?? 'done');

// Clamp currentStep if stepSequence shrinks due to a provider refetch mid-wizard
watch(stepSequence, (seq) => {
	const maxStep = seq.length - 1;

	if (currentStep.value > maxStep) {
		currentStep.value = maxStep;
	}
});

const canSkip = computed(() => {
	const name = currentStepName.value;

	return name === 'voice' || name === 'messaging';
});

const isNextDisabled = computed<boolean>(() => {
	const step = currentStepName.value;

	if (step === 'provider') {
		// Must select a provider, and if it needs config, it must be saved first
		if (!selectedLlmProvider.value) return true;

		return selectedLlmProviderNeedsConfig.value;
	}

	if (step === 'voice') {
		// Check both TTS and STT independently — not just the active/focused one
		if (selectedTtsProvider.value) {
			const tts = ttsProviders.value.find((p) => p.type === selectedTtsProvider.value);

			if (tts && !tts.configured) return true;
		}

		if (selectedSttProvider.value) {
			const stt = sttProviders.value.find((p) => p.type === selectedSttProvider.value);

			if (stt && !stt.configured) return true;
		}

		return false;
	}

	if (step === 'messaging') {
		return selectedMessagingProviderNeedsConfig.value;
	}

	return false;
});

// LLM provider helpers
const selectedLlmProviderData = computed<IProviderStatus | undefined>(() => {
	return llmProviders.value.find((p) => p.type === selectedLlmProvider.value);
});

const selectedLlmProviderName = computed<string>(() => selectedLlmProviderData.value?.name ?? '');

const selectedLlmProviderNeedsConfig = computed<boolean>(() => {
	const data = selectedLlmProviderData.value;

	return !!data && !data.configured;
});

// LLM config form
const llmFormSubmit = ref(false);
const llmFormResult = ref<FormResultType>(FormResult.NONE);
const llmFormReset = ref(false);
const llmFormChanged = ref(false);
const isSavingLlmConfig = ref(false);

const selectedLlmConfigForm = computed<Component | null>(() => {
	if (!selectedLlmProvider.value) return null;

	const plugin = getByName(selectedLlmProvider.value);
	const element = plugin?.elements?.find(
		(el: { type: string; components?: IPluginsComponents; schemas?: IPluginsSchemas }) => el.type === CONFIG_MODULE_PLUGIN_TYPE,
	);

	return (element?.components?.pluginConfigEditForm as Component) ?? null;
});

const selectedLlmConfigPlugin = computed(() => {
	if (!selectedLlmProvider.value) return null;

	return configPluginsStore.findByType(selectedLlmProvider.value);
});

// Voice config form
const voiceFormSubmit = ref(false);
const voiceFormResult = ref<FormResultType>(FormResult.NONE);
const voiceFormReset = ref(false);
const voiceFormChanged = ref(false);
const isSavingVoiceConfig = ref(false);

const activeVoiceProviderName = computed<string>(() => {
	if (!activeVoiceConfigType.value) return '';

	const tts = ttsProviders.value.find((p) => p.type === activeVoiceConfigType.value);

	if (tts) return tts.name;

	const stt = sttProviders.value.find((p) => p.type === activeVoiceConfigType.value);

	return stt?.name ?? '';
});

const activeVoiceProviderNeedsConfig = computed<boolean>(() => {
	if (!activeVoiceConfigType.value) return false;

	const tts = ttsProviders.value.find((p) => p.type === activeVoiceConfigType.value);

	if (tts) return !tts.configured;

	const stt = sttProviders.value.find((p) => p.type === activeVoiceConfigType.value);

	return !!stt && !stt.configured;
});

const activeVoiceConfigForm = computed<Component | null>(() => {
	if (!activeVoiceConfigType.value) return null;

	const plugin = getByName(activeVoiceConfigType.value);
	const element = plugin?.elements?.find(
		(el: { type: string; components?: IPluginsComponents; schemas?: IPluginsSchemas }) => el.type === CONFIG_MODULE_PLUGIN_TYPE,
	);

	return (element?.components?.pluginConfigEditForm as Component) ?? null;
});

const activeVoiceConfigPlugin = computed(() => {
	if (!activeVoiceConfigType.value) return null;

	return configPluginsStore.findByType(activeVoiceConfigType.value);
});

// Messaging config form
const messagingFormSubmit = ref(false);
const messagingFormResult = ref<FormResultType>(FormResult.NONE);
const messagingFormReset = ref(false);
const messagingFormChanged = ref(false);
const isSavingMessagingConfig = ref(false);

const selectedMessagingProviderName = computed<string>(() => {
	return messagingProviders.value.find((p) => p.type === selectedMessagingProvider.value)?.name ?? '';
});

const selectedMessagingProviderNeedsConfig = computed<boolean>(() => {
	const data = messagingProviders.value.find((p) => p.type === selectedMessagingProvider.value);

	return !!data && !data.configured;
});

const selectedMessagingConfigForm = computed<Component | null>(() => {
	if (!selectedMessagingProvider.value) return null;

	const plugin = getByName(selectedMessagingProvider.value);
	const element = plugin?.elements?.find(
		(el: { type: string; components?: IPluginsComponents; schemas?: IPluginsSchemas }) => el.type === CONFIG_MODULE_PLUGIN_TYPE,
	);

	return (element?.components?.pluginConfigEditForm as Component) ?? null;
});

const selectedMessagingConfigPlugin = computed(() => {
	if (!selectedMessagingProvider.value) return null;

	return configPluginsStore.findByType(selectedMessagingProvider.value);
});

// Summary
const voiceSummary = computed<string>(() => {
	const parts: string[] = [];

	if (selectedTtsProvider.value) {
		const name = ttsProviders.value.find((p) => p.type === selectedTtsProvider.value)?.name;

		if (name) parts.push(`TTS: ${name}`);
	}

	if (selectedSttProvider.value) {
		const name = sttProviders.value.find((p) => p.type === selectedSttProvider.value)?.name;

		if (name) parts.push(`STT: ${name}`);
	}

	return parts.join(', ');
});

// Actions
const selectLlmProvider = (type: string): void => {
	selectedLlmProvider.value = selectedLlmProvider.value === type ? null : type;

	// Reset form refs so stale state from a previous provider's form doesn't carry over
	isSavingLlmConfig.value = false;
	llmFormSubmit.value = false;
	llmFormResult.value = FormResult.NONE;
	llmFormChanged.value = false;

	// Fetch config for this plugin if not loaded
	if (selectedLlmProvider.value) {
		fetchPluginConfig(selectedLlmProvider.value);
	}
};

const resetVoiceFormRefs = (): void => {
	isSavingVoiceConfig.value = false;
	voiceFormSubmit.value = false;
	voiceFormResult.value = FormResult.NONE;
	voiceFormChanged.value = false;
};

const pickActiveVoiceConfig = (): void => {
	const ttsType = selectedTtsProvider.value;
	const sttType = selectedSttProvider.value;

	const ttsNeedsConfig = ttsType ? !ttsProviders.value.find((p) => p.type === ttsType)?.configured : false;
	const sttNeedsConfig = sttType ? !sttProviders.value.find((p) => p.type === sttType)?.configured : false;

	const prevActive = activeVoiceConfigType.value;

	// Prefer showing the unconfigured provider's form so the user can resolve it
	if (ttsNeedsConfig) {
		activeVoiceConfigType.value = ttsType;
	} else if (sttNeedsConfig) {
		activeVoiceConfigType.value = sttType;
	} else {
		// Both configured (or none selected) — show the most recently toggled one
		activeVoiceConfigType.value = ttsType ?? sttType;
	}

	// Reset form refs when the active provider changes to prevent stale state
	if (activeVoiceConfigType.value !== prevActive) {
		resetVoiceFormRefs();
	}
};

const selectTtsProvider = (type: string): void => {
	selectedTtsProvider.value = selectedTtsProvider.value === type ? null : type;

	pickActiveVoiceConfig();

	if (selectedTtsProvider.value) {
		fetchPluginConfig(selectedTtsProvider.value);
	}
};

const selectSttProvider = (type: string): void => {
	selectedSttProvider.value = selectedSttProvider.value === type ? null : type;

	pickActiveVoiceConfig();

	if (selectedSttProvider.value) {
		fetchPluginConfig(selectedSttProvider.value);
	}
};

const selectMessagingProvider = (type: string): void => {
	selectedMessagingProvider.value = selectedMessagingProvider.value === type ? null : type;

	// Reset form refs so stale state from a previous provider's form doesn't carry over
	isSavingMessagingConfig.value = false;
	messagingFormSubmit.value = false;
	messagingFormResult.value = FormResult.NONE;
	messagingFormChanged.value = false;

	if (selectedMessagingProvider.value) {
		fetchPluginConfig(selectedMessagingProvider.value);
	}
};

const fetchPluginConfig = async (type: string): Promise<void> => {
	if (configPluginsStore.findByType(type)) return;

	try {
		await configPluginsStore.get({ type });
	} catch {
		// Config may not exist yet, that's fine
	}
};

const saveLlmConfig = (): void => {
	isSavingLlmConfig.value = true;
	llmFormSubmit.value = true;
};

const saveVoiceConfig = (): void => {
	isSavingVoiceConfig.value = true;
	voiceFormSubmit.value = true;
};

const saveMessagingConfig = (): void => {
	isSavingMessagingConfig.value = true;
	messagingFormSubmit.value = true;
};

// Watch form results for save completion
watch(llmFormResult, (val: FormResultType) => {
	if (val === FormResult.OK || val === FormResult.ERROR) {
		isSavingLlmConfig.value = false;
	}

	if (val === FormResult.OK) {
		flashMessage.success(t('buddyModule.wizard.configSaved'));

		// Refresh provider statuses
		fetchLlmProviders();
	}
});

watch(voiceFormResult, (val: FormResultType) => {
	if (val === FormResult.OK || val === FormResult.ERROR) {
		isSavingVoiceConfig.value = false;
	}

	if (val === FormResult.OK) {
		flashMessage.success(t('buddyModule.wizard.configSaved'));

		// Refresh provider statuses, then switch to the next unconfigured provider if any
		Promise.all([fetchTtsProviders(), fetchSttProviders()]).then(() => {
			pickActiveVoiceConfig();
		});
	}
});

watch(messagingFormResult, (val: FormResultType) => {
	if (val === FormResult.OK || val === FormResult.ERROR) {
		isSavingMessagingConfig.value = false;
	}

	if (val === FormResult.OK) {
		flashMessage.success(t('buddyModule.wizard.configSaved'));
		fetchMessagingProviders();
	}
});

const saveModuleConfig = async (includeVoice: boolean = false): Promise<boolean> => {
	isSavingModuleConfig.value = true;

	try {
		const configData: Record<string, unknown> = {
			type: 'buddy-module',
			enabled: true,
		};

		if (selectedLlmProvider.value) {
			configData.provider = selectedLlmProvider.value;
		}

		// Only include voice fields when explicitly saving voice config,
		// so we don't overwrite existing voice settings when saving from the provider step
		if (includeVoice) {
			const hasVoiceSelection = !!(selectedTtsProvider.value || selectedSttProvider.value);

			configData.voiceEnabled = hasVoiceSelection;
			configData.ttsPlugin = selectedTtsProvider.value ?? TTS_PLUGIN_NONE;
			configData.sttPlugin = selectedSttProvider.value ?? STT_PLUGIN_NONE;
		}

		await configModulesStore.edit({
			data: configData as never,
		});

		return true;
	} catch (err: unknown) {
		flashMessage.error(err instanceof Error ? err.message : t('buddyModule.wizard.saveError'));

		return false;
	} finally {
		isSavingModuleConfig.value = false;
	}
};

const nextStep = (): void => {
	if (currentStep.value < stepSequence.value.length - 1) {
		currentStep.value++;
	}
};

const prevStep = (): void => {
	if (currentStep.value > 0) {
		currentStep.value--;
	}
};

const handleSkip = async (): Promise<void> => {
	// Clear selections for the skipped step and persist to the server
	if (currentStepName.value === 'voice') {
		selectedTtsProvider.value = null;
		selectedSttProvider.value = null;
		activeVoiceConfigType.value = null;

		const saved = await saveModuleConfig(true);

		if (!saved) return;
	} else if (currentStepName.value === 'messaging') {
		selectedMessagingProvider.value = null;
	}

	nextStep();
};

const handleNext = async (): Promise<void> => {
	// When leaving the provider step, save the module config
	if (currentStepName.value === 'provider' && selectedLlmProvider.value) {
		const saved = await saveModuleConfig();

		if (!saved) return;
	}

	// When leaving the voice step, always save (even when deselecting to clear old values)
	if (currentStepName.value === 'voice') {
		const saved = await saveModuleConfig(true);

		if (!saved) return;
	}

	// Messaging plugins are configured entirely through their inline config forms
	// (saveMessagingConfig). No module-level config field exists for messaging,
	// so no saveModuleConfig call is needed here.

	nextStep();
};

const handleFinish = (): void => {
	emit('update:visible', false);
	emit('completed');
};

const loadAllData = async (): Promise<void> => {
	isLoading.value = true;

	try {
		await Promise.all([fetchLlmProviders(), fetchTtsProviders(), fetchSttProviders(), fetchMessagingProviders()]);

		// Pre-select currently selected providers and fetch their configs in parallel
		const selected = llmProviders.value.find((p: IProviderStatus) => p.selected);
		const selectedTts = ttsProviders.value.find((p: IVoiceProviderStatus) => p.selected);
		const selectedStt = sttProviders.value.find((p: IVoiceProviderStatus) => p.selected);

		if (selected && selected.type !== LLM_PROVIDER_NONE) {
			selectedLlmProvider.value = selected.type;
		}

		if (selectedTts) {
			selectedTtsProvider.value = selectedTts.type;
			activeVoiceConfigType.value = selectedTts.type;
		}

		if (selectedStt) {
			selectedSttProvider.value = selectedStt.type;

			// Only override activeVoiceConfigType if TTS wasn't pre-selected
			if (!selectedTts) {
				activeVoiceConfigType.value = selectedStt.type;
			}
		}

		// Fetch all pre-selected plugin configs before clearing isLoading
		const configFetches: Promise<void>[] = [];

		if (selected && selected.type !== LLM_PROVIDER_NONE) {
			configFetches.push(fetchPluginConfig(selected.type));
		}

		if (selectedTts) {
			configFetches.push(fetchPluginConfig(selectedTts.type));
		}

		if (selectedStt) {
			configFetches.push(fetchPluginConfig(selectedStt.type));
		}

		await Promise.all(configFetches);
	} finally {
		isLoading.value = false;
	}
};

watch(
	() => props.visible,
	(val: boolean) => {
		if (val) {
			// Reset all wizard state so stale values from a previous session don't persist
			currentStep.value = 0;
			selectedLlmProvider.value = null;
			selectedTtsProvider.value = null;
			selectedSttProvider.value = null;
			selectedMessagingProvider.value = null;
			activeVoiceConfigType.value = null;

			// Reset saving flags and form refs to prevent perpetual spinners
			isSavingLlmConfig.value = false;
			isSavingVoiceConfig.value = false;
			isSavingMessagingConfig.value = false;
			isSavingModuleConfig.value = false;
			llmFormSubmit.value = false;
			llmFormResult.value = FormResult.NONE;
			llmFormReset.value = false;
			llmFormChanged.value = false;
			voiceFormSubmit.value = false;
			voiceFormResult.value = FormResult.NONE;
			voiceFormReset.value = false;
			voiceFormChanged.value = false;
			messagingFormSubmit.value = false;
			messagingFormResult.value = FormResult.NONE;
			messagingFormReset.value = false;
			messagingFormChanged.value = false;

			loadAllData();
		}
	},
);

onBeforeMount(() => {
	if (props.visible) {
		loadAllData();
	}
});
</script>
