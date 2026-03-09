export const ONBOARDING_MODULE_NAME = 'onboarding-module';

export const ONBOARDING_MODULE_PREFIX = 'onboarding';

export const RouteNames = {
	ONBOARDING: 'onboarding_module-onboarding',
};

export enum OnboardingStep {
	WELCOME = 0,
	ACCOUNT = 1,
	LOCATION = 2,
	COMPLETE = 3,
}

export const ONBOARDING_STEPS = [
	OnboardingStep.WELCOME,
	OnboardingStep.ACCOUNT,
	OnboardingStep.LOCATION,
	OnboardingStep.COMPLETE,
] as const;
