import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { injectStoresManager, useBackend, useFlashMessage } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { sessionStoreKey } from '../../auth/store/keys';
import { OnboardingStep } from '../onboarding.constants';
import { useOnboardingStatus } from './useOnboardingStatus';

export interface IAccountData {
	username: string;
	password: string;
	email: string;
	firstName: string;
	lastName: string;
}

export interface ILocationData {
	city: string;
	latitude: number | null;
	longitude: number | null;
	timezone: string;
}

const currentStep = ref<OnboardingStep>(OnboardingStep.WELCOME);
const isLoading = ref(false);
const accountCreated = ref(false);
const locationConfigured = ref(false);

const accountData = reactive<IAccountData>({
	username: '',
	password: '',
	email: '',
	firstName: '',
	lastName: '',
});

const locationData = reactive<ILocationData>({
	city: '',
	latitude: null,
	longitude: null,
	timezone: '',
});

export const useAppOnboarding = () => {
	const { t } = useI18n();
	const backend = useBackend();
	const flashMessage = useFlashMessage();
	const storesManager = injectStoresManager();
	const sessionStore = storesManager.getStore(sessionStoreKey);
	const { invalidate, markComplete } = useOnboardingStatus();

	const isFirstStep = computed(() => currentStep.value === OnboardingStep.WELCOME);
	const isLastStep = computed(() => currentStep.value === OnboardingStep.COMPLETE);

	const nextStep = (): void => {
		if (currentStep.value < OnboardingStep.COMPLETE) {
			currentStep.value = currentStep.value + 1;
		}
	};

	const prevStep = (): void => {
		if (currentStep.value > OnboardingStep.WELCOME) {
			currentStep.value = currentStep.value - 1;
		}
	};

	const createAccount = async (): Promise<boolean> => {
		if (accountCreated.value) return true;

		isLoading.value = true;

		try {
			// Register the account
			await sessionStore.register({
				data: {
					username: accountData.username,
					password: accountData.password,
					firstName: accountData.firstName,
					lastName: accountData.lastName,
					email: accountData.email,
				},
			});

			// Auto-login after registration
			await sessionStore.create({
				data: {
					username: accountData.username,
					password: accountData.password,
				},
			});

			accountCreated.value = true;

			// Invalidate onboarding status cache since owner now exists
			invalidate();

			return true;
		} catch {
			flashMessage.error(t('onboardingModule.account.messages.error'));
			return false;
		} finally {
			isLoading.value = false;
		}
	};

	const hasLocationData = computed(() => !!(locationData.city || (locationData.latitude !== null && locationData.longitude !== null)));

	const saveLocation = async (): Promise<boolean> => {
		if (locationConfigured.value) return true;

		if (!locationData.city && locationData.latitude === null) {
			return true;
		}

		try {
			const locationBody: Record<string, unknown> = {
				type: 'weather-openweathermap',
				name: locationData.city || 'Home',
			};

			if (locationData.latitude !== null && locationData.longitude !== null) {
				locationBody.location_type = 'lat_lon';
				locationBody.latitude = locationData.latitude;
				locationBody.longitude = locationData.longitude;
			} else if (locationData.city) {
				locationBody.location_type = 'city_name';
				locationBody.city_name = locationData.city;
			}

			const { error } = await backend.client.POST(`/${MODULES_PREFIX}/weather/locations` as never, {
				body: { data: locationBody },
			} as never);

			if (error) {
				return false;
			}

			locationConfigured.value = true;

			return true;
		} catch {
			return false;
		}
	};

	const completeOnboarding = async (): Promise<boolean> => {
		isLoading.value = true;

		try {
			// Save location if configured
			if (locationData.city || (locationData.latitude !== null && locationData.longitude !== null)) {
				const locationSaved = await saveLocation();

				if (!locationSaved) {
					flashMessage.error(t('onboardingModule.location.messages.error'));
					return false;
				}
			}

			// Mark onboarding as complete
			const success = await markComplete();

			if (!success) {
				flashMessage.error(t('onboardingModule.complete.messages.error'));
				return false;
			}

			return true;
		} catch {
			flashMessage.error(t('onboardingModule.complete.messages.error'));
			return false;
		} finally {
			isLoading.value = false;
		}
	};

	const reset = (): void => {
		currentStep.value = OnboardingStep.WELCOME;
		accountCreated.value = false;
		locationConfigured.value = false;
		accountData.username = '';
		accountData.password = '';
		accountData.email = '';
		accountData.firstName = '';
		accountData.lastName = '';
		locationData.city = '';
		locationData.latitude = null;
		locationData.longitude = null;
		locationData.timezone = '';
	};

	return {
		currentStep,
		isLoading,
		accountCreated,
		hasLocationData,
		accountData,
		locationData,
		isFirstStep,
		isLastStep,
		nextStep,
		prevStep,
		createAccount,
		saveLocation,
		completeOnboarding,
		reset,
	};
};
