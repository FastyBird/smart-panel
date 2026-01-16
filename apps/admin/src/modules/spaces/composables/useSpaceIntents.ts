import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { SPACES_MODULE_PREFIX } from '../spaces.constants';
import type { ISpace } from '../store';

import type { components } from '../../../openapi';
import {
	SpacesModuleLightingIntentType,
	SpacesModuleDataLightingStateDetected_mode,
	SpacesModuleLightingIntentDelta,
	SpacesModuleDataRoleAggregatedStateRole,
	SpacesModuleClimateIntentType,
	SpacesModuleClimateIntentMode,
} from '../../../openapi';

type LightingIntentBody = components['schemas']['SpacesModuleLightingIntent'];
type ClimateIntentBody = components['schemas']['SpacesModuleClimateIntent'];

// ============================================
// LIGHTING INTENT TYPES
// ============================================

export type LightingIntentType = `${SpacesModuleLightingIntentType}`;
export type LightingMode = `${SpacesModuleDataLightingStateDetected_mode}`;
export type BrightnessDelta = `${SpacesModuleLightingIntentDelta}`;
// Note: LightingRole is also exported from spaces.constants.ts - use type alias here to avoid conflict
type LightingRole = `${SpacesModuleDataRoleAggregatedStateRole}`;

export interface ILightingIntentRequest {
	type: LightingIntentType;
	mode?: LightingMode;
	delta?: BrightnessDelta;
	increase?: boolean;
	role?: LightingRole;
	on?: boolean;
	brightness?: number;
	color?: string;
	colorTemperature?: number;
	white?: number;
}

export interface ILightingIntentResult {
	success: boolean;
	affectedDevices: number;
	failedDevices: number;
}

// ============================================
// CLIMATE INTENT TYPES
// ============================================

export type ClimateIntentType = `${SpacesModuleClimateIntentType}`;
// Note: The API uses the same delta values (small/medium/large) for both brightness and setpoint adjustments
export type SetpointDelta = `${SpacesModuleLightingIntentDelta}`;
export type ClimateMode = `${SpacesModuleClimateIntentMode}`;

export interface IClimateIntentRequest {
	type: ClimateIntentType;
	delta?: SetpointDelta;
	increase?: boolean;
	value?: number;
	heatingSetpoint?: number;
	coolingSetpoint?: number;
	mode?: ClimateMode;
}

export interface IClimateIntentResult {
	success: boolean;
	affectedDevices: number;
	failedDevices: number;
	mode?: string;
	newSetpoint?: number;
	heatingSetpoint?: number;
	coolingSetpoint?: number;
}

// ============================================
// COMPOSABLE INTERFACE
// ============================================

/**
 * Composable for executing lighting and climate intents on a space.
 *
 * Note: After executing an intent, a new undo window becomes available on the backend.
 * Callers should refresh undo state via `useSpaceUndo().fetchUndoState()` after successful
 * intent execution to surface the undo option to users.
 *
 * Lighting and climate state updates are typically received via WebSocket events,
 * but callers may also manually refresh state if needed.
 */
export interface IUseSpaceIntents {
	isExecuting: ComputedRef<boolean>;
	error: Ref<string | null>;
	lastResult: Ref<ILightingIntentResult | IClimateIntentResult | null>;
	// Lighting intents
	executeLightingIntent: (request: ILightingIntentRequest) => Promise<ILightingIntentResult | null>;
	turnLightsOff: () => Promise<ILightingIntentResult | null>;
	turnLightsOn: () => Promise<ILightingIntentResult | null>;
	setLightingMode: (mode: LightingMode) => Promise<ILightingIntentResult | null>;
	adjustBrightness: (delta: BrightnessDelta, increase: boolean) => Promise<ILightingIntentResult | null>;
	turnRoleOn: (role: LightingRole) => Promise<ILightingIntentResult | null>;
	turnRoleOff: (role: LightingRole) => Promise<ILightingIntentResult | null>;
	setRoleBrightness: (role: LightingRole, brightness: number) => Promise<ILightingIntentResult | null>;
	setRoleColor: (role: LightingRole, color: string) => Promise<ILightingIntentResult | null>;
	setRoleColorTemp: (role: LightingRole, colorTemperature: number) => Promise<ILightingIntentResult | null>;
	// Climate intents
	executeClimateIntent: (request: IClimateIntentRequest) => Promise<IClimateIntentResult | null>;
	adjustSetpoint: (delta: SetpointDelta, increase: boolean) => Promise<IClimateIntentResult | null>;
	setSetpoint: (value: number) => Promise<IClimateIntentResult | null>;
	setClimateMode: (mode: ClimateMode) => Promise<IClimateIntentResult | null>;
}

export const useSpaceIntents = (spaceId: Ref<ISpace['id'] | undefined>): IUseSpaceIntents => {
	const backend = useBackend();

	// Use counter instead of boolean to handle concurrent executions correctly
	const executingCount = ref(0);
	const isExecuting = computed(() => executingCount.value > 0);
	const error = ref<string | null>(null);
	const lastResult = ref<ILightingIntentResult | IClimateIntentResult | null>(null);
	// Generation counter to distinguish requests across space navigation cycles
	let spaceGeneration = 0;

	// ============================================
	// LIGHTING INTENTS
	// ============================================

	const executeLightingIntent = async (request: ILightingIntentRequest): Promise<ILightingIntentResult | null> => {
		const currentSpaceId = spaceId.value;
		if (!currentSpaceId) return null;

		// Capture generation to detect stale requests even when returning to same space
		const requestGeneration = spaceGeneration;
		executingCount.value++;
		error.value = null;

		try {
			const body = {
				type: request.type as SpacesModuleLightingIntentType,
				mode: request.mode as SpacesModuleDataLightingStateDetected_mode | undefined,
				delta: request.delta as SpacesModuleLightingIntentDelta | undefined,
				increase: request.increase,
				role: request.role as SpacesModuleDataRoleAggregatedStateRole | undefined,
				on: request.on,
				brightness: request.brightness,
				color: request.color,
				color_temperature: request.colorTemperature,
				white: request.white,
			} satisfies LightingIntentBody;

			const { data, error: apiError } = await backend.client.POST(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/intents/lighting`,
				{
					params: { path: { id: currentSpaceId } },
					body: { data: body },
				}
			);

			if (apiError || !data) {
				throw new Error('Failed to execute lighting intent');
			}

			// Only update state if this request is still current (same space and generation)
			if (spaceId.value !== currentSpaceId || spaceGeneration !== requestGeneration) {
				return null;
			}

			const result: ILightingIntentResult = {
				success: data.data.success ?? false,
				affectedDevices: data.data.affected_devices ?? 0,
				failedDevices: data.data.failed_devices ?? 0,
			};

			lastResult.value = result;
			return result;
		} catch (e) {
			// Only update error if this request is still current
			if (spaceId.value === currentSpaceId && spaceGeneration === requestGeneration) {
				error.value = e instanceof Error ? e.message : 'Unknown error';
			}
			return null;
		} finally {
			// Only update loading if this request is still current
			// Guard against going negative if watch handler reset the counter while request was in flight
			if (spaceId.value === currentSpaceId && spaceGeneration === requestGeneration && executingCount.value > 0) {
				executingCount.value--;
			}
		}
	};

	const turnLightsOff = () => executeLightingIntent({ type: 'off' });
	const turnLightsOn = () => executeLightingIntent({ type: 'on' });
	const setLightingMode = (mode: LightingMode) => executeLightingIntent({ type: 'set_mode', mode });
	const adjustBrightness = (delta: BrightnessDelta, increase: boolean) =>
		executeLightingIntent({ type: 'brightness_delta', delta, increase });
	const turnRoleOn = (role: LightingRole) => executeLightingIntent({ type: 'role_on', role });
	const turnRoleOff = (role: LightingRole) => executeLightingIntent({ type: 'role_off', role });
	const setRoleBrightness = (role: LightingRole, brightness: number) =>
		executeLightingIntent({ type: 'role_brightness', role, brightness });
	const setRoleColor = (role: LightingRole, color: string) =>
		executeLightingIntent({ type: 'role_color', role, color });
	const setRoleColorTemp = (role: LightingRole, colorTemperature: number) =>
		executeLightingIntent({ type: 'role_color_temp', role, colorTemperature });

	// ============================================
	// CLIMATE INTENTS
	// ============================================

	const executeClimateIntent = async (request: IClimateIntentRequest): Promise<IClimateIntentResult | null> => {
		const currentSpaceId = spaceId.value;
		if (!currentSpaceId) return null;

		// Capture generation to detect stale requests even when returning to same space
		const requestGeneration = spaceGeneration;
		executingCount.value++;
		error.value = null;

		try {
			const body = {
				type: request.type as SpacesModuleClimateIntentType,
				delta: request.delta as SpacesModuleLightingIntentDelta | undefined,
				increase: request.increase,
				value: request.value,
				heating_setpoint: request.heatingSetpoint,
				cooling_setpoint: request.coolingSetpoint,
				mode: request.mode as SpacesModuleClimateIntentMode | undefined,
			} satisfies ClimateIntentBody;

			const { data, error: apiError } = await backend.client.POST(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/intents/climate`,
				{
					params: { path: { id: currentSpaceId } },
					body: { data: body },
				}
			);

			if (apiError || !data) {
				throw new Error('Failed to execute climate intent');
			}

			// Only update state if this request is still current (same space and generation)
			if (spaceId.value !== currentSpaceId || spaceGeneration !== requestGeneration) {
				return null;
			}

			const result: IClimateIntentResult = {
				success: data.data.success ?? false,
				affectedDevices: data.data.affected_devices ?? 0,
				failedDevices: data.data.failed_devices ?? 0,
				mode: data.data.mode ?? undefined,
				newSetpoint: data.data.new_setpoint ?? undefined,
				heatingSetpoint: data.data.heating_setpoint ?? undefined,
				coolingSetpoint: data.data.cooling_setpoint ?? undefined,
			};

			lastResult.value = result;
			return result;
		} catch (e) {
			// Only update error if this request is still current
			if (spaceId.value === currentSpaceId && spaceGeneration === requestGeneration) {
				error.value = e instanceof Error ? e.message : 'Unknown error';
			}
			return null;
		} finally {
			// Only update loading if this request is still current
			// Guard against going negative if watch handler reset the counter while request was in flight
			if (spaceId.value === currentSpaceId && spaceGeneration === requestGeneration && executingCount.value > 0) {
				executingCount.value--;
			}
		}
	};

	const adjustSetpoint = (delta: SetpointDelta, increase: boolean) =>
		executeClimateIntent({ type: 'setpoint_delta', delta, increase });
	const setSetpoint = (value: number) => executeClimateIntent({ type: 'setpoint_set', value });
	const setClimateMode = (mode: ClimateMode) => executeClimateIntent({ type: 'set_mode', mode });

	// Clear state when space changes to prevent stale data from appearing in new space
	watch(spaceId, () => {
		// Increment generation to invalidate any in-flight requests
		spaceGeneration++;
		error.value = null;
		lastResult.value = null;
		executingCount.value = 0;
	});

	return {
		isExecuting,
		error,
		lastResult,
		// Lighting intents
		executeLightingIntent,
		turnLightsOff,
		turnLightsOn,
		setLightingMode,
		adjustBrightness,
		turnRoleOn,
		turnRoleOff,
		setRoleBrightness,
		setRoleColor,
		setRoleColorTemp,
		// Climate intents
		executeClimateIntent,
		adjustSetpoint,
		setSetpoint,
		setClimateMode,
	};
};
