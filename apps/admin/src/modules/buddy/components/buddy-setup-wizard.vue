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

		<el-alert
			v-if="currentStepName === 'provider'"
			type="info"
			:title="t('buddyModule.wizard.providerDescription')"
			:closable="false"
			show-icon
			class="mb-4!"
		/>
		<el-alert
			v-else-if="currentStepName === 'voice'"
			type="info"
			:title="t('buddyModule.wizard.voiceDescription')"
			:closable="false"
			show-icon
			class="mb-4!"
		/>
		<el-alert
			v-else-if="currentStepName === 'messaging'"
			type="info"
			:title="t('buddyModule.wizard.messagingDescription')"
			:closable="false"
			show-icon
			class="mb-4!"
		/>

		<div
			v-loading="isLoading"
			class="min-h-[200px]"
		>
			<!-- Step 1: LLM Provider Selection -->
			<template v-if="currentStepName === 'provider'">
				<el-scrollbar max-height="40vh">
					<div
						v-if="llmProviders.length === 0 && !isLoading"
						class="text-center py-8"
					>
						<el-empty :description="t('buddyModule.wizard.noProvidersAvailable')" />
					</div>

					<div
						v-else
						class="flex flex-col gap-3"
					>
						<div
							v-for="provider in llmProviders"
							:key="provider.type"
							class="rounded-lg border transition-all duration-300"
							:class="provider.enabled ? 'border-primary bg-primary/5' : 'border-gray-200'"
						>
							<div class="flex items-center gap-3 p-3">
								<el-radio
									v-model="selectedLlmProvider"
									:value="provider.type"
									:disabled="!provider.enabled"
									class="mr-0! shrink-0"
								/>
								<div
									class="flex items-center gap-3 flex-1 min-w-0"
									:class="provider.enabled ? 'cursor-pointer' : ''"
									@click="provider.enabled && (selectedLlmProvider = provider.type)"
								>
									<el-icon
										:size="32"
										class="shrink-0"
										:class="provider.enabled ? 'text-primary' : 'text-gray-400'"
									>
										<icon :icon="getPluginIcon(provider.type)" />
									</el-icon>
									<div class="flex-1 min-w-0">
										<div class="font-medium">
											{{ provider.name }}
											<span
												v-if="provider.default_model"
												class="text-xs text-[var(--el-text-color-secondary)] ml-2"
											>
												{{ provider.default_model }}
											</span>
										</div>
										<div
											v-if="provider.description"
											class="text-xs text-gray-500 truncate"
										>
											{{ provider.description }}
										</div>
									</div>
								</div>
								<el-switch
									:model-value="provider.enabled"
									:disabled="!canTogglePlugin(provider.type) || isTogglingPlugin(provider.type)"
									:loading="isTogglingPlugin(provider.type)"
									@update:model-value="(val: string | number | boolean) => toggleLlmPlugin(provider.type, !!val)"
								/>
							</div>

							<!-- Expanded section when enabled -->
							<div
								v-if="provider.enabled"
								class="border-t border-primary/20 px-3 py-2 flex items-center justify-between gap-2"
							>
								<div class="flex items-center gap-2 text-xs min-w-0">
									<template v-if="provider.configured">
										<el-icon
											:size="14"
											class="text-green-500"
										>
											<icon icon="mdi:check-circle" />
										</el-icon>
										<span class="text-green-600">
											{{ t('buddyModule.wizard.configured') }}
										</span>
									</template>
									<template v-else>
										<el-icon
											:size="14"
											class="text-orange-500"
										>
											<icon icon="mdi:alert-circle-outline" />
										</el-icon>
										<span class="text-orange-600">
											{{ t('buddyModule.wizard.configRequired') }}
										</span>
									</template>
								</div>
								<el-button
									v-if="hasPluginConfigForm(provider.type)"
									size="small"
									text
									type="primary"
									@click="openConfigDialog(provider.type, provider.name)"
								>
									<el-icon
										:size="14"
										class="mr-1"
									>
										<icon icon="mdi:cog-outline" />
									</el-icon>
									{{ t('buddyModule.wizard.buttons.configure') }}
								</el-button>
							</div>
						</div>
					</div>
				</el-scrollbar>
			</template>

			<!-- Step 2: Voice (TTS / STT) -->
			<template v-if="currentStepName === 'voice'">
				<el-scrollbar max-height="40vh">
					<!-- TTS -->
					<h4 class="m-0 mb-2">
						{{ t('buddyModule.wizard.ttsHeading') }}
					</h4>
					<div class="flex flex-col gap-3 mb-4">
						<div
							v-for="provider in ttsProviders"
							:key="provider.type"
							class="rounded-lg border transition-all duration-300"
							:class="provider.enabled ? 'border-primary bg-primary/5' : 'border-gray-200'"
						>
							<div class="flex items-center gap-3 p-3">
								<el-radio
									v-model="selectedTtsProvider"
									:value="provider.type"
									:disabled="!provider.enabled"
									class="mr-0! shrink-0"
								/>
								<div
									class="flex items-center gap-3 flex-1 min-w-0"
									:class="provider.enabled ? 'cursor-pointer' : ''"
									@click="provider.enabled && (selectedTtsProvider = provider.type)"
								>
									<el-icon
										:size="32"
										class="shrink-0"
										:class="provider.enabled ? 'text-primary' : 'text-gray-400'"
									>
										<icon :icon="getPluginIcon(provider.type)" />
									</el-icon>
									<div class="flex-1 min-w-0">
										<div class="font-medium">{{ provider.name }}</div>
										<div
											v-if="provider.description"
											class="text-xs text-gray-500 truncate"
										>
											{{ provider.description }}
										</div>
									</div>
								</div>
								<el-switch
									:model-value="provider.enabled"
									:disabled="!canTogglePlugin(provider.type) || isTogglingPlugin(provider.type)"
									:loading="isTogglingPlugin(provider.type)"
									@update:model-value="(val: string | number | boolean) => toggleTtsPlugin(provider.type, !!val)"
								/>
							</div>

							<div
								v-if="provider.enabled"
								class="border-t border-primary/20 px-3 py-2 flex items-center justify-between gap-2"
							>
								<div class="flex items-center gap-2 text-xs min-w-0">
									<template v-if="provider.configured">
										<el-icon
											:size="14"
											class="text-green-500"
										>
											<icon icon="mdi:check-circle" />
										</el-icon>
										<span class="text-green-600">
											{{ t('buddyModule.wizard.configured') }}
										</span>
									</template>
									<template v-else>
										<el-icon
											:size="14"
											class="text-orange-500"
										>
											<icon icon="mdi:alert-circle-outline" />
										</el-icon>
										<span class="text-orange-600">
											{{ t('buddyModule.wizard.configRequired') }}
										</span>
									</template>
								</div>
								<el-button
									v-if="hasPluginConfigForm(provider.type)"
									size="small"
									text
									type="primary"
									@click="openConfigDialog(provider.type, provider.name)"
								>
									<el-icon
										:size="14"
										class="mr-1"
									>
										<icon icon="mdi:cog-outline" />
									</el-icon>
									{{ t('buddyModule.wizard.buttons.configure') }}
								</el-button>
							</div>
						</div>
					</div>

					<!-- STT -->
					<h4 class="m-0 mb-2">
						{{ t('buddyModule.wizard.sttHeading') }}
					</h4>
					<div class="flex flex-col gap-3">
						<div
							v-for="provider in sttProviders"
							:key="provider.type"
							class="rounded-lg border transition-all duration-300"
							:class="provider.enabled ? 'border-primary bg-primary/5' : 'border-gray-200'"
						>
							<div class="flex items-center gap-3 p-3">
								<el-radio
									v-model="selectedSttProvider"
									:value="provider.type"
									:disabled="!provider.enabled"
									class="mr-0! shrink-0"
								/>
								<div
									class="flex items-center gap-3 flex-1 min-w-0"
									:class="provider.enabled ? 'cursor-pointer' : ''"
									@click="provider.enabled && (selectedSttProvider = provider.type)"
								>
									<el-icon
										:size="32"
										class="shrink-0"
										:class="provider.enabled ? 'text-primary' : 'text-gray-400'"
									>
										<icon :icon="getPluginIcon(provider.type)" />
									</el-icon>
									<div class="flex-1 min-w-0">
										<div class="font-medium">{{ provider.name }}</div>
										<div
											v-if="provider.description"
											class="text-xs text-gray-500 truncate"
										>
											{{ provider.description }}
										</div>
									</div>
								</div>
								<el-switch
									:model-value="provider.enabled"
									:disabled="!canTogglePlugin(provider.type) || isTogglingPlugin(provider.type)"
									:loading="isTogglingPlugin(provider.type)"
									@update:model-value="(val: string | number | boolean) => toggleSttPlugin(provider.type, !!val)"
								/>
							</div>

							<div
								v-if="provider.enabled"
								class="border-t border-primary/20 px-3 py-2 flex items-center justify-between gap-2"
							>
								<div class="flex items-center gap-2 text-xs min-w-0">
									<template v-if="provider.configured">
										<el-icon
											:size="14"
											class="text-green-500"
										>
											<icon icon="mdi:check-circle" />
										</el-icon>
										<span class="text-green-600">
											{{ t('buddyModule.wizard.configured') }}
										</span>
									</template>
									<template v-else>
										<el-icon
											:size="14"
											class="text-orange-500"
										>
											<icon icon="mdi:alert-circle-outline" />
										</el-icon>
										<span class="text-orange-600">
											{{ t('buddyModule.wizard.configRequired') }}
										</span>
									</template>
								</div>
								<el-button
									v-if="hasPluginConfigForm(provider.type)"
									size="small"
									text
									type="primary"
									@click="openConfigDialog(provider.type, provider.name)"
								>
									<el-icon
										:size="14"
										class="mr-1"
									>
										<icon icon="mdi:cog-outline" />
									</el-icon>
									{{ t('buddyModule.wizard.buttons.configure') }}
								</el-button>
							</div>
						</div>
					</div>
				</el-scrollbar>
			</template>

			<!-- Step 3: Messaging -->
			<template v-if="currentStepName === 'messaging'">
				<el-scrollbar max-height="40vh">
					<div class="flex flex-col gap-3">
						<div
							v-for="provider in messagingProviders"
							:key="provider.type"
							class="rounded-lg border transition-all duration-300"
							:class="provider.enabled ? 'border-primary bg-primary/5' : 'border-gray-200'"
						>
							<div class="flex items-center gap-3 p-3">
								<el-radio
									v-model="selectedMessagingProvider"
									:value="provider.type"
									:disabled="!provider.enabled"
									class="mr-0! shrink-0"
								/>
								<div
									class="flex items-center gap-3 flex-1 min-w-0"
									:class="provider.enabled ? 'cursor-pointer' : ''"
									@click="provider.enabled && (selectedMessagingProvider = provider.type)"
								>
									<el-icon
										:size="32"
										class="shrink-0"
										:class="provider.enabled ? 'text-primary' : 'text-gray-400'"
									>
										<icon :icon="getPluginIcon(provider.type)" />
									</el-icon>
									<div class="flex-1 min-w-0">
										<div class="font-medium">{{ provider.name }}</div>
										<div
											v-if="provider.description"
											class="text-xs text-gray-500 truncate"
										>
											{{ provider.description }}
										</div>
									</div>
								</div>
								<el-switch
									:model-value="provider.enabled"
									:disabled="!canTogglePlugin(provider.type) || isTogglingPlugin(provider.type)"
									:loading="isTogglingPlugin(provider.type)"
									@update:model-value="(val: string | number | boolean) => toggleMessagingPlugin(provider.type, !!val)"
								/>
							</div>

							<div
								v-if="provider.enabled"
								class="border-t border-primary/20 px-3 py-2 flex items-center justify-between gap-2"
							>
								<div class="flex items-center gap-2 text-xs min-w-0">
									<template v-if="provider.configured">
										<el-icon
											:size="14"
											class="text-green-500"
										>
											<icon icon="mdi:check-circle" />
										</el-icon>
										<span class="text-green-600">
											{{ t('buddyModule.wizard.configured') }}
										</span>
									</template>
									<template v-else>
										<el-icon
											:size="14"
											class="text-orange-500"
										>
											<icon icon="mdi:alert-circle-outline" />
										</el-icon>
										<span class="text-orange-600">
											{{ t('buddyModule.wizard.configRequired') }}
										</span>
									</template>
								</div>
								<el-button
									v-if="hasPluginConfigForm(provider.type)"
									size="small"
									text
									type="primary"
									@click="openConfigDialog(provider.type, provider.name)"
								>
									<el-icon
										:size="14"
										class="mr-1"
									>
										<icon icon="mdi:cog-outline" />
									</el-icon>
									{{ t('buddyModule.wizard.buttons.configure') }}
								</el-button>
							</div>
						</div>
					</div>
				</el-scrollbar>
			</template>

			<!-- Step 4: Done -->
			<template v-if="currentStepName === 'done'">
				<div class="flex flex-col items-center text-center py-8 px-4">
					<el-icon
						:size="80"
						class="mb-6 text-green-500"
					>
						<icon icon="mdi:check-circle-outline" />
					</el-icon>

					<h2 class="text-2xl font-bold mb-4">
						{{ t('buddyModule.wizard.doneTitle') }}
					</h2>

					<el-alert
						type="info"
						:title="t('buddyModule.wizard.doneDescription')"
						:closable="false"
						show-icon
						class="mb-8! max-w-md"
					/>

					<div class="flex flex-col gap-3 max-w-sm w-full">
						<!-- AI Provider -->
						<div
							v-if="selectedLlmProvider"
							class="flex items-center gap-3 p-3 rounded-lg bg-green-50"
						>
							<el-icon
								:size="20"
								class="text-green-500 shrink-0"
							>
								<icon icon="mdi:check" />
							</el-icon>
							<span>{{ t('buddyModule.wizard.summaryLlm', { name: selectedLlmProviderName }) }}</span>
						</div>
						<div
							v-else
							class="flex items-center gap-3 p-3 rounded-lg bg-gray-50"
						>
							<el-icon
								:size="20"
								class="text-gray-400 shrink-0"
							>
								<icon icon="mdi:minus" />
							</el-icon>
							<span class="text-gray-400">{{ t('buddyModule.wizard.summaryLlmSkipped') }}</span>
						</div>

						<!-- Voice -->
						<div
							v-if="hasVoiceProviders && voiceSummary"
							class="flex items-center gap-3 p-3 rounded-lg bg-green-50"
						>
							<el-icon
								:size="20"
								class="text-green-500 shrink-0"
							>
								<icon icon="mdi:check" />
							</el-icon>
							<span>{{ t('buddyModule.wizard.summaryVoice', { summary: voiceSummary }) }}</span>
						</div>
						<div
							v-else-if="hasVoiceProviders"
							class="flex items-center gap-3 p-3 rounded-lg bg-gray-50"
						>
							<el-icon
								:size="20"
								class="text-gray-400 shrink-0"
							>
								<icon icon="mdi:minus" />
							</el-icon>
							<span class="text-gray-400">{{ t('buddyModule.wizard.summaryVoiceSkipped') }}</span>
						</div>

						<!-- Messaging -->
						<div
							v-if="hasMessagingProviders && selectedMessagingProvider"
							class="flex items-center gap-3 p-3 rounded-lg bg-green-50"
						>
							<el-icon
								:size="20"
								class="text-green-500 shrink-0"
							>
								<icon icon="mdi:check" />
							</el-icon>
							<span>{{ t('buddyModule.wizard.summaryMessaging', { name: selectedMessagingProviderName }) }}</span>
						</div>
						<div
							v-else-if="hasMessagingProviders"
							class="flex items-center gap-3 p-3 rounded-lg bg-gray-50"
						>
							<el-icon
								:size="20"
								class="text-gray-400 shrink-0"
							>
								<icon icon="mdi:minus" />
							</el-icon>
							<span class="text-gray-400">{{ t('buddyModule.wizard.summaryMessagingSkipped') }}</span>
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

		<integration-config-dialog
			v-model:visible="configDialogVisible"
			:plugin-type="configDialogPluginType"
			:plugin-name="configDialogPluginName"
			@saved="onConfigSaved"
		/>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElDialog, ElEmpty, ElIcon, ElRadio, ElScrollbar, ElStep, ElSteps, ElSwitch, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { CONFIG_MODULE_PLUGIN_TYPE } from '../../config/config.constants';
import type { IPluginsComponents, IPluginsSchemas } from '../../config/config.types';
import { usePlugins } from '../../config/composables/usePlugins';
import { configModulesStoreKey, configPluginsStoreKey } from '../../config/store/keys';
import { extensionsStoreKey } from '../../extensions/store/keys';
import IntegrationConfigDialog from '../../onboarding/components/integration-config-dialog.vue';
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
const extensionsStore = storesManager.getStore(extensionsStoreKey);
const { getByName } = usePlugins();

const { providerStatuses: llmProviders, fetchProviderStatuses: fetchLlmProviders } = useBuddyProviders();
const { ttsProviderStatuses: ttsProviders, fetchTtsProviderStatuses: fetchTtsProviders } = useBuddyTtsProviders();
const { sttProviderStatuses: sttProviders, fetchSttProviderStatuses: fetchSttProviders } = useBuddySttProviders();
const { messagingProviderStatuses: messagingProviders, fetchMessagingProviderStatuses: fetchMessagingProviders } = useBuddyMessagingProviders();

const isLoading = ref(false);
const currentStep = ref(0);
const isSavingModuleConfig = ref(false);

// Selected providers (bound to radio buttons)
const selectedLlmProvider = ref<string | undefined>(undefined);
const selectedTtsProvider = ref<string | undefined>(undefined);
const selectedSttProvider = ref<string | undefined>(undefined);
const selectedMessagingProvider = ref<string | undefined>(undefined);

// Plugin toggle state
const togglingPlugins = reactive<Set<string>>(new Set());

// Config dialog state
const configDialogVisible = ref(false);
const configDialogPluginType = ref('');
const configDialogPluginName = ref('');

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
		if (!selectedLlmProvider.value) return true;

		const provider = llmProviders.value.find((p) => p.type === selectedLlmProvider.value);

		return !!provider && !provider.configured;
	}

	if (step === 'voice') {
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
		if (selectedMessagingProvider.value) {
			const msg = messagingProviders.value.find((p) => p.type === selectedMessagingProvider.value);

			if (msg && !msg.configured) return true;
		}

		return false;
	}

	return false;
});

// Plugin icon mapping
const pluginIcons: Record<string, string> = {
	'buddy-openai-plugin': 'mdi:creation',
	'buddy-openai-codex-plugin': 'mdi:code-braces',
	'buddy-claude-plugin': 'mdi:head-snowflake',
	'buddy-claude-setup-token-plugin': 'mdi:key-variant',
	'buddy-ollama-plugin': 'mdi:server',
	'buddy-elevenlabs-plugin': 'mdi:waveform',
	'buddy-system-tts-plugin': 'mdi:text-to-speech',
	'buddy-stt-whisper-local-plugin': 'mdi:microphone',
	'buddy-voiceai-plugin': 'mdi:account-voice',
	'buddy-telegram-plugin': 'mdi:send',
	'buddy-whatsapp-plugin': 'mdi:chat',
	'buddy-discord-plugin': 'mdi:forum',
};

const getPluginIcon = (type: string): string => {
	return pluginIcons[type] ?? 'mdi:robot';
};

const isTogglingPlugin = (type: string): boolean => togglingPlugins.has(type);

const canTogglePlugin = (type: string): boolean => {
	const ext = extensionsStore.findByType(type);

	return ext?.canToggleEnabled ?? true;
};

const hasPluginConfigForm = (type: string): boolean => {
	const plugin = getByName(type);

	if (!plugin) return false;

	const element = plugin.elements?.find(
		(el: { type: string; components?: IPluginsComponents; schemas?: IPluginsSchemas }) => el.type === CONFIG_MODULE_PLUGIN_TYPE,
	);

	return !!element?.components?.pluginConfigEditForm;
};

// LLM provider helpers
const selectedLlmProviderData = computed<IProviderStatus | undefined>(() => {
	return llmProviders.value.find((p) => p.type === selectedLlmProvider.value);
});

const selectedLlmProviderName = computed<string>(() => selectedLlmProviderData.value?.name ?? '');

// Messaging provider helpers
const selectedMessagingProviderName = computed<string>(() => {
	return messagingProviders.value.find((p) => p.type === selectedMessagingProvider.value)?.name ?? '';
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

// Plugin toggle handlers — auto-select on enable, clear on disable
const toggleLlmPlugin = async (type: string, enabled: boolean): Promise<void> => {
	togglingPlugins.add(type);

	try {
		await extensionsStore.update({ type, data: { enabled } });
		await fetchLlmProviders();

		if (enabled) {
			selectedLlmProvider.value = type;
			fetchPluginConfig(type);
		} else if (selectedLlmProvider.value === type) {
			selectedLlmProvider.value = undefined;
		}
	} catch {
		// Toggle failed, provider statuses will reflect actual state
	} finally {
		togglingPlugins.delete(type);
	}
};

const toggleTtsPlugin = async (type: string, enabled: boolean): Promise<void> => {
	togglingPlugins.add(type);

	try {
		await extensionsStore.update({ type, data: { enabled } });
		await fetchTtsProviders();

		if (enabled) {
			selectedTtsProvider.value = type;
			fetchPluginConfig(type);
		} else if (selectedTtsProvider.value === type) {
			selectedTtsProvider.value = undefined;
		}
	} catch {
		// Toggle failed
	} finally {
		togglingPlugins.delete(type);
	}
};

const toggleSttPlugin = async (type: string, enabled: boolean): Promise<void> => {
	togglingPlugins.add(type);

	try {
		await extensionsStore.update({ type, data: { enabled } });
		await fetchSttProviders();

		if (enabled) {
			selectedSttProvider.value = type;
			fetchPluginConfig(type);
		} else if (selectedSttProvider.value === type) {
			selectedSttProvider.value = undefined;
		}
	} catch {
		// Toggle failed
	} finally {
		togglingPlugins.delete(type);
	}
};

const toggleMessagingPlugin = async (type: string, enabled: boolean): Promise<void> => {
	togglingPlugins.add(type);

	try {
		await extensionsStore.update({ type, data: { enabled } });
		await fetchMessagingProviders();

		if (enabled) {
			selectedMessagingProvider.value = type;
			fetchPluginConfig(type);
		} else if (selectedMessagingProvider.value === type) {
			selectedMessagingProvider.value = undefined;
		}
	} catch {
		// Toggle failed
	} finally {
		togglingPlugins.delete(type);
	}
};

// Config dialog
const openConfigDialog = (type: string, name: string): void => {
	configDialogPluginType.value = type;
	configDialogPluginName.value = name;
	configDialogVisible.value = true;
};

const onConfigSaved = (): void => {
	// Refresh all provider statuses to update configured state
	fetchLlmProviders();
	fetchTtsProviders();
	fetchSttProviders();
	fetchMessagingProviders();
};

const fetchPluginConfig = async (type: string): Promise<void> => {
	if (configPluginsStore.findByType(type)) return;

	try {
		await configPluginsStore.get({ type });
	} catch {
		// Config may not exist yet, that's fine
	}
};

const saveModuleConfig = async (includeAll: boolean = false): Promise<boolean> => {
	isSavingModuleConfig.value = true;

	try {
		const configData: Record<string, unknown> = {
			type: 'buddy-module',
			enabled: true,
		};

		if (selectedLlmProvider.value) {
			configData.provider = selectedLlmProvider.value;
		}

		if (includeAll) {
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

const handleSkip = (): void => {
	if (currentStepName.value === 'voice') {
		selectedTtsProvider.value = undefined;
		selectedSttProvider.value = undefined;
	} else if (currentStepName.value === 'messaging') {
		selectedMessagingProvider.value = undefined;
	}

	nextStep();
};

const handleNext = (): void => {
	nextStep();
};

const handleFinish = async (): Promise<void> => {
	const saved = await saveModuleConfig(true);

	if (!saved) return;

	emit('update:visible', false);
	emit('completed');
};

const loadAllData = async (): Promise<void> => {
	isLoading.value = true;

	try {
		await Promise.all([
			extensionsStore.fetch(),
			fetchLlmProviders(),
			fetchTtsProviders(),
			fetchSttProviders(),
			fetchMessagingProviders(),
		]);

		// Pre-select currently selected providers, falling back to first enabled
		const selected = llmProviders.value.find((p: IProviderStatus) => p.selected)
			?? llmProviders.value.find((p: IProviderStatus) => p.enabled);
		const selectedTts = ttsProviders.value.find((p: IVoiceProviderStatus) => p.selected)
			?? ttsProviders.value.find((p: IVoiceProviderStatus) => p.enabled);
		const selectedStt = sttProviders.value.find((p: IVoiceProviderStatus) => p.selected)
			?? sttProviders.value.find((p: IVoiceProviderStatus) => p.enabled);

		if (selected && selected.type !== LLM_PROVIDER_NONE) {
			selectedLlmProvider.value = selected.type;
		}

		if (selectedTts) {
			selectedTtsProvider.value = selectedTts.type;
		}

		if (selectedStt) {
			selectedSttProvider.value = selectedStt.type;
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
			currentStep.value = 0;
			selectedLlmProvider.value = undefined;
			selectedTtsProvider.value = undefined;
			selectedSttProvider.value = undefined;
			selectedMessagingProvider.value = undefined;
			isSavingModuleConfig.value = false;
			configDialogVisible.value = false;
			togglingPlugins.clear();

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
