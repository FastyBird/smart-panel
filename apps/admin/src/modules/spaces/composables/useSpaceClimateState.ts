import { ref, computed, type ComputedRef, type Ref, watch } from 'vue';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { SPACES_MODULE_PREFIX } from '../spaces.constants';
import type { ISpace } from '../store';

import type { components } from '../../../openapi';

type ClimateStateData = components['schemas']['SpacesModuleDataClimateState'];

/**
 * Climate state for a space, including temperature, humidity, and HVAC mode.
 */
export interface IClimateState {
	/** Whether the space has climate control devices */
	hasClimate: boolean;
	/** Current HVAC mode (heat, cool, auto, off) */
	mode: 'heat' | 'cool' | 'auto' | 'off' | null;
	/** Current temperature reading in Celsius */
	currentTemperature: number | null;
	/** Current humidity reading as percentage (0-100) */
	currentHumidity: number | null;
	/** Heating setpoint - target temperature for heating (used in HEAT and AUTO modes) */
	heatingSetpoint: number | null;
	/** Cooling setpoint - target temperature for cooling (used in COOL and AUTO modes) */
	coolingSetpoint: number | null;
	/** Minimum allowed setpoint value */
	minSetpoint: number;
	/** Maximum allowed setpoint value */
	maxSetpoint: number;
	/** Whether heating is supported */
	supportsHeating: boolean;
	/** Whether cooling is supported */
	supportsCooling: boolean;
	/** Whether devices have mixed states */
	isMixed: boolean;
	/** Number of climate devices in the space */
	devicesCount: number;
	/** Last explicitly applied climate mode */
	lastAppliedMode: string | null;
	/** When the last mode was applied */
	lastAppliedAt: Date | null;
}

/**
 * Return type for the useSpaceClimateState composable.
 */
export interface IUseSpaceClimateState {
	/** Current climate state, or null if not yet fetched */
	climateState: ComputedRef<IClimateState | null>;
	/** Whether a fetch request is in progress */
	isLoading: ComputedRef<boolean>;
	/** Error message from the last failed request */
	error: Ref<string | null>;
	/** Fetch climate state from the API */
	fetchClimateState: () => Promise<IClimateState | null>;
	/** Whether the space has climate devices */
	hasClimate: ComputedRef<boolean>;
	/** Whether currently in heating mode */
	isHeating: ComputedRef<boolean>;
	/** Whether currently in cooling mode */
	isCooling: ComputedRef<boolean>;
	/** Whether currently in auto mode */
	isAuto: ComputedRef<boolean>;
	/** Whether climate is currently off */
	isOff: ComputedRef<boolean>;
	/** Whether temperature can be adjusted */
	canAdjustTemperature: ComputedRef<boolean>;
}

const transformClimateState = (data: ClimateStateData): IClimateState => {
	return {
		hasClimate: data.has_climate ?? false,
		mode: (data.mode as IClimateState['mode']) ?? null,
		currentTemperature: data.current_temperature ?? null,
		currentHumidity: data.current_humidity ?? null,
		heatingSetpoint: data.heating_setpoint ?? null,
		coolingSetpoint: data.cooling_setpoint ?? null,
		minSetpoint: data.min_setpoint ?? 5.0,
		maxSetpoint: data.max_setpoint ?? 35.0,
		supportsHeating: data.supports_heating ?? false,
		supportsCooling: data.supports_cooling ?? false,
		isMixed: data.is_mixed ?? false,
		devicesCount: data.devices_count ?? 0,
		lastAppliedMode: data.last_applied_mode ?? null,
		lastAppliedAt: data.last_applied_at ? new Date(data.last_applied_at) : null,
	};
};

/**
 * Composable for fetching and managing climate state for a space.
 *
 * Provides reactive access to climate state including temperature, humidity,
 * and HVAC mode. State is automatically cleared when the space ID changes
 * and stale requests are properly handled.
 *
 * @param spaceId - Reactive reference to the space ID
 * @returns Climate state, loading/error states, and convenience computed properties
 *
 * @example
 * ```ts
 * const spaceId = ref('space-123');
 * const { climateState, isLoading, fetchClimateState, isHeating } = useSpaceClimateState(spaceId);
 *
 * await fetchClimateState();
 * if (isHeating.value) {
 *   console.log(`Heating to ${climateState.value?.heatingSetpoint}°C`);
 * }
 * ```
 */
export const useSpaceClimateState = (spaceId: Ref<ISpace['id'] | undefined>): IUseSpaceClimateState => {
	const backend = useBackend();

	const climateStateData = ref<IClimateState | null>(null);
	// Use counter to handle concurrent/stale requests correctly
	const loadingCount = ref(0);
	const isLoading = computed(() => loadingCount.value > 0);
	const error = ref<string | null>(null);
	// Generation counter to distinguish requests across space navigation cycles
	let spaceGeneration = 0;

	const climateState = computed(() => climateStateData.value);

	const hasClimate = computed(() => climateStateData.value?.hasClimate ?? false);
	const isHeating = computed(() => climateStateData.value?.mode === 'heat');
	const isCooling = computed(() => climateStateData.value?.mode === 'cool');
	const isAuto = computed(() => climateStateData.value?.mode === 'auto');
	const isOff = computed(() => climateStateData.value?.mode === 'off');
	const canAdjustTemperature = computed(() => {
		const state = climateStateData.value;
		return state !== null && state.hasClimate && (state.supportsHeating || state.supportsCooling);
	});

	const fetchClimateState = async (): Promise<IClimateState | null> => {
		const currentSpaceId = spaceId.value;
		if (!currentSpaceId) return null;

		// Capture generation to detect stale requests even when returning to same space
		const requestGeneration = spaceGeneration;
		loadingCount.value++;
		error.value = null;

		try {
			const { data, error: apiError } = await backend.client.GET(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/climate`,
				{
					params: { path: { id: currentSpaceId } },
				}
			);

			if (apiError || !data) {
				throw new Error('Failed to fetch climate state');
			}

			// Only update state if this request is still current (same space and generation)
			if (spaceId.value !== currentSpaceId || spaceGeneration !== requestGeneration) {
				return null;
			}

			climateStateData.value = transformClimateState(data.data);
			return climateStateData.value;
		} catch (e) {
			// Only update error if this request is still current
			if (spaceId.value === currentSpaceId && spaceGeneration === requestGeneration) {
				error.value = e instanceof Error ? e.message : 'Unknown error';
			}
			return null;
		} finally {
			// Only update loading if this request is still current
			// Guard against going negative if watch handler reset the counter while request was in flight
			if (spaceId.value === currentSpaceId && spaceGeneration === requestGeneration && loadingCount.value > 0) {
				loadingCount.value--;
			}
		}
	};

	// Clear state when space ID changes
	watch(spaceId, () => {
		// Increment generation to invalidate any in-flight requests
		spaceGeneration++;
		climateStateData.value = null;
		error.value = null;
		loadingCount.value = 0;
	});

	return {
		climateState,
		isLoading,
		error,
		fetchClimateState,
		hasClimate,
		isHeating,
		isCooling,
		isAuto,
		isOff,
		canAdjustTemperature,
	};
};
