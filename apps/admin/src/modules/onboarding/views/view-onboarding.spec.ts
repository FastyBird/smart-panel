import { reactive, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { WizardShell } from '../../../common';
import { OnboardingStep } from '../onboarding.constants';

import ViewOnboarding from './view-onboarding.vue';

enableAutoUnmount(afterEach);

const { nextStep, prevStep, createAccount, completeOnboarding, reset, push, success } = vi.hoisted(() => ({
	nextStep: vi.fn(),
	prevStep: vi.fn(),
	createAccount: vi.fn(),
	completeOnboarding: vi.fn(),
	reset: vi.fn(),
	push: vi.fn(),
	success: vi.fn(),
}));

// Read by the composable mock only when the view mounts
const step = ref<number>(0);
const loading = ref<boolean>(false);
const created = ref<boolean>(false);
const location = reactive<{ city: string; latitude: number | null; longitude: number | null }>({ city: '', latitude: null, longitude: null });

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-router', async (importOriginal) => ({
	...(await importOriginal<typeof import('vue-router')>()),
	useRouter: () => ({ push }),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return { ...actual, useFlashMessage: () => ({ success }) };
});

vi.mock('../composables/composables', async () => {
	const { computed } = await import('vue');

	return {
		useAppOnboarding: () => ({
			currentStep: step,
			isLoading: loading,
			accountCreated: created,
			hasLocationData: computed(() => false),
			locationData: location,
			isLastStep: computed(() => step.value === OnboardingStep.COMPLETE),
			nextStep,
			prevStep,
			createAccount,
			completeOnboarding,
			reset,
		}),
	};
});

vi.mock('../components/components', () => {
	const stub = (name: string) => ({ name, template: `<div data-test-id="${name}" />`, methods: { validate: () => Promise.resolve(true) } });

	return {
		StepWelcome: stub('StepWelcome'),
		StepAccount: stub('StepAccount'),
		StepLocation: stub('StepLocation'),
		StepIntegrations: stub('StepIntegrations'),
		StepSpaces: stub('StepSpaces'),
		StepComplete: stub('StepComplete'),
	};
});

const render = () => mount(ViewOnboarding, { global: { stubs: { Icon: true } } });

describe('ViewOnboarding', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		step.value = OnboardingStep.WELCOME;
		loading.value = false;
		created.value = false;
		location.city = '';
		location.latitude = null;
		location.longitude = null;
	});

	it('runs on the wizard shell with the six steps, without Cancel or going back to completed steps', () => {
		const shell = render().findComponent(WizardShell);

		expect(shell.props('steps').map((s: { id: string }) => s.id)).toEqual(['welcome', 'account', 'location', 'integrations', 'spaces', 'complete']);
		expect(shell.props()).toMatchObject({
			current: 'welcome',
			cancellable: false,
			navigable: false,
			nextLabel: 'onboardingModule.wizard.buttons.getStarted',
		});
	});

	it('does not go back to the account once it is made', () => {
		step.value = OnboardingStep.LOCATION;

		expect(render().findComponent(WizardShell).props('backable')).toBe(false);

		step.value = OnboardingStep.INTEGRATIONS;

		expect(render().findComponent(WizardShell).props('backable')).toBe(true);
	});

	it('lets the location be skipped, and continues only with a city or both coordinates', async () => {
		step.value = OnboardingStep.LOCATION;
		const wrapper = render();
		const shell = wrapper.findComponent(WizardShell);

		expect(shell.props()).toMatchObject({ skippable: true, canContinue: false });

		location.city = 'Prague';
		await flushPromises();

		expect(shell.props('canContinue')).toBe(true);

		shell.vm.$emit('skip');

		expect(nextStep).toHaveBeenCalledTimes(1);
	});

	it('makes the account before moving on', async () => {
		step.value = OnboardingStep.ACCOUNT;
		createAccount.mockResolvedValue(true);
		const shell = render().findComponent(WizardShell);

		expect(shell.props('skippable')).toBe(false);

		shell.vm.$emit('next');
		await flushPromises();

		expect(createAccount).toHaveBeenCalledTimes(1);
		expect(nextStep).toHaveBeenCalledTimes(1);
	});

	it('finishes the setup on the last step', async () => {
		step.value = OnboardingStep.COMPLETE;
		completeOnboarding.mockResolvedValue(true);
		const shell = render().findComponent(WizardShell);

		expect(shell.props('nextLabel')).toBe('onboardingModule.wizard.buttons.finishSetup');

		shell.vm.$emit('next');
		await flushPromises();

		expect(completeOnboarding).toHaveBeenCalledTimes(1);
		expect(push).toHaveBeenCalledTimes(1);
		expect(reset).toHaveBeenCalledTimes(1);
	});
});
