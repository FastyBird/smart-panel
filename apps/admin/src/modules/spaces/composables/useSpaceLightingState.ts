import { ref, computed, type ComputedRef, type Ref, watch } from 'vue';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { SPACES_MODULE_PREFIX } from '../spaces.constants';
import type { ISpace } from '../store';

import type { components } from '../../../openapi';

type LightingStateData = components['schemas']['SpacesModuleDataLightingState'];
type RoleAggregatedState = components['schemas']['SpacesModuleDataRoleAggregatedState'];

export interface ILightingState {
	detectedMode: string | null;
	modeConfidence: 'exact' | 'approximate' | 'none';
	modeMatchPercentage: number | null;
	lastAppliedMode: string | null;
	lastAppliedAt: Date | null;
	totalLights: number;
	lightsOn: number;
	averageBrightness: number | null;
	roles: Record<string, IRoleState>;
	other: IOtherLightsState;
}

export interface IRoleState {
	role: string;
	isOn: boolean;
	isOnMixed: boolean;
	brightness: number | null;
	colorTemperature: number | null;
	color: string | null;
	devicesCount: number;
	devicesOn: number;
}

export interface IOtherLightsState {
	isOn: boolean;
	isOnMixed: boolean;
	brightness: number | null;
	devicesCount: number;
	devicesOn: number;
}

export interface IUseSpaceLightingState {
	lightingState: ComputedRef<ILightingState | null>;
	isLoading: ComputedRef<boolean>;
	error: Ref<string | null>;
	fetchLightingState: () => Promise<ILightingState | null>;
	hasLights: ComputedRef<boolean>;
	anyOn: ComputedRef<boolean>;
	allOn: ComputedRef<boolean>;
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

export const useSpaceLightingState = (spaceId: Ref<ISpace['id'] | undefined>): IUseSpaceLightingState => {
	const backend = useBackend();

	const lightingStateData = ref<ILightingState | null>(null);
	// Use counter to handle concurrent/stale requests correctly
	const loadingCount = ref(0);
	const isLoading = computed(() => loadingCount.value > 0);
	const error = ref<string | null>(null);

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

			// Only update state if spaceId hasn't changed during the fetch
			if (spaceId.value !== currentSpaceId) {
				return null;
			}

			lightingStateData.value = transformLightingState(data.data);
			return lightingStateData.value;
		} catch (e) {
			// Only update error if spaceId hasn't changed during the fetch
			if (spaceId.value === currentSpaceId) {
				error.value = e instanceof Error ? e.message : 'Unknown error';
			}
			return null;
		} finally {
			// Only update loading if spaceId hasn't changed during the fetch
			// Guard against going negative if watch handler reset the counter while request was in flight
			if (spaceId.value === currentSpaceId && loadingCount.value > 0) {
				loadingCount.value--;
			}
		}
	};

	// Clear state when space ID changes
	watch(spaceId, () => {
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
