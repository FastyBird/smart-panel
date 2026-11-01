import type { useBackend } from '../../../common';
import { SpacesModuleClimateIntentMode, type components } from '../../../openapi';
import type { OpenApiPaths } from '../../../openapi.constants';

export type NativeMode = 'off' | 'heat' | 'cool' | 'auto';
export interface NativeRange {
	minimum: number;
	maximum: number;
	step: number;
}
export interface NativeCapabilities {
	modes: NativeMode[];
	heating: NativeRange | null;
	cooling: NativeRange | null;
	supportsCompound: boolean;
}
export interface NativeCandidate {
	device: string;
	name: string;
	provider: string;
	physical_identity: string;
	fingerprint: string;
	capabilities: NativeCapabilities;
	reasons: string[];
}
export interface NativeSnapshot {
	controller: string;
	binding_state: 'bound' | 'releasing' | 'released';
	drift: string[];
	control_strategy: 'native_unit';
	revision: number;
	source_device: string;
	provider: string;
	physical_identity: string;
	fingerprint: string;
	capabilities: NativeCapabilities | null;
	requested: { mode?: NativeMode; heatingSetpoint?: number; coolingSetpoint?: number };
	observed: {
		available: boolean;
		temperature: number | null;
		mode: string | null;
		heatingSetpoint: number | null;
		coolingSetpoint: number | null;
		activity: string | null;
		observedAt: string | null;
		reasons: string[];
	};
	latest_request?: {
		id: string;
		state: string;
		operations: { operation: string; outcome: 'accepted' | 'refused' | 'unknown'; reason?: string; confirmed: boolean }[];
	} | null;
}
export interface NativeAction {
	mode?: NativeMode;
	heating_setpoint?: number;
	cooling_setpoint?: number;
}
export interface NativeThermostatTransport {
	candidates(signal: AbortSignal): Promise<NativeCandidate[]>;
	read(id: string, signal: AbortSignal): Promise<NativeSnapshot | null>;
	create(name: string, source: string, signal: AbortSignal): Promise<NativeSnapshot>;
	request(id: string, revision: number, requestId: string, action: NativeAction, signal: AbortSignal): Promise<NativeSnapshot>;
	revalidate(id: string, revision: number, source: string, signal: AbortSignal): Promise<NativeSnapshot>;
	release(id: string, revision: number, signal: AbortSignal): Promise<NativeSnapshot>;
}
const failed = (): never => {
	throw new Error('native_request_failed');
};

export function nativeTargetValid(range: NativeRange | null | undefined, value: number | undefined): value is number {
	if (
		!range ||
		value === undefined ||
		![value, range.minimum, range.maximum, range.step].every(Number.isFinite) ||
		range.step <= 0 ||
		range.minimum >= range.maximum ||
		value < range.minimum ||
		value > range.maximum
	)
		return false;
	const steps = (value - range.minimum) / range.step;
	return Math.abs(steps - Math.round(steps)) < 1e-6;
}
export function nativeAutoAction(capabilities: NativeCapabilities | null, targets: { heating?: number; cooling?: number }): NativeAction | null {
	if (
		!capabilities?.supportsCompound ||
		!capabilities.modes.includes('auto') ||
		!nativeTargetValid(capabilities.heating, targets.heating) ||
		!nativeTargetValid(capabilities.cooling, targets.cooling) ||
		targets.heating >= targets.cooling
	)
		return null;
	return { mode: 'auto', heating_setpoint: targets.heating, cooling_setpoint: targets.cooling };
}

/** HA dual-target commands require an explicit mode; Zigbee never receives an invented compound request. */
export function nativeTargetAction(
	state: NativeSnapshot,
	branch: 'heating' | 'cooling',
	targets: { heating?: number; cooling?: number }
): NativeAction | null {
	const value = targets[branch];
	const capabilities = state.capabilities;
	if (!capabilities || !nativeTargetValid(capabilities[branch], value)) return null;
	const action: NativeAction = branch === 'heating' ? { heating_setpoint: value } : { cooling_setpoint: value };
	if (state.provider !== 'home-assistant' || !capabilities.heating || !capabilities.cooling) return action;
	const mode = branch === 'heating' ? 'heat' : 'cool';
	if (capabilities.modes.includes(mode)) return { ...action, mode };
	if (capabilities.modes.includes('auto')) return nativeAutoAction(capabilities, targets);
	return null;
}

/** Generated route types validate the wire contract; caller owns lifecycle and the total request deadline. */
const state = (value: components['schemas']['DevicesVirtualPluginDataNativeThermostat'] | undefined): NativeSnapshot => {
	if (!value?.controller) return failed();
	return { ...value, controller: value.controller };
};
export function nativeThermostatTransport(backend: ReturnType<typeof useBackend<OpenApiPaths>>): NativeThermostatTransport {
	return {
		async candidates(signal) {
			const { data } = await backend.client.GET('/plugins/devices-virtual/producers/thermostats/native/candidates', { signal });
			return data?.data ?? failed();
		},
		async read(id, signal) {
			const { data, response } = await backend.client.GET('/plugins/devices-virtual/producers/thermostats/native/{id}', {
				params: { path: { id } },
				signal,
			});
			if (response.status === 404) return null;
			return state(data?.data);
		},
		async create(name, source, signal) {
			const { data } = await backend.client.POST('/plugins/devices-virtual/producers/thermostats/native', {
				body: { name, source_device: source },
				signal,
			});
			return state(data?.data);
		},
		async request(id, revision, requestId, action, signal) {
			const { data } = await backend.client.POST('/plugins/devices-virtual/producers/thermostats/native/{id}/requests', {
				params: { path: { id } },
				body: {
					...action,
					mode: action.mode ? SpacesModuleClimateIntentMode[action.mode] : undefined,
					expected_revision: revision,
					request_id: requestId,
				},
				signal,
			});
			return state(data?.data);
		},
		async revalidate(id, revision, source, signal) {
			const { data } = await backend.client.PUT('/plugins/devices-virtual/producers/thermostats/native/{id}', {
				params: { path: { id } },
				body: { expected_revision: revision, source_device: source },
				signal,
			});
			return state(data?.data);
		},
		async release(id, revision, signal) {
			const { data } = await backend.client.POST('/plugins/devices-virtual/producers/thermostats/native/{id}/release', {
				params: { path: { id } },
				body: { expected_revision: revision },
				signal,
			});
			return state(data?.data);
		},
	};
}
