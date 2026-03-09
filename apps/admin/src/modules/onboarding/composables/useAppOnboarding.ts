import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { injectStoresManager, useBackend, useFlashMessage } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { sessionStoreKey } from '../../auth/store/keys';
import { spacesStoreKey } from '../../spaces/store/keys';
import { SpaceType } from '../../spaces/spaces.constants';
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

export interface ISpaceToCreate {
	name: string;
	category: string | null;
	icon: string | null;
}

const currentStep = ref<OnboardingStep>(OnboardingStep.WELCOME);
const isLoading = ref(false);
const accountRegistered = ref(false);
const accountCreated = ref(false);
const locationConfigured = ref(false);
const spacesCreated = ref(false);

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

const spacesToCreate = reactive<ISpaceToCreate[]>([]);

export const useAppOnboarding = () => {
	const { t } = useI18n();
	const backend = useBackend();
	const flashMessage = useFlashMessage();
	const storesManager = injectStoresManager();
	const sessionStore = storesManager.getStore(sessionStoreKey);
	const spacesStore = storesManager.getStore(spacesStoreKey);
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
			// Register the account (skip if already registered from a previous partial attempt)
			if (!accountRegistered.value) {
				await sessionStore.register({
					data: {
						username: accountData.username,
						password: accountData.password,
						firstName: accountData.firstName,
						lastName: accountData.lastName,
						email: accountData.email,
					},
				});

				accountRegistered.value = true;
			}

			// Auto-login after registration
			await sessionStore.create({
				data: {
					username: accountData.username,
					password: accountData.password,
				},
			});

			accountCreated.value = true;

			// Clear password from memory — no longer needed after auto-login
			accountData.password = '';

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

	const saveSpaces = async (): Promise<boolean> => {
		if (spacesCreated.value) return true;

		if (spacesToCreate.length === 0) {
			return true;
		}

		try {
			for (const space of spacesToCreate) {
				await spacesStore.add({
					data: {
						name: space.name,
						type: SpaceType.ROOM,
						category: space.category as never,
						icon: space.icon,
					},
				});
			}

			spacesCreated.value = true;

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

			// Save spaces if any were added
			if (spacesToCreate.length > 0) {
				const spacesSaved = await saveSpaces();

				if (!spacesSaved) {
					flashMessage.error(t('onboardingModule.spaces.messages.error'));
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
		accountRegistered.value = false;
		accountCreated.value = false;
		locationConfigured.value = false;
		spacesCreated.value = false;
		accountData.username = '';
		accountData.password = '';
		accountData.email = '';
		accountData.firstName = '';
		accountData.lastName = '';
		locationData.city = '';
		locationData.latitude = null;
		locationData.longitude = null;
		locationData.timezone = '';
		spacesToCreate.splice(0);
	};

	return {
		currentStep,
		isLoading,
		accountCreated,
		locationConfigured,
		hasLocationData,
		spacesCreated,
		accountData,
		locationData,
		spacesToCreate,
		isFirstStep,
		isLastStep,
		nextStep,
		prevStep,
		createAccount,
		saveLocation,
		saveSpaces,
		completeOnboarding,
		reset,
	};
};
