import { ref, computed, type ComputedRef, type Ref, watch } from 'vue';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { SPACES_MODULE_PREFIX } from '../spaces.constants';
import type { ISpace } from '../store';

import type { components } from '../../../openapi';

type SensorStateData = components['schemas']['SpacesModuleDataSensorState'];
type SensorReadingData = components['schemas']['SpacesModuleDataSensorReading'];
type SensorRoleReadingsData = components['schemas']['SpacesModuleDataSensorRoleReadings'];
type EnvironmentSummaryData = components['schemas']['SpacesModuleDataEnvironmentSummary'];
type SafetyAlertData = components['schemas']['SpacesModuleDataSafetyAlert'];

/**
 * Individual sensor reading
 */
export interface ISensorReading {
	deviceId: string;
	deviceName: string;
	channelId: string;
	channelName: string;
	channelCategory: string;
	value: number | boolean | string | null;
	unit: string | null;
	role: string | null;
}

/**
 * Aggregated sensor readings by role
 */
export interface ISensorRoleReadings {
	role: string;
	sensorsCount: number;
	readings: ISensorReading[];
}

/**
 * Environment summary data (aggregated environmental readings)
 */
export interface IEnvironmentSummary {
	averageTemperature: number | null;
	averageHumidity: number | null;
	averagePressure: number | null;
	averageIlluminance: number | null;
}

/**
 * Safety alert info
 */
export interface ISafetyAlert {
	channelCategory: string;
	deviceId: string;
	deviceName: string;
	channelId: string;
	triggered: boolean;
}

/**
 * Sensor state for a space, including readings and alerts.
 */
export interface ISensorState {
	/** Whether the space has any sensors */
	hasSensors: boolean;
	/** Total number of sensor channels in the space */
	totalSensors: number;
	/** Count of sensors by role */
	sensorsByRole: Record<string, number>;
	/** Aggregated environmental readings summary */
	environment: IEnvironmentSummary | null;
	/** List of active safety alerts */
	safetyAlerts: ISafetyAlert[];
	/** Whether any safety sensor is triggered */
	hasSafetyAlert: boolean;
	/** Whether any motion sensor is detecting motion */
	motionDetected: boolean;
	/** Whether any occupancy sensor is detecting presence */
	occupancyDetected: boolean;
	/** Sensor readings grouped by role */
	readings: ISensorRoleReadings[];
}

/**
 * Return type for the useSpaceSensorState composable.
 */
export interface IUseSpaceSensorState {
	/** Current sensor state, or null if not yet fetched */
	sensorState: ComputedRef<ISensorState | null>;
	/** Whether a fetch request is in progress */
	isLoading: ComputedRef<boolean>;
	/** Error message from the last failed request */
	error: Ref<string | null>;
	/** Fetch sensor state from the API */
	fetchSensorState: () => Promise<ISensorState | null>;
	/** Whether the space has any sensors */
	hasSensors: ComputedRef<boolean>;
	/** Whether any safety sensor is triggered */
	hasSafetyAlert: ComputedRef<boolean>;
	/** Whether motion is detected */
	motionDetected: ComputedRef<boolean>;
	/** Whether occupancy is detected */
	occupancyDetected: ComputedRef<boolean>;
	/** Average temperature from environment sensors */
	averageTemperature: ComputedRef<number | null>;
	/** Average humidity from environment sensors */
	averageHumidity: ComputedRef<number | null>;
}

const transformSensorReading = (data: SensorReadingData): ISensorReading => {
	return {
		deviceId: data.device_id,
		deviceName: data.device_name,
		channelId: data.channel_id,
		channelName: data.channel_name,
		channelCategory: data.channel_category,
		value: data.value ?? null,
		unit: data.unit ?? null,
		role: data.role ?? null,
	};
};

const transformSensorRoleReadings = (data: SensorRoleReadingsData): ISensorRoleReadings => {
	return {
		role: data.role,
		sensorsCount: data.sensors_count,
		readings: (data.readings ?? []).map(transformSensorReading),
	};
};

const transformEnvironmentSummary = (data: EnvironmentSummaryData | null | undefined): IEnvironmentSummary | null => {
	if (!data) return null;
	return {
		averageTemperature: data.average_temperature ?? null,
		averageHumidity: data.average_humidity ?? null,
		averagePressure: data.average_pressure ?? null,
		averageIlluminance: data.average_illuminance ?? null,
	};
};

const transformSafetyAlert = (data: SafetyAlertData): ISafetyAlert => {
	return {
		channelCategory: data.channel_category,
		deviceId: data.device_id,
		deviceName: data.device_name,
		channelId: data.channel_id,
		triggered: data.triggered,
	};
};

const transformSensorState = (data: SensorStateData): ISensorState => {
	return {
		hasSensors: data.has_sensors ?? false,
		totalSensors: data.total_sensors ?? 0,
		sensorsByRole: data.sensors_by_role ?? {},
		environment: transformEnvironmentSummary(data.environment),
		safetyAlerts: (data.safety_alerts ?? []).map(transformSafetyAlert),
		hasSafetyAlert: data.has_safety_alert ?? false,
		motionDetected: data.motion_detected ?? false,
		occupancyDetected: data.occupancy_detected ?? false,
		readings: (data.readings ?? []).map(transformSensorRoleReadings),
	};
};

/**
 * Composable for fetching and managing sensor state for a space.
 *
 * Provides reactive access to sensor state including environment readings,
 * safety alerts, motion/occupancy detection, and per-role breakdowns.
 * State is automatically cleared when the space ID changes and stale
 * requests are properly handled.
 *
 * @param spaceId - Reactive reference to the space ID
 * @returns Sensor state, loading/error states, and convenience computed properties
 *
 * @example
 * ```ts
 * const spaceId = ref('space-123');
 * const { sensorState, isLoading, fetchSensorState, hasSafetyAlert } = useSpaceSensorState(spaceId);
 *
 * await fetchSensorState();
 * if (hasSafetyAlert.value) {
 *   console.log('Safety alert detected!');
 * }
 * ```
 */
export const useSpaceSensorState = (spaceId: Ref<ISpace['id'] | undefined>): IUseSpaceSensorState => {
	const backend = useBackend();

	const sensorStateData = ref<ISensorState | null>(null);
	// Use counter to handle concurrent/stale requests correctly
	const loadingCount = ref(0);
	const isLoading = computed(() => loadingCount.value > 0);
	const error = ref<string | null>(null);
	// Generation counter to distinguish requests across space navigation cycles
	let spaceGeneration = 0;

	const sensorState = computed(() => sensorStateData.value);

	const hasSensors = computed(() => sensorStateData.value?.hasSensors ?? false);
	const hasSafetyAlert = computed(() => sensorStateData.value?.hasSafetyAlert ?? false);
	const motionDetected = computed(() => sensorStateData.value?.motionDetected ?? false);
	const occupancyDetected = computed(() => sensorStateData.value?.occupancyDetected ?? false);
	const averageTemperature = computed(() => sensorStateData.value?.environment?.averageTemperature ?? null);
	const averageHumidity = computed(() => sensorStateData.value?.environment?.averageHumidity ?? null);

	const fetchSensorState = async (): Promise<ISensorState | null> => {
		const currentSpaceId = spaceId.value;
		if (!currentSpaceId) return null;

		// Capture generation to detect stale requests even when returning to same space
		const requestGeneration = spaceGeneration;
		loadingCount.value++;
		error.value = null;

		try {
			const { data, error: apiError } = await backend.client.GET(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/sensors`,
				{
					params: { path: { id: currentSpaceId } },
				}
			);

			if (apiError || !data) {
				throw new Error('Failed to fetch sensor state');
			}

			// Only update state if this request is still current (same space and generation)
			if (spaceId.value !== currentSpaceId || spaceGeneration !== requestGeneration) {
				return null;
			}

			sensorStateData.value = transformSensorState(data.data);
			return sensorStateData.value;
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
		sensorStateData.value = null;
		error.value = null;
		loadingCount.value = 0;
	});

	return {
		sensorState,
		isLoading,
		error,
		fetchSensorState,
		hasSensors,
		hasSafetyAlert,
		motionDetected,
		occupancyDetected,
		averageTemperature,
		averageHumidity,
	};
};
