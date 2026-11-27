<template>
	<!-- Template 9 without the shell: the first run has no account yet, so no sidebar or top bar. The brand mark and the
	     title head the page, then the stepper card, the centred step card and the sticky footer -->
	<div
		class="fixed inset-0 overflow-y-auto bg-[var(--el-bg-color-page)]"
		data-test-id="onboarding"
	>
		<div class="flex flex-col gap-4 w-full max-w-[960px] min-h-full mx-auto box-border px-3 pt-3 tp:px-4 tp:pt-4 dt:px-6 dt:pt-6">
			<header class="flex items-center gap-3">
				<logo
					class="w-10 shrink-0 fill-brand"
					aria-hidden="true"
				/>
				<div class="flex flex-col min-w-0">
					<h1 class="m-0 text-title">{{ t('onboardingModule.wizard.title') }}</h1>
					<p class="m-0 text-help">{{ t('onboardingModule.wizard.subtitle') }}</p>
				</div>
			</header>

			<wizard-shell
				:steps="steps"
				:current="currentStepId"
				:can-continue="canContinue"
				:skippable="skippable"
				:backable="currentStep > OnboardingStep.LOCATION"
				:cancellable="false"
				:navigable="false"
				:busy="isLoading"
				:next-label="nextLabel"
				class="flex-1"
				@back="prevStep"
				@next="onNext"
				@skip="nextStep"
			>
				<step-welcome v-if="currentStep === OnboardingStep.WELCOME" />

				<step-account
					v-else-if="currentStep === OnboardingStep.ACCOUNT"
					ref="stepAccountEl"
					@submit="handleAccountNext"
				/>

				<step-location v-else-if="currentStep === OnboardingStep.LOCATION" />

				<step-integrations v-else-if="currentStep === OnboardingStep.INTEGRATIONS" />

				<step-spaces v-else-if="currentStep === OnboardingStep.SPACES" />

				<step-complete
					v-else-if="currentStep === OnboardingStep.COMPLETE"
					:location-configured="hasLocationData"
				/>
			</wizard-shell>
		</div>
	</div>
</template>

<script setup lang="ts">
import { type ComponentPublicInstance, computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { RouteNames as AppRouteNames } from '../../../app.constants';
import Logo from '../../../assets/images/fb_bird.svg?component';
import { WizardShell, type WizardShellStep, useFlashMessage } from '../../../common';
import { StepAccount, StepComplete, StepIntegrations, StepLocation, StepSpaces, StepWelcome } from '../components/components';
import { useAppOnboarding } from '../composables/composables';
import { OnboardingStep } from '../onboarding.constants';

defineOptions({
	name: 'ViewOnboarding',
});

const { t } = useI18n();
const router = useRouter();
const flashMessage = useFlashMessage();

const stepAccountEl = ref<ComponentPublicInstance<{ validate: () => Promise<boolean> }> | null>(null);

const {
	currentStep,
	isLoading,
	accountCreated,
	hasLocationData,
	locationData,
	isLastStep,
	nextStep,
	prevStep,
	createAccount,
	completeOnboarding,
	reset,
} = useAppOnboarding();

// In the order of `OnboardingStep`, so a step's index is its value
const STEP_IDS: Record<OnboardingStep, string> = {
	[OnboardingStep.WELCOME]: 'welcome',
	[OnboardingStep.ACCOUNT]: 'account',
	[OnboardingStep.LOCATION]: 'location',
	[OnboardingStep.INTEGRATIONS]: 'integrations',
	[OnboardingStep.SPACES]: 'spaces',
	[OnboardingStep.COMPLETE]: 'complete',
};

const steps = computed<WizardShellStep[]>((): WizardShellStep[] =>
	Object.values(STEP_IDS).map((id) => ({ id, label: t(`onboardingModule.wizard.steps.${id}`) }))
);

const currentStepId = computed<string>((): string => STEP_IDS[currentStep.value]);

// Location, integrations and spaces can be set up later, in the admin
const skippable = computed<boolean>(
	(): boolean =>
		currentStep.value === OnboardingStep.LOCATION || currentStep.value === OnboardingStep.INTEGRATIONS || currentStep.value === OnboardingStep.SPACES
);

// A location is a city or both coordinates; Skip is there for none
const canContinue = computed<boolean>((): boolean => {
	if (currentStep.value === OnboardingStep.LOCATION) {
		return Boolean(locationData.city) || (locationData.latitude !== null && locationData.longitude !== null);
	}

	return true;
});

const nextLabel = computed<string | undefined>((): string | undefined => {
	if (currentStep.value === OnboardingStep.WELCOME) {
		return t('onboardingModule.wizard.buttons.getStarted');
	}

	if (isLastStep.value) {
		return t('onboardingModule.wizard.buttons.finishSetup');
	}

	return t('onboardingModule.wizard.buttons.next');
});

const handleAccountNext = async (): Promise<void> => {
	if (accountCreated.value) {
		nextStep();
		return;
	}

	if (!stepAccountEl.value) return;

	const valid = await stepAccountEl.value.validate();
	if (!valid) return;

	const success = await createAccount();

	if (success) {
		flashMessage.success(t('onboardingModule.account.messages.created'));
		nextStep();
	}
};

const handleFinish = async (): Promise<void> => {
	const success = await completeOnboarding();

	if (success) {
		flashMessage.success(t('onboardingModule.complete.messages.finished'));
		await router.push({ name: AppRouteNames.ROOT });
		reset();
	}
};

const onNext = (): void => {
	if (currentStep.value === OnboardingStep.ACCOUNT) {
		void handleAccountNext();
	} else if (isLastStep.value) {
		void handleFinish();
	} else {
		nextStep();
	}
};
</script>
