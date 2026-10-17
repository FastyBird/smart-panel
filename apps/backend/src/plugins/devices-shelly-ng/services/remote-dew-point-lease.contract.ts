import { performance } from 'node:perf_hooks';

export const REMOTE_DEW_POINT_PROFILE = 'shelly-ng.remote-dew-point-lease' as const;
export const REMOTE_DEW_POINT_PROTOCOL = 'sp-remote-dew-point-lease-1' as const;
export interface RemoteDewPointPacket {
	protocol: typeof REMOTE_DEW_POINT_PROTOCOL;
	artifact: string;
	epoch: number;
	sequence: number;
	requestId: string;
	controllerRevision: number;
	protectionFingerprint: string;
	action: 'threshold' | 'on' | 'off';
	thresholdC: number;
	untilDeviceUptimeMs: number;
}
export interface RemoteDewPointStatus {
	protocol: typeof REMOTE_DEW_POINT_PROTOCOL;
	artifact: string;
	deviceId: string;
	model: string;
	firmware: string;
	auth_en: true;
	epoch: number;
	sessionId: string;
	uptimeMs: number;
	ready: boolean;
	output: boolean;
	pendingOn: boolean;
	sequence: number;
	drained?: boolean;
	requestId?: string | null;
}
/** Installed measured budgets, all explicit milliseconds. No blanket qualified boolean. */
export interface RemoteDewPointTiming {
	transportMs: number;
	statusMs: number;
	clockMs: number;
	driftMs: number;
	dispatchMs: number;
	minimumLifetimeMs: number;
	maximumLeaseMs: number;
}

/** Capture ONCE. Wall rollback, delayed ACKs and retries cannot extend this packet's evidence. */
export class RemoteDewPointDeadline {
	private readonly monotonicDeadline: number;
	constructor(
		readonly expiresAt: number,
		private readonly wall = Date.now,
		private readonly monotonic = () => performance.now(),
	) {
		const remaining = Number.isFinite(expiresAt) ? expiresAt - wall() : 0;
		this.monotonicDeadline = monotonic() + (Number.isFinite(remaining) && remaining > 0 ? remaining : 0);
	}
	remaining(): number {
		return Math.max(0, Math.min(this.monotonicDeadline - this.monotonic(), this.expiresAt - this.wall()));
	}
	deviceExpiry(status: RemoteDewPointStatus, timing: RemoteDewPointTiming): number | null {
		if (
			!Object.values(timing).every((n) => Number.isFinite(n) && n >= 0) ||
			timing.minimumLifetimeMs <= 0 ||
			timing.maximumLeaseMs <= timing.minimumLifetimeMs ||
			timing.maximumLeaseMs > 60000 ||
			!Number.isFinite(status.uptimeMs) ||
			status.uptimeMs < 0
		)
			return null;
		const budget = timing.transportMs + timing.statusMs + timing.clockMs + timing.driftMs + timing.dispatchMs;
		const remaining = Math.min(timing.maximumLeaseMs, this.remaining() - budget);
		return remaining >= timing.minimumLifetimeMs ? status.uptimeMs + remaining : null;
	}
}
