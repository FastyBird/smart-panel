<template>
	<!-- Template 9: stepper card, centred step card and the sticky footer. Every step but the summary can be skipped;
	     each provider opens its plugin's own config form -->
	<wizard-shell
		:steps="shellSteps"
		:current="currentStepName"
		:can-continue="!isLoading && !providerStepBlocked && !isNextDisabled"
		:skippable="canSkip && !isLoading && !providerStepBlocked"
		:busy="isSavingModuleConfig || togglingPlugins.size > 0"
		:next-label="currentStepName === 'done' ? t('buddyModule.wizard.buttons.startChatting') : undefined"
		:cancellable="currentStepName !== 'done'"
		class="flex-1"
		@back="prevStep"
		@next="onNext"
		@skip="handleSkip"
		@cancel="emit('cancel')"
		@step="goToStep"
	>
		<div
			class="flex flex-col gap-4 p-4 tp:p-5"
			data-test-id="buddy-setup-step"
		>
			<state-view
				v-if="isLoading"
				kind="loading"
				icon="mdi:robot-outline"
				:title="t('buddyModule.wizard.loading')"
			/>

			<!-- Step 1: AI provider -->
			<template v-else-if="currentStepName === 'provider'">
				<p class="text-help m-0">{{ t('buddyModule.wizard.providerDescription') }}</p>

				<!-- A failed read is not an empty list: skipping or finishing then would save "no provider" over the one set -->
				<state-view
					v-if="llmProvidersFailed"
					kind="error"
					icon="mdi:robot-confused-outline"
					:title="t('buddyModule.wizard.providersFailed')"
					data-test-id="buddy-setup-providers-failed"
				>
					<template #action>
						<el-button
							plain
							data-test-id="buddy-setup-providers-retry"
							@click="loadAllData"
						>
							{{ t('buddyModule.buttons.retry.title') }}
						</el-button>
					</template>
				</state-view>

				<state-view
					v-else-if="llmProviders.length === 0"
					kind="empty"
					icon="mdi:robot-outline"
					:title="t('buddyModule.wizard.noProvidersAvailable')"
				/>

				<div
					v-else
					role="radiogroup"
					:aria-label="t('buddyModule.wizard.steps.provider')"
					class="flex flex-col gap-3"
				>
					<buddy-provider-option
						v-for="provider in llmProviders"
						:key="provider.type"
						:provider="provider"
						:model="provider.default_model || undefined"
						:icon="getPluginIcon(provider.type)"
						:selected="selectedLlmProvider === provider.type"
						:can-toggle="canTogglePlugin(provider.type)"
						:toggling="isTogglingPlugin(provider.type)"
						:has-config-form="hasPluginConfigForm(provider.type)"
						group="buddy-llm-provider"
						@select="selectedLlmProvider = provider.type"
						@toggle="(enabled: boolean) => toggleLlmPlugin(provider.type, enabled)"
						@configure="openConfigDialog(provider.type, provider.name)"
					/>
				</div>
			</template>

			<!-- Step 2: Voice (TTS / STT) -->
			<template v-else-if="currentStepName === 'voice'">
				<p class="text-help m-0">{{ t('buddyModule.wizard.voiceDescription') }}</p>

				<section
					v-if="ttsProviders.length > 0"
					class="flex flex-col gap-3"
				>
					<h3 class="text-card-title m-0">{{ t('buddyModule.wizard.ttsHeading') }}</h3>
					<div
						role="radiogroup"
						:aria-label="t('buddyModule.wizard.ttsHeading')"
						class="flex flex-col gap-3"
					>
						<buddy-provider-option
							v-for="provider in ttsProviders"
							:key="provider.type"
							:provider="provider"
							:icon="getPluginIcon(provider.type)"
							:selected="selectedTtsProvider === provider.type"
							:can-toggle="canTogglePlugin(provider.type)"
							:toggling="isTogglingPlugin(provider.type)"
							:has-config-form="hasPluginConfigForm(provider.type)"
							group="buddy-tts-provider"
							@select="selectedTtsProvider = provider.type"
							@toggle="(enabled: boolean) => toggleTtsPlugin(provider.type, enabled)"
							@configure="openConfigDialog(provider.type, provider.name)"
						/>
					</div>
				</section>

				<section
					v-if="sttProviders.length > 0"
					class="flex flex-col gap-3"
				>
					<h3 class="text-card-title m-0">{{ t('buddyModule.wizard.sttHeading') }}</h3>
					<div
						role="radiogroup"
						:aria-label="t('buddyModule.wizard.sttHeading')"
						class="flex flex-col gap-3"
					>
						<buddy-provider-option
							v-for="provider in sttProviders"
							:key="provider.type"
							:provider="provider"
							:icon="getPluginIcon(provider.type)"
							:selected="selectedSttProvider === provider.type"
							:can-toggle="canTogglePlugin(provider.type)"
							:toggling="isTogglingPlugin(provider.type)"
							:has-config-form="hasPluginConfigForm(provider.type)"
							group="buddy-stt-provider"
							@select="selectedSttProvider = provider.type"
							@toggle="(enabled: boolean) => toggleSttPlugin(provider.type, enabled)"
							@configure="openConfigDialog(provider.type, provider.name)"
						/>
					</div>
				</section>
			</template>

			<!-- Step 3: Messaging -->
			<template v-else-if="currentStepName === 'messaging'">
				<p class="text-help m-0">{{ t('buddyModule.wizard.messagingDescription') }}</p>

				<div
					role="radiogroup"
					:aria-label="t('buddyModule.wizard.steps.messaging')"
					class="flex flex-col gap-3"
				>
					<buddy-provider-option
						v-for="provider in messagingProviders"
						:key="provider.type"
						:provider="provider"
						:icon="getPluginIcon(provider.type)"
						:selected="selectedMessagingProvider === provider.type"
						:can-toggle="canTogglePlugin(provider.type)"
						:toggling="isTogglingPlugin(provider.type)"
						:has-config-form="hasPluginConfigForm(provider.type)"
						group="buddy-messaging-provider"
						@select="selectedMessagingProvider = provider.type"
						@toggle="(enabled: boolean) => toggleMessagingPlugin(provider.type, enabled)"
						@configure="openConfigDialog(provider.type, provider.name)"
					/>
				</div>
			</template>

			<!-- Step 4: Summary -->
			<template v-else>
				<div class="flex flex-col items-center gap-2 text-center pt-2">
					<el-icon
						:size="56"
						aria-hidden="true"
					>
						<icon
							icon="mdi:check-circle-outline"
							class="text-success"
						/>
					</el-icon>
					<h2 class="text-section m-0">{{ t('buddyModule.wizard.doneTitle') }}</h2>
					<p class="text-help m-0 max-w-[480px]">{{ t('buddyModule.wizard.doneDescription') }}</p>
				</div>

				<ul
					class="flex flex-col gap-2 m-0 p-0 list-none w-full max-w-[480px] mx-auto"
					data-test-id="buddy-setup-summary"
				>
					<li
						v-for="item in summary"
						:key="item.id"
						:class="['flex items-center gap-3 px-3 py-2 rounded-lg', item.done ? 'bg-success-soft' : 'bg-fill-light']"
						:data-summary="item.id"
					>
						<el-icon
							:size="20"
							class="shrink-0"
							aria-hidden="true"
						>
							<icon
								:icon="item.done ? 'mdi:check' : 'mdi:minus'"
								:class="item.done ? 'text-success' : 'text-muted'"
							/>
						</el-icon>
						<span :class="item.done ? 'text-body' : 'text-secondary'">{{ item.label }}</span>
					</li>
				</ul>
			</template>
		</div>
	</wizard-shell>

	<integration-config-dialog
		v-model:visible="configDialogVisible"
		:plugin-type="configDialogPluginType"
		:plugin-name="configDialogPluginName"
		@saved="onConfigSaved"
	/>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElIcon } from 'element-plus';

import { Icon } from '@iconify/vue';

import { StateView, WizardShell, injectStoresManager, useFlashMessage } from '../../../common';
import type { WizardShellStep } from '../../../common/components/wizard-shell.types';
import { usePlugins } from '../../config/composables/usePlugins';
import { CONFIG_MODULE_PLUGIN_TYPE } from '../../config/config.constants';
import type { IPluginsComponents, IPluginsSchemas } from '../../config/config.types';
import { configModulesStoreKey, configPluginsStoreKey } from '../../config/store/keys';
import { extensionsStoreKey } from '../../extensions/store/keys';
import IntegrationConfigDialog from '../../onboarding/components/integration-config-dialog.vue';
import { LLM_PROVIDER_NONE, STT_PLUGIN_NONE, TTS_PLUGIN_NONE } from '../buddy.constants';
import { useBuddyMessagingProviders } from '../composables/useBuddyMessagingProviders';
import type { IProviderStatus } from '../composables/useBuddyProviders';
import { useBuddyProviders } from '../composables/useBuddyProviders';
import { useBuddySttProviders } from '../composables/useBuddySttProviders';
import { useBuddyTtsProviders } from '../composables/useBuddyTtsProviders';
import type { IVoiceProviderStatus } from '../composables/useBuddyVoiceProviders';

import BuddyProviderOption from './buddy-provider-option.vue';

defineOptions({
	name: 'BuddySetupWizard',
});

const emit = defineEmits<{
	(e: 'completed'): void;
	(e: 'cancel'): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();
const storesManager = injectStoresManager();
const configModulesStore = storesManager.getStore(configModulesStoreKey);
const configPluginsStore = storesManager.getStore(configPluginsStoreKey);
const extensionsStore = storesManager.getStore(extensionsStoreKey);
const { getByName } = usePlugins();

const { providerStatuses: llmProviders, providerFetchFailed: llmProvidersFailed, fetchProviderStatuses: fetchLlmProviders } = useBuddyProviders();
const { ttsProviderStatuses: ttsProviders, fetchTtsProviderStatuses: fetchTtsProviders } = useBuddyTtsProviders();
const { sttProviderStatuses: sttProviders, fetchSttProviderStatuses: fetchSttProviders } = useBuddySttProviders();
const { messagingProviderStatuses: messagingProviders, fetchMessagingProviderStatuses: fetchMessagingProviders } = useBuddyMessagingProviders();

const isLoading = ref(false);

// The AI providers were read at least once. The provider step only lets you on after that, so the choice made there
// (or its skip) is a real one, and a later refresh that fails does not undo it
const llmProvidersRead = ref(false);
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

const shellSteps = computed<WizardShellStep[]>(() => stepSequence.value.map((step) => ({ id: step, label: t(`buddyModule.wizard.steps.${step}`) })));

const currentStepName = computed<StepName>(() => stepSequence.value[currentStep.value] ?? 'done');

// Clamp currentStep if stepSequence shrinks due to a provider refetch mid-wizard
watch(stepSequence, (seq) => {
	const maxStep = seq.length - 1;

	if (currentStep.value > maxStep) {
		currentStep.value = maxStep;
	}
});

// A failed provider read holds the provider step, where it shows with Retry. The other steps go on: a refresh after a
// voice or messaging config was saved can fail too, and Finish then leaves the provider as it was
const providerStepBlocked = computed<boolean>(() => llmProvidersFailed.value && currentStepName.value === 'provider');

// Every step before the summary can be skipped: Buddy still makes rule-based suggestions without an AI provider
const canSkip = computed(() => currentStepName.value !== 'done');

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
		(el: { type: string; components?: IPluginsComponents; schemas?: IPluginsSchemas }) => el.type === CONFIG_MODULE_PLUGIN_TYPE
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

interface ISummaryItem {
	id: string;
	label: string;
	done: boolean;
}

// One line per step: what was chosen, or that it was skipped. Voice and messaging only when Buddy has providers for them
const summary = computed<ISummaryItem[]>(() => {
	const items: ISummaryItem[] = [
		selectedLlmProvider.value
			? { id: 'provider', label: t('buddyModule.wizard.summaryLlm', { name: selectedLlmProviderName.value }), done: true }
			: { id: 'provider', label: t('buddyModule.wizard.summaryLlmSkipped'), done: false },
	];

	if (hasVoiceProviders.value) {
		items.push(
			voiceSummary.value
				? { id: 'voice', label: t('buddyModule.wizard.summaryVoice', { summary: voiceSummary.value }), done: true }
				: { id: 'voice', label: t('buddyModule.wizard.summaryVoiceSkipped'), done: false }
		);
	}

	if (hasMessagingProviders.value) {
		items.push(
			selectedMessagingProvider.value
				? { id: 'messaging', label: t('buddyModule.wizard.summaryMessaging', { name: selectedMessagingProviderName.value }), done: true }
				: { id: 'messaging', label: t('buddyModule.wizard.summaryMessagingSkipped'), done: false }
		);
	}

	return items;
});

// Plugin toggle handlers — auto-select on enable, clear on disable
const toggleLlmPlugin = async (type: string, enabled: boolean): Promise<void> => {
	// A provider picked while the switch was on its way stays picked
	const chosenBefore = selectedLlmProvider.value;

	togglingPlugins.add(type);

	try {
		await extensionsStore.update({ type, data: { enabled } });
		await fetchLlmProviders();

		if (enabled) {
			if (selectedLlmProvider.value === chosenBefore) {
				selectedLlmProvider.value = type;
			}

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
	// A provider picked while the switch was on its way stays picked
	const chosenBefore = selectedTtsProvider.value;

	togglingPlugins.add(type);

	try {
		await extensionsStore.update({ type, data: { enabled } });
		await fetchTtsProviders();

		if (enabled) {
			if (selectedTtsProvider.value === chosenBefore) {
				selectedTtsProvider.value = type;
			}

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
	// A provider picked while the switch was on its way stays picked
	const chosenBefore = selectedSttProvider.value;

	togglingPlugins.add(type);

	try {
		await extensionsStore.update({ type, data: { enabled } });
		await fetchSttProviders();

		if (enabled) {
			if (selectedSttProvider.value === chosenBefore) {
				selectedSttProvider.value = type;
			}

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
	// A provider picked while the switch was on its way stays picked
	const chosenBefore = selectedMessagingProvider.value;

	togglingPlugins.add(type);

	try {
		await extensionsStore.update({ type, data: { enabled } });
		await fetchMessagingProviders();

		if (enabled) {
			if (selectedMessagingProvider.value === chosenBefore) {
				selectedMessagingProvider.value = type;
			}

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

		// A skipped provider step is saved as no provider, not left as the provider set before. Only when the providers
		// were read: without a read nothing was really chosen, and the provider set before stays
		if (llmProvidersRead.value) {
			configData.provider = selectedLlmProvider.value ?? LLM_PROVIDER_NONE;
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

const goToStep = (id: string): void => {
	const index = stepSequence.value.indexOf(id as StepName);

	if (index >= 0 && index < currentStep.value) {
		currentStep.value = index;
	}
};

const handleSkip = (): void => {
	if (currentStepName.value === 'provider') {
		selectedLlmProvider.value = undefined;
	} else if (currentStepName.value === 'voice') {
		selectedTtsProvider.value = undefined;
		selectedSttProvider.value = undefined;
	} else if (currentStepName.value === 'messaging') {
		selectedMessagingProvider.value = undefined;
	}

	nextStep();
};

const handleFinish = async (): Promise<void> => {
	const saved = await saveModuleConfig(true);

	if (!saved) return;

	emit('completed');
};

const onNext = (): void => {
	if (currentStepName.value === 'done') {
		void handleFinish();
	} else {
		nextStep();
	}
};

const loadAllData = async (): Promise<void> => {
	isLoading.value = true;

	try {
		// The extensions only say which plugins can be switched off; without them the switches stay available
		await Promise.all([
			extensionsStore.fetch().catch(() => undefined),
			fetchLlmProviders(),
			fetchTtsProviders(),
			fetchSttProviders(),
			fetchMessagingProviders(),
		]);

		// Pre-select only the providers Buddy is set to use. A saved "none" looks the same as nothing saved yet (no status
		// is selected), so falling back to the first enabled provider would turn a skipped step back into a choice
		const selected = llmProviders.value.find((p: IProviderStatus) => p.selected);
		const selectedTts = ttsProviders.value.find((p: IVoiceProviderStatus) => p.selected);
		const selectedStt = sttProviders.value.find((p: IVoiceProviderStatus) => p.selected);

		// Only on the first successful read: a Retry later keeps the provider already picked
		if (!llmProvidersRead.value && selected && selected.type !== LLM_PROVIDER_NONE) {
			selectedLlmProvider.value = selected.type;
		}

		if (!llmProvidersFailed.value) {
			llmProvidersRead.value = true;
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

onBeforeMount(() => {
	void loadAllData();
});
</script>
