<template>
	<div class="min-h-screen flex items-center justify-center bg-gray-100 p-4">
		<el-card
			shadow="always"
			class="w-full max-w-2xl"
			body-class="p-0!"
		>
			<template #header>
				<div class="flex flex-col items-center gap-4">
					<h1 class="text-lg font-semibold m-0">
						{{ t('onboardingModule.wizard.title') }}
					</h1>

					<el-steps
						:active="currentStep"
						finish-status="success"
						align-center
						class="w-full"
					>
						<el-step :title="t('onboardingModule.wizard.steps.welcome')" />
						<el-step :title="t('onboardingModule.wizard.steps.account')" />
						<el-step :title="t('onboardingModule.wizard.steps.location')" />
						<el-step :title="t('onboardingModule.wizard.steps.complete')" />
					</el-steps>
				</div>
			</template>

			<div v-loading="isLoading">
				<step-welcome v-if="currentStep === OnboardingStep.WELCOME" />

				<step-account
					v-if="currentStep === OnboardingStep.ACCOUNT"
					@create-account="handleCreateAccount"
				/>

				<step-location v-if="currentStep === OnboardingStep.LOCATION" />

				<step-complete
					v-if="currentStep === OnboardingStep.COMPLETE"
					:location-configured="hasLocationData"
				/>
			</div>

			<div class="flex justify-between p-4 border-t border-gray-200">
				<el-button
					v-if="!isFirstStep && currentStep !== OnboardingStep.ACCOUNT"
					@click="prevStep"
				>
					{{ t('onboardingModule.wizard.buttons.back') }}
				</el-button>
				<div v-else />

				<div class="flex gap-2">
					<el-button
						v-if="currentStep === OnboardingStep.LOCATION"
						@click="handleSkipLocation"
					>
						{{ t('onboardingModule.wizard.buttons.skip') }}
					</el-button>

					<el-button
						v-if="currentStep === OnboardingStep.WELCOME"
						type="primary"
						@click="nextStep"
					>
						{{ t('onboardingModule.wizard.buttons.getStarted') }}
					</el-button>

					<el-button
						v-else-if="currentStep === OnboardingStep.ACCOUNT && !accountCreated"
						type="primary"
						disabled
					>
						{{ t('onboardingModule.wizard.buttons.next') }}
					</el-button>

					<el-button
						v-else-if="currentStep === OnboardingStep.ACCOUNT && accountCreated"
						type="primary"
						@click="nextStep"
					>
						{{ t('onboardingModule.wizard.buttons.next') }}
					</el-button>

					<el-button
						v-else-if="currentStep === OnboardingStep.LOCATION"
						type="primary"
						:disabled="!locationData.city && (locationData.latitude === null || locationData.longitude === null)"
						@click="nextStep"
					>
						{{ t('onboardingModule.wizard.buttons.next') }}
					</el-button>

					<el-button
						v-else-if="isLastStep"
						type="primary"
						:loading="isLoading"
						@click="handleFinish"
					>
						{{ t('onboardingModule.wizard.buttons.finishSetup') }}
					</el-button>
				</div>
			</div>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { ElButton, ElCard, ElStep, ElSteps, vLoading } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { useFlashMessage } from '../../../common';
import { RouteNames as AppRouteNames } from '../../../app.constants';
import { StepAccount, StepComplete, StepLocation, StepWelcome } from '../components/components';
import { useAppOnboarding } from '../composables/composables';
import { OnboardingStep } from '../onboarding.constants';

defineOptions({
	name: 'ViewOnboarding',
});

const { t } = useI18n();
const router = useRouter();
const flashMessage = useFlashMessage();

const {
	currentStep,
	isLoading,
	accountCreated,
	hasLocationData,
	locationData,
	isFirstStep,
	isLastStep,
	nextStep,
	prevStep,
	createAccount,
	completeOnboarding,
	reset,
} = useAppOnboarding();

const handleCreateAccount = async (): Promise<void> => {
	const success = await createAccount();

	if (success) {
		flashMessage.success(t('onboardingModule.account.messages.created'));
	}
};

const handleSkipLocation = (): void => {
	locationData.city = '';
	locationData.latitude = null;
	locationData.longitude = null;
	locationData.timezone = '';
	nextStep();
};

const handleFinish = async (): Promise<void> => {
	const success = await completeOnboarding();

	if (success) {
		reset();
		flashMessage.success(t('onboardingModule.complete.messages.finished'));
		router.push({ name: AppRouteNames.ROOT });
	}
};
</script>
