import type { components } from '../../../openapi';

export type ThermostatMemberContext = components['schemas']['DevicesVirtualPluginDataThermostatAuthoringContext'];
export type ThermostatMemberRuntime = components['schemas']['DevicesVirtualPluginDataThermostatBranchRuntime'];
export type ThermostatInstallation = components['schemas']['DevicesVirtualPluginDataThermostatInstallation'];
export type ThermostatStageRequest = components['schemas']['DevicesVirtualPluginStageThermostatInstallation'];

/** Expiry is based on original observation evidence; metadata, ACKs and retained readings cannot renew it. */
export function memberReading(member: ThermostatMemberRuntime | null, receivedAt: number, now: number) {
	const protection = member?.protection;
	if (!protection) return { temperature: null, status: 'unavailable', age: null, ready: false };
	const elapsed = Math.max(0, (now - receivedAt) / 1000);
	const age = protection.age_seconds === null ? null : protection.age_seconds + elapsed;
	const expiry = protection.expires_at ? Date.parse(protection.expires_at) : NaN;
	const fresh =
		now >= receivedAt &&
		protection.status === 'fresh' &&
		protection.quality === 'good' &&
		Number.isFinite(expiry) &&
		now < expiry &&
		age !== null &&
		protection.maximum_age_seconds !== null &&
		age < protection.maximum_age_seconds;
	return {
		temperature: fresh ? protection.temperature : null,
		status: fresh ? protection.status : protection.status === 'fresh' ? 'stale' : protection.status,
		age,
		ready: fresh && protection.ready === true,
	};
}
