import type { useBackend } from '../../../common';
import type { components } from '../../../openapi';
import type { OpenApiPaths } from '../../../openapi.constants';

export type ComfortState = components['schemas']['DevicesVirtualPluginDataThermostatComfort'];
export type ComfortConfiguration = components['schemas']['DevicesVirtualPluginDataThermostatComfortConfiguration'];
export type ComfortDefinition = components['schemas']['DevicesVirtualPluginConfigureThermostatComfort'];
export type ComfortPreset = 'comfort' | 'eco' | 'away';
export type ComfortAction =
	| { kind: 'configure'; input: Omit<ComfortDefinition, 'expected_revision' | 'expected_graph_revision'> }
	| { kind: 'selection'; preset: ComfortPreset | null; clear_user_off: boolean }
	| {
			kind: 'override';
			preset: ComfortPreset | null;
			setpoints: { heating_setpoint: number | null; cooling_setpoint: number | null } | null;
			expires_at: string;
	  }
	| { kind: 'cancel'; override_id: string };
export interface ComfortSnapshot {
	comfort: ComfortState;
	configuration: components['schemas']['DevicesVirtualPluginDataThermostatConfiguration'];
	runtime: components['schemas']['DevicesVirtualPluginDataThermostatRuntime'];
}
export interface ComfortTransport {
	read(id: string, signal?: AbortSignal): Promise<ComfortSnapshot>;
	write(id: string, state: ComfortState, action: ComfortAction): Promise<void>;
}
const path = '/plugins/devices-virtual/producers/thermostats/{id}' as const;
const failure = (error: unknown) =>
	new Error(typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : 'Thermostat request failed');

export function thermostatComfortTransport(backend: ReturnType<typeof useBackend<OpenApiPaths>>): ComfortTransport {
	return {
		async read(id, signal) {
			const params = { path: { id } };
			const [comfort, configuration, runtime] = await Promise.all([
				backend.client.GET(`${path}/comfort`, { params, signal }),
				backend.client.GET(path, { params, signal }),
				backend.client.GET(`${path}/runtime`, { params, signal }),
			]);
			if (!comfort.data || !configuration.data || !runtime.data) throw failure(comfort.error ?? configuration.error ?? runtime.error);
			const revision = comfort.data.data.revision;
			if (configuration.data.data.revision !== revision || runtime.data.data.configuration_revision !== revision)
				throw new Error('revision_conflict');
			return { comfort: comfort.data.data, configuration: configuration.data.data, runtime: runtime.data.data };
		},
		async write(id, state, action) {
			const params = { path: { id } };
			const fence = { expected_revision: state.revision, expected_graph_revision: state.graph_revision };
			let result;
			switch (action.kind) {
				case 'configure':
					result = await backend.client.PUT(`${path}/comfort`, { params, body: { ...action.input, ...fence } });
					break;
				case 'selection':
					result = await backend.client.POST(`${path}/comfort/selection`, {
						params,
						body: {
							...fence,
							preset: action.preset,
							clear_user_off: action.clear_user_off,
						} as components['schemas']['DevicesVirtualPluginSelectThermostatPreset'],
					});
					break;
				case 'override':
					result = await backend.client.POST(`${path}/comfort/override`, {
						params,
						body: {
							...fence,
							preset: action.preset,
							setpoints: action.setpoints,
							expires_at: action.expires_at,
						} as components['schemas']['DevicesVirtualPluginCreateThermostatOverride'],
					});
					break;
				case 'cancel':
					result = await backend.client.POST(`${path}/comfort/override/cancel`, { params, body: { ...fence, override_id: action.override_id } });
					break;
			}
			if (!result.data) throw failure(result.error);
		},
	};
}

/** Completeness only. Backend capability, range and deadband validation remains authoritative. */
export const finiteTemperature = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export const remainingOverrideSeconds = (expiry: string | null | undefined, now: number): number | null => {
	const end = expiry ? Date.parse(expiry) : NaN;
	return Number.isFinite(end) ? Math.max(0, Math.ceil((end - now) / 1000)) : null;
};
