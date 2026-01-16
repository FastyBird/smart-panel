import { ref, computed, type ComputedRef, type Ref, watch } from 'vue';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { SPACES_MODULE_PREFIX } from '../spaces.constants';
import type { ISpace } from '../store';

import type { components } from '../../../openapi';

type LightingStateData = components['schemas']['SpacesModuleDataLightingState'];
type RoleAggregatedState = components['schemas']['SpacesModuleDataRoleAggregatedState'];

/**
 * Lighting state for a space, including mode detection and per-role breakdown.
 */
export interface ILightingState {
	/** Detected lighting mode based on current device states (work, relax, night, etc.) */
	detectedMode: string | null;
	/** Confidence level of the mode detection */
	modeConfidence: 'exact' | 'approximate' | 'none';
	/** Percentage match between current state and detected mode (0-100) */
	modeMatchPercentage: number | null;
	/** Last lighting mode that was explicitly applied */
	lastAppliedMode: string | null;
	/** When the last mode was applied */
	lastAppliedAt: Date | null;
	/** Total number of lights in the space */
	totalLights: number;
	/** Number of lights currently on */
	lightsOn: number;
	/** Average brightness across all on lights (0-100) */
	averageBrightness: number | null;
	/** Aggregated state per lighting role (main, task, ambient, etc.) */
	roles: Record<string, IRoleState>;
	/** State of lights not assigned to a specific role */
	other: IOtherLightsState;
}

/**
 * Aggregated state for lights with a specific role.
 */
export interface IRoleState {
	/** The lighting role identifier */
	role: string;
	/** Whether any light in this role is on */
	isOn: boolean;
	/** Whether lights in this role have mixed on/off states */
	isOnMixed: boolean;
	/** Average brightness of lights in this role (0-100) */
	brightness: number | null;
	/** Color temperature in Kelvin */
	colorTemperature: number | null;
	/** RGB color as hex string */
	color: string | null;
	/** Number of devices with this role */
	devicesCount: number;
	/** Number of devices currently on */
	devicesOn: number;
}

/**
 * State of lights not assigned to a specific role.
 */
export interface IOtherLightsState {
	/** Whether any uncategorized light is on */
	isOn: boolean;
	/** Whether uncategorized lights have mixed on/off states */
	isOnMixed: boolean;
	/** Average brightness (0-100) */
	brightness: number | null;
	/** Number of uncategorized devices */
	devicesCount: number;
	/** Number of uncategorized devices currently on */
	devicesOn: number;
}

/**
 * Return type for the useSpaceLightingState composable.
 */
export interface IUseSpaceLightingState {
	/** Current lighting state, or null if not yet fetched */
	lightingState: ComputedRef<ILightingState | null>;
	/** Whether a fetch request is in progress */
	isLoading: ComputedRef<boolean>;
	/** Error message from the last failed request */
	error: Ref<string | null>;
	/** Fetch lighting state from the API */
	fetchLightingState: () => Promise<ILightingState | null>;
	/** Whether the space has any lights */
	hasLights: ComputedRef<boolean>;
	/** Whether any lights are currently on */
	anyOn: ComputedRef<boolean>;
	/** Whether all lights are currently on */
	allOn: ComputedRef<boolean>;
	/** Whether all lights are currently off */
	allOff: ComputedRef<boolean>;
}

const transformLightingState = (data: LightingStateData): ILightingState => {
	const transformRoleState = (role: string, state: RoleAggregatedState): IRoleState => ({
		role,
		isOn: state.is_on ?? false,
		isOnMixed: state.is_on_mixed ?? false,
		brightness: state.brightness ?? null,
		colorTemperature: state.color_temperature ?? null,
		color: state.color ?? null,
		devicesCount: state.devices_count ?? 0,
		devicesOn: state.devices_on ?? 0,
	});

	const roles: Record<string, IRoleState> = {};
	if (data.roles) {
		for (const [role, state] of Object.entries(data.roles)) {
			if (state) {
				roles[role] = transformRoleState(role, state);
			}
		}
	}

	return {
		detectedMode: data.detected_mode ?? null,
		modeConfidence: data.mode_confidence ?? 'none',
		modeMatchPercentage: data.mode_match_percentage ?? null,
		lastAppliedMode: data.last_applied_mode ?? null,
		lastAppliedAt: data.last_applied_at ? new Date(data.last_applied_at) : null,
		totalLights: data.total_lights ?? 0,
		lightsOn: data.lights_on ?? 0,
		averageBrightness: data.average_brightness ?? null,
		roles,
		other: {
			isOn: data.other?.is_on ?? false,
			isOnMixed: data.other?.is_on_mixed ?? false,
			brightness: data.other?.brightness ?? null,
			devicesCount: data.other?.devices_count ?? 0,
			devicesOn: data.other?.devices_on ?? 0,
		},
	};
};

/**
 * Composable for fetching and managing lighting state for a space.
 *
 * Provides reactive access to lighting state including mode detection,
 * device counts, and per-role breakdowns. State is automatically cleared
 * when the space ID changes and stale requests are properly handled.
 *
 * @param spaceId - Reactive reference to the space ID
 * @returns Lighting state, loading/error states, and convenience computed properties
 *
 * @example
 * ```ts
 * const spaceId = ref('space-123');
 * const { lightingState, isLoading, fetchLightingState, allOff } = useSpaceLightingState(spaceId);
 *
 * await fetchLightingState();
 * if (allOff.value) {
 *   console.log('All lights are off');
 * }
 * ```
 */
export const useSpaceLightingState = (spaceId: Ref<ISpace['id'] | undefined>): IUseSpaceLightingState => {
	const backend = useBackend();

	const lightingStateData = ref<ILightingState | null>(null);
	// Use counter to handle concurrent/stale requests correctly
	const loadingCount = ref(0);
	const isLoading = computed(() => loadingCount.value > 0);
	const error = ref<string | null>(null);
	// Generation counter to distinguish requests across space navigation cycles
	let spaceGeneration = 0;

	const lightingState = computed(() => lightingStateData.value);

	const hasLights = computed(() => (lightingStateData.value?.totalLights ?? 0) > 0);
	const anyOn = computed(() => (lightingStateData.value?.lightsOn ?? 0) > 0);
	const allOn = computed(() => {
		const state = lightingStateData.value;
		return state !== null && state.totalLights > 0 && state.lightsOn === state.totalLights;
	});
	const allOff = computed(() => {
		const state = lightingStateData.value;
		return state !== null && state.totalLights > 0 && state.lightsOn === 0;
	});

	const fetchLightingState = async (): Promise<ILightingState | null> => {
		const currentSpaceId = spaceId.value;
		if (!currentSpaceId) return null;

		// Capture generation to detect stale requests even when returning to same space
		const requestGeneration = spaceGeneration;
		loadingCount.value++;
		error.value = null;

		try {
			const { data, error: apiError } = await backend.client.GET(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/lighting/state`,
				{
					params: { path: { id: currentSpaceId } },
				}
			);

			if (apiError || !data) {
				throw new Error('Failed to fetch lighting state');
			}

			// Only update state if this request is still current (same space and generation)
			if (spaceId.value !== currentSpaceId || spaceGeneration !== requestGeneration) {
				return null;
			}

			lightingStateData.value = transformLightingState(data.data);
			return lightingStateData.value;
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
		lightingStateData.value = null;
		error.value = null;
		loadingCount.value = 0;
	});

	return {
		lightingState,
		isLoading,
		error,
		fetchLightingState,
		hasLights,
		anyOn,
		allOn,
		allOff,
	};
};
