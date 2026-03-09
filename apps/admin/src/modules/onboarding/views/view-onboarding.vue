<template>
	<div class="fixed inset-0 flex items-center justify-center bg-gray-100 p-4">
		<el-card
			shadow="always"
			class="w-full max-w-2xl max-h-full flex flex-col overflow-hidden"
			body-class="p-0! flex-1 overflow-auto"
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
						<el-step :title="t('onboardingModule.wizard.steps.integrations')" />
						<el-step :title="t('onboardingModule.wizard.steps.spaces')" />
						<el-step :title="t('onboardingModule.wizard.steps.complete')" />
					</el-steps>
				</div>
			</template>

			<div v-loading="isLoading">
				<step-welcome v-if="currentStep === OnboardingStep.WELCOME" />

				<step-account
					v-if="currentStep === OnboardingStep.ACCOUNT"
					ref="stepAccountEl"
					@submit="handleAccountNext"
				/>

				<step-location v-if="currentStep === OnboardingStep.LOCATION" />

				<step-integrations v-if="currentStep === OnboardingStep.INTEGRATIONS" />

				<step-spaces v-if="currentStep === OnboardingStep.SPACES" />

				<step-complete
					v-if="currentStep === OnboardingStep.COMPLETE"
					:location-configured="hasLocationData"
				/>
			</div>

			<template #footer>
				<div class="flex justify-between">
					<el-button
						v-if="currentStep > OnboardingStep.LOCATION"
						@click="prevStep"
					>
						{{ t('onboardingModule.wizard.buttons.back') }}
					</el-button>
					<div v-else />

					<div class="flex gap-2">
						<el-button
							v-if="currentStep === OnboardingStep.LOCATION || currentStep === OnboardingStep.SPACES || currentStep === OnboardingStep.INTEGRATIONS"
							@click="nextStep"
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
							v-else-if="currentStep === OnboardingStep.ACCOUNT"
							type="primary"
							:loading="isLoading"
							@click="handleAccountNext"
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
							v-else-if="currentStep === OnboardingStep.INTEGRATIONS"
							type="primary"
							@click="nextStep"
						>
							{{ t('onboardingModule.wizard.buttons.next') }}
						</el-button>

						<el-button
							v-else-if="currentStep === OnboardingStep.SPACES"
							type="primary"
							:disabled="spacesToCreate.length === 0"
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
			</template>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { type ComponentPublicInstance, ref } from 'vue';

import { ElButton, ElCard, ElStep, ElSteps, vLoading } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { useFlashMessage } from '../../../common';
import { RouteNames as AppRouteNames } from '../../../app.constants';
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
	spacesToCreate,
	isLastStep,
	nextStep,
	prevStep,
	createAccount,
	completeOnboarding,
	reset,
} = useAppOnboarding();

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
</script>
