import { ref, type Ref } from 'vue';

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

export interface IUseSpaceIntents {
	isExecuting: Ref<boolean>;
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

	const isExecuting = ref(false);
	const error = ref<string | null>(null);
	const lastResult = ref<ILightingIntentResult | IClimateIntentResult | null>(null);

	// ============================================
	// LIGHTING INTENTS
	// ============================================

	const executeLightingIntent = async (request: ILightingIntentRequest): Promise<ILightingIntentResult | null> => {
		if (!spaceId.value) return null;

		isExecuting.value = true;
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
					params: { path: { id: spaceId.value } },
					body: { data: body },
				}
			);

			if (apiError || !data) {
				throw new Error('Failed to execute lighting intent');
			}

			const result: ILightingIntentResult = {
				success: data.data.success ?? false,
				affectedDevices: data.data.affected_devices ?? 0,
				failedDevices: data.data.failed_devices ?? 0,
			};

			lastResult.value = result;
			return result;
		} catch (e) {
			error.value = e instanceof Error ? e.message : 'Unknown error';
			return null;
		} finally {
			isExecuting.value = false;
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
		if (!spaceId.value) return null;

		isExecuting.value = true;
		error.value = null;

		try {
			const body = {
				type: request.type as SpacesModuleClimateIntentType,
				delta: request.delta as SpacesModuleLightingIntentDelta | undefined,
				increase: request.increase,
				value: request.value,
				heatingSetpoint: request.heatingSetpoint,
				coolingSetpoint: request.coolingSetpoint,
				mode: request.mode as SpacesModuleClimateIntentMode | undefined,
			} satisfies ClimateIntentBody;

			const { data, error: apiError } = await backend.client.POST(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/intents/climate`,
				{
					params: { path: { id: spaceId.value } },
					body: { data: body },
				}
			);

			if (apiError || !data) {
				throw new Error('Failed to execute climate intent');
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
			error.value = e instanceof Error ? e.message : 'Unknown error';
			return null;
		} finally {
			isExecuting.value = false;
		}
	};

	const adjustSetpoint = (delta: SetpointDelta, increase: boolean) =>
		executeClimateIntent({ type: 'setpoint_delta', delta, increase });
	const setSetpoint = (value: number) => executeClimateIntent({ type: 'setpoint_set', value });
	const setClimateMode = (mode: ClimateMode) => executeClimateIntent({ type: 'set_mode', mode });

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
