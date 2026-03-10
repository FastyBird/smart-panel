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

export interface IDeviceInfo {
	id: string;
	name: string;
	type: string;
	category: string;
	description: string | null;
	roomId: string | null;
}

export interface IRoomDefinition {
	searchToken: string;
	category: string | null;
	icon: string;
	i18nKey: string | null;
}

/**
 * Single source of truth for room definitions used by both the heuristic
 * suggestion logic and the quick-add category buttons in the UI.
 *
 * - searchToken: English name used to match against device names
 * - category: quick-add category key (null = no quick-add button)
 * - icon: Iconify icon identifier
 * - i18nKey: translation key under onboardingModule.spaces.categories (null = use searchToken)
 */
export const ROOM_DEFINITIONS: IRoomDefinition[] = [
	{ searchToken: 'Living Room', category: 'living_room', icon: 'mdi:sofa', i18nKey: 'livingRoom' },
	{ searchToken: 'Bedroom', category: 'bedroom', icon: 'mdi:bed', i18nKey: 'bedroom' },
	{ searchToken: 'Kitchen', category: 'kitchen', icon: 'mdi:countertop', i18nKey: 'kitchen' },
	{ searchToken: 'Bathroom', category: 'bathroom', icon: 'mdi:shower', i18nKey: 'bathroom' },
	{ searchToken: 'Toilet', category: 'toilet', icon: 'mdi:toilet', i18nKey: 'toilet' },
	{ searchToken: 'Office', category: 'office', icon: 'mdi:desk', i18nKey: 'office' },
	{ searchToken: 'Garage', category: 'garage', icon: 'mdi:garage', i18nKey: 'garage' },
	{ searchToken: 'Garden', category: 'garden', icon: 'mdi:flower', i18nKey: 'garden' },
	{ searchToken: 'Hallway', category: 'hallway', icon: 'mdi:door-open', i18nKey: 'hallway' },
	{ searchToken: 'Entry Hall', category: 'entry_hall', icon: 'mdi:door-sliding', i18nKey: 'entryHall' },
	{ searchToken: 'Dining Room', category: 'dining_room', icon: 'mdi:silverware-fork-knife', i18nKey: 'diningRoom' },
	{ searchToken: 'Basement', category: 'basement', icon: 'mdi:stairs-down', i18nKey: 'basement' },
	{ searchToken: 'Attic', category: 'attic', icon: 'mdi:stairs-up', i18nKey: 'attic' },
	{ searchToken: 'Laundry', category: 'laundry', icon: 'mdi:washing-machine', i18nKey: 'laundry' },
	{ searchToken: 'Nursery', category: 'nursery', icon: 'mdi:baby-carriage', i18nKey: 'nursery' },
	{ searchToken: 'Guest Room', category: 'guest_room', icon: 'mdi:bed-outline', i18nKey: 'guestRoom' },
	{ searchToken: 'Patio', category: 'patio', icon: 'mdi:table-furniture', i18nKey: 'patio' },
];

const currentStep = ref<OnboardingStep>(OnboardingStep.WELCOME);
const isLoading = ref(false);
const accountRegistered = ref(false);
const accountCreated = ref(false);
const locationConfigured = ref(false);
const savedSpacesCount = ref(0);

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
const discoveredDevices = reactive<IDeviceInfo[]>([]);
const deviceAssignments = reactive<Record<string, string | null>>({});
const devicesFetched = ref(false);
const spacesSuggested = ref(false);
const createdSpaceNameToId: Record<string, string> = {};

export const useAppOnboarding = () => {
	const { t } = useI18n();
	const backend = useBackend();
	const flashMessage = useFlashMessage();
	const storesManager = injectStoresManager();
	const sessionStore = storesManager.getStore(sessionStoreKey);
	const spacesStore = storesManager.getStore(spacesStoreKey);
	const { invalidate, markComplete } = useOnboardingStatus();

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

	const fetchDevices = async (): Promise<boolean> => {
		if (devicesFetched.value) return true;

		try {
			const { data, error } = await backend.client.GET(`/${MODULES_PREFIX}/devices/devices` as never);

			if (error || !data) return false;

			const items = (data as { data: { id: string; name: string; type: string; category: string; description: string | null; room_id: string | null }[] }).data;

			discoveredDevices.splice(0, discoveredDevices.length);

			for (const d of items) {
				discoveredDevices.push({
					id: d.id,
					name: d.name,
					type: d.type,
					category: d.category ?? 'generic',
					description: d.description ?? null,
					roomId: d.room_id ?? null,
				});
				// Initialize assignment (null = unassigned)
				if (!(d.id in deviceAssignments)) {
					deviceAssignments[d.id] = null;
				}
			}

			devicesFetched.value = true;

			return true;
		} catch {
			return false;
		}
	};

	const resolveRoomLabel = (room: IRoomDefinition): string => {
		return room.i18nKey ? t(`onboardingModule.spaces.categories.${room.i18nKey}`) : room.searchToken;
	};

	const suggestRoom = (deviceName: string): IRoomDefinition | null => {
		const lower = deviceName.toLowerCase();
		return ROOM_DEFINITIONS.find((room) => lower.includes(room.searchToken.toLowerCase())) ?? null;
	};

	const suggestSpacesFromDevices = (): void => {
		if (spacesSuggested.value) return;

		spacesSuggested.value = true;

		const existingNames = new Set(spacesToCreate.map((s) => s.name.toLowerCase()));

		for (const device of discoveredDevices) {
			const suggested = suggestRoom(device.name);

			if (!suggested) continue;

			const label = resolveRoomLabel(suggested);

			// Add the suggested space if not already in the list
			if (!existingNames.has(label.toLowerCase())) {
				spacesToCreate.push({
					name: label,
					category: suggested.category,
					icon: suggested.icon,
				});
				existingNames.add(label.toLowerCase());
			}

			// Auto-assign device to the suggested space (only on first run, guarded by spacesSuggested flag)
			if (!deviceAssignments[device.id]) {
				deviceAssignments[device.id] = label;
			}
		}
	};

	const saveSpaces = async (): Promise<boolean> => {
		if (spacesToCreate.length === 0) {
			return true;
		}

		try {
			while (spacesToCreate.length > 0) {
				const space = spacesToCreate[0];

				const created = await spacesStore.add({
					data: {
						name: space.name,
						type: SpaceType.ROOM,
						category: space.category as never,
						icon: space.icon,
					},
				});

				// Track name→id mapping for device assignment
				createdSpaceNameToId[space.name] = created.id;

				// Track saved count for summary display, then remove to prevent duplicates on retry
				savedSpacesCount.value++;
				spacesToCreate.splice(0, 1);
			}

			return true;
		} catch {
			return false;
		}
	};

	const saveDeviceAssignments = async (): Promise<boolean> => {
		// Group device IDs by target space ID
		const spaceDevices: Record<string, string[]> = {};

		for (const [deviceId, spaceName] of Object.entries(deviceAssignments)) {
			if (!spaceName) continue;

			const spaceId = createdSpaceNameToId[spaceName];
			if (!spaceId) continue;

			if (!spaceDevices[spaceId]) {
				spaceDevices[spaceId] = [];
			}
			spaceDevices[spaceId].push(deviceId);
		}

		for (const [spaceId, deviceIds] of Object.entries(spaceDevices)) {
			const { error } = await backend.client.POST(`/${MODULES_PREFIX}/spaces/spaces/{id}/assign` as never, {
				params: { path: { id: spaceId } },
				body: {
					data: {
						device_ids: deviceIds,
						display_ids: [],
					},
				},
			} as never);

			if (error) return false;
		}

		return true;
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

			// Save device-to-space assignments if any exist
			const hasAssignments = Object.values(deviceAssignments).some((v) => v !== null);

			if (hasAssignments) {
				const assignmentsSaved = await saveDeviceAssignments();

				if (!assignmentsSaved) {
					flashMessage.error(t('onboardingModule.spaces.messages.assignmentError'));
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
		savedSpacesCount.value = 0;
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
		discoveredDevices.splice(0);
		Object.keys(deviceAssignments).forEach((key) => delete deviceAssignments[key]);
		Object.keys(createdSpaceNameToId).forEach((key) => delete createdSpaceNameToId[key]);
		devicesFetched.value = false;
		spacesSuggested.value = false;
	};

	return {
		currentStep,
		isLoading,
		accountCreated,
		hasLocationData,
		accountData,
		locationData,
		spacesToCreate,
		discoveredDevices,
		deviceAssignments,
		devicesFetched,
		savedSpacesCount,
		isLastStep,
		nextStep,
		prevStep,
		createAccount,
		saveLocation,
		saveSpaces,
		fetchDevices,
		suggestSpacesFromDevices,
		completeOnboarding,
		reset,
	};
};
