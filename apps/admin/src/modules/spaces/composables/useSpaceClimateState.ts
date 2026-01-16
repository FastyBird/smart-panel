import { ref, computed, type ComputedRef, type Ref, watch } from 'vue';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { SPACES_MODULE_PREFIX } from '../spaces.constants';
import type { ISpace } from '../store';

import type { components } from '../../../openapi';

type ClimateStateData = components['schemas']['SpacesModuleDataClimateState'];

export interface IClimateState {
	hasClimate: boolean;
	mode: 'heat' | 'cool' | 'auto' | 'off' | null;
	currentTemperature: number | null;
	currentHumidity: number | null;
	targetTemperature: number | null;
	heatingSetpoint: number | null;
	coolingSetpoint: number | null;
	minSetpoint: number;
	maxSetpoint: number;
	canSetSetpoint: boolean;
	supportsHeating: boolean;
	supportsCooling: boolean;
	isMixed: boolean;
	devicesCount: number;
	lastAppliedMode: string | null;
	lastAppliedAt: Date | null;
}

export interface IUseSpaceClimateState {
	climateState: ComputedRef<IClimateState | null>;
	isLoading: Ref<boolean>;
	error: Ref<string | null>;
	fetchClimateState: () => Promise<IClimateState | null>;
	hasClimate: ComputedRef<boolean>;
	isHeating: ComputedRef<boolean>;
	isCooling: ComputedRef<boolean>;
	isAuto: ComputedRef<boolean>;
	isOff: ComputedRef<boolean>;
	canAdjustTemperature: ComputedRef<boolean>;
}

const transformClimateState = (data: ClimateStateData): IClimateState => {
	return {
		hasClimate: data.has_climate ?? false,
		mode: (data.mode as IClimateState['mode']) ?? null,
		currentTemperature: data.current_temperature ?? null,
		currentHumidity: data.current_humidity ?? null,
		targetTemperature: data.target_temperature ?? null,
		heatingSetpoint: data.heating_setpoint ?? null,
		coolingSetpoint: data.cooling_setpoint ?? null,
		minSetpoint: data.min_setpoint ?? 5.0,
		maxSetpoint: data.max_setpoint ?? 35.0,
		canSetSetpoint: data.can_set_setpoint ?? false,
		supportsHeating: data.supports_heating ?? false,
		supportsCooling: data.supports_cooling ?? false,
		isMixed: data.is_mixed ?? false,
		devicesCount: data.devices_count ?? 0,
		lastAppliedMode: data.last_applied_mode ?? null,
		lastAppliedAt: data.last_applied_at ? new Date(data.last_applied_at) : null,
	};
};

export const useSpaceClimateState = (spaceId: Ref<ISpace['id'] | undefined>): IUseSpaceClimateState => {
	const backend = useBackend();

	const climateStateData = ref<IClimateState | null>(null);
	const isLoading = ref(false);
	const error = ref<string | null>(null);

	const climateState = computed(() => climateStateData.value);

	const hasClimate = computed(() => climateStateData.value?.hasClimate ?? false);
	const isHeating = computed(() => climateStateData.value?.mode === 'heat');
	const isCooling = computed(() => climateStateData.value?.mode === 'cool');
	const isAuto = computed(() => climateStateData.value?.mode === 'auto');
	const isOff = computed(() => climateStateData.value?.mode === 'off');
	const canAdjustTemperature = computed(() => {
		const state = climateStateData.value;
		return state !== null && state.hasClimate && state.canSetSetpoint;
	});

	const fetchClimateState = async (): Promise<IClimateState | null> => {
		if (!spaceId.value) return null;

		isLoading.value = true;
		error.value = null;

		try {
			const { data, error: apiError } = await backend.client.GET(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/climate`,
				{
					params: { path: { id: spaceId.value } },
				}
			);

			if (apiError || !data) {
				throw new Error('Failed to fetch climate state');
			}

			climateStateData.value = transformClimateState(data.data);
			return climateStateData.value;
		} catch (e) {
			error.value = e instanceof Error ? e.message : 'Unknown error';
			return null;
		} finally {
			isLoading.value = false;
		}
	};

	// Clear state when space ID changes
	watch(spaceId, () => {
		climateStateData.value = null;
		error.value = null;
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
