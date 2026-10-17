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

/** Current display observation only. Missing old-server fields and retained OFF proof cannot establish freshness. */
export function memberObservation(member: ThermostatMemberRuntime | null, receivedAt: number, now: number) {
	const sampledAt = member?.activity_sampled_at ? Date.parse(member.activity_sampled_at) : NaN;
	const expiresAt = member?.activity_expires_at ? Date.parse(member.activity_expires_at) : NaN;
	const fresh =
		!!member &&
		['on', 'off'].includes(member.activity) &&
		Number.isFinite(sampledAt) &&
		Number.isFinite(expiresAt) &&
		now >= receivedAt &&
		now >= sampledAt &&
		expiresAt > sampledAt &&
		now < expiresAt;
	return {
		activity: fresh ? member.activity : 'unknown',
		qualification: fresh ? (member.qualification_ready ?? null) : null,
		sampledAt: fresh ? member.activity_sampled_at : null,
		expiresAt: fresh ? member.activity_expires_at : null,
	};
}

interface SampleFence {
	sampledAt: number;
	expiresAt: number;
	deadline: number;
	withdrawn: boolean;
}

/** Editor-owned, bounded evidence memory. Loading and cached refetches never reset sample validity. */
export class ThermostatMemberFreshness {
	private readonly claims = new Map<string, Partial<Record<'activity' | 'protection', SampleFence>>>();

	constructor(private readonly monotonicNow: () => number = () => performance.now()) {}

	get size(): number {
		return this.claims.size;
	}

	retain(claims: Iterable<string>): void {
		const retained = new Set(claims);
		for (const claim of this.claims.keys()) if (!retained.has(claim)) this.claims.delete(claim);
	}

	clear(): void {
		this.claims.clear();
	}

	expire(now: number): void {
		for (const fields of this.claims.values())
			for (const field of Object.values(fields)) if (now >= field.expiresAt || this.monotonicNow() >= field.deadline) field.withdrawn = true;
	}

	private accepts(claim: string, field: 'activity' | 'protection', sampledAt: number, expiresAt: number, valid: boolean, now: number): boolean {
		this.expire(now);
		if (!Number.isFinite(sampledAt)) return false;
		let fields = this.claims.get(claim);
		if (!fields) {
			// Two authoritative snapshots may temporarily overlap, each with at most eight mandatory claims.
			if (this.claims.size >= 16) return false;
			fields = {};
			this.claims.set(claim, fields);
		}
		let fence = fields[field];
		if (fence && sampledAt < fence.sampledAt) return false;
		if (!fence || sampledAt > fence.sampledAt) {
			fence = { sampledAt, expiresAt, deadline: this.monotonicNow() + Math.max(0, expiresAt - now), withdrawn: false };
			fields[field] = fence;
		}
		// Equal-timestamp refetches cannot extend the original lifetime or reverse withdrawal.
		if (!valid || now < sampledAt || !Number.isFinite(expiresAt) || expiresAt <= sampledAt || now >= fence.expiresAt) fence.withdrawn = true;
		return !fence.withdrawn;
	}

	observation(claim: string, member: ThermostatMemberRuntime | null, receivedAt: number, now: number) {
		const result = memberObservation(member, receivedAt, now);
		const accepted = this.accepts(
			claim,
			'activity',
			Date.parse(member?.activity_sampled_at ?? ''),
			Date.parse(member?.activity_expires_at ?? ''),
			result.activity !== 'unknown',
			now
		);
		return accepted ? result : { activity: 'unknown', qualification: null, sampledAt: null, expiresAt: null };
	}

	reading(claim: string, member: ThermostatMemberRuntime | null, receivedAt: number, now: number) {
		const result = memberReading(member, receivedAt, now);
		const accepted = this.accepts(
			claim,
			'protection',
			Date.parse(member?.protection?.sampled_at ?? ''),
			Date.parse(member?.protection?.expires_at ?? ''),
			result.status === 'fresh' && result.temperature !== null,
			now
		);
		return accepted ? result : { ...result, temperature: null, ready: false, status: result.status === 'fresh' ? 'stale' : result.status };
	}
}
