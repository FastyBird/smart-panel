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

/**
 * Request parameters for a lighting intent.
 */
export interface ILightingIntentRequest {
	/** Type of lighting intent to execute */
	type: LightingIntentType;
	/** Target lighting mode (for set_mode intent) */
	mode?: LightingMode;
	/** Brightness adjustment size (for brightness_delta intent) */
	delta?: BrightnessDelta;
	/** Direction of adjustment (true = increase, false = decrease) */
	increase?: boolean;
	/** Target lighting role (for role_* intents) */
	role?: LightingRole;
	/** On/off state */
	on?: boolean;
	/** Target brightness (0-100) */
	brightness?: number;
	/** Target color as hex string */
	color?: string;
	/** Target color temperature in Kelvin */
	colorTemperature?: number;
	/** White channel value (0-255) */
	white?: number;
}

/**
 * Result of a lighting intent execution.
 */
export interface ILightingIntentResult {
	/** Whether the intent executed successfully */
	success: boolean;
	/** Number of devices affected by the intent */
	affectedDevices: number;
	/** Number of devices that failed to respond */
	failedDevices: number;
}

// ============================================
// CLIMATE INTENT TYPES
// ============================================

export type ClimateIntentType = `${SpacesModuleClimateIntentType}`;
// Note: The API uses the same delta values (small/medium/large) for both brightness and setpoint adjustments
export type SetpointDelta = `${SpacesModuleLightingIntentDelta}`;
export type ClimateMode = `${SpacesModuleClimateIntentMode}`;

/**
 * Request parameters for a climate intent.
 */
export interface IClimateIntentRequest {
	/** Type of climate intent to execute */
	type: ClimateIntentType;
	/** Setpoint adjustment size (for setpoint_delta intent) */
	delta?: SetpointDelta;
	/** Direction of adjustment (true = increase, false = decrease) */
	increase?: boolean;
	/** Heating setpoint (used in HEAT mode or as lower bound in AUTO mode) */
	heatingSetpoint?: number;
	/** Cooling setpoint (used in COOL mode or as upper bound in AUTO mode) */
	coolingSetpoint?: number;
	/** Target climate mode */
	mode?: ClimateMode;
}

/**
 * Result of a climate intent execution.
 */
export interface IClimateIntentResult {
	/** Whether the intent executed successfully */
	success: boolean;
	/** Number of devices affected by the intent */
	affectedDevices: number;
	/** Number of devices that failed to respond */
	failedDevices: number;
	/** New climate mode after intent execution */
	mode?: string;
	/** New heating setpoint (used in HEAT and AUTO modes) */
	heatingSetpoint?: number;
	/** New cooling setpoint (used in COOL and AUTO modes) */
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
	setSetpoint: (value: number, mode?: ClimateMode) => Promise<IClimateIntentResult | null>;
	setClimateMode: (mode: ClimateMode) => Promise<IClimateIntentResult | null>;
	}

/**
 * Composable for executing lighting and climate intents on a space.
 *
 * Provides methods to control lights and climate devices through high-level
 * intents. Supports concurrent execution tracking and proper cleanup when
 * the space changes.
 *
 * After executing an intent, a new undo window becomes available. Callers
 * should refresh undo state via `useSpaceUndo().fetchUndoState()` to surface
 * the undo option to users.
 *
 * @param spaceId - Reactive reference to the space ID
 * @returns Intent execution methods, loading state, and last result
 *
 * @example
 * ```ts
 * const spaceId = ref('space-123');
 * const { turnLightsOff, adjustSetpoint, isExecuting } = useSpaceIntents(spaceId);
 *
 * // Turn off all lights
 * await turnLightsOff();
 *
 * // Increase temperature by a medium step
 * await adjustSetpoint('medium', true);
 * ```
 */
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
	const setSetpoint = (value: number, mode?: ClimateMode) => {
		// Use coolingSetpoint for COOL mode, heatingSetpoint for all other modes
		if (mode === 'cool') {
			return executeClimateIntent({ type: 'setpoint_set', coolingSetpoint: value });
		}
		return executeClimateIntent({ type: 'setpoint_set', heatingSetpoint: value });
	};
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
