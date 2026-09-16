import { createHash, randomUUID } from 'crypto';
import { mkdir, open, rename, stat, writeFile } from 'fs/promises';
import { dirname } from 'path';

import { Injectable, OnModuleDestroy } from '@nestjs/common';

type PollPlacementConfig = {
	schemaVersion: 1;
	runId: string;
	sourceDeviceId: string;
	exportPath: string;
	durationMs: number;
};

type DelegateObservation = {
	delegateId: string;
	sourceDeviceId?: string;
	connected: boolean;
	generation: number;
};

type CycleObservation = {
	cycleSequence: number;
	generation: number;
	intervalMs: number;
	anchorMonotonicMs: number;
	connectedDelegateCount: number;
	delegateOrderFingerprint: string;
	target: {
		delegateId: string | null;
		slotIndex: number | null;
		connected: boolean;
		generation: number | null;
		decision: 'dispatch-attempt' | 'skipped' | 'unresolved';
		skipReason?: string;
		delayMs: number | null;
		registrationBeforeMs: number | null;
		registrationAfterMs: number | null;
	};
};

type DiagnosticSnapshot = {
	schemaVersion: 1;
	runId: string;
	status: 'armed' | 'ready' | 'invalidated' | 'expired' | 'overflow' | 'writer-failure';
	reason?: string;
	configFingerprint: string;
	processInstanceId: string;
	processId: number;
	sourceDeviceId: string;
	observerRuntimeHash: string;
	backendClock: 'performance-now-v1';
	armedAtMonotonicMs: number;
	expiresAtMonotonicMs: number;
	sequence: number;
	observations: CycleObservation[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_DURATION_MS = 180_000;
const MAX_RECORDS = 64;
const MAX_BYTES = 256 * 1024;

@Injectable()
export class PollPlacementDiagnosticsService implements OnModuleDestroy {
	private readonly processInstanceId = randomUUID();
	private readonly observerRuntimeHash = createHash('sha256').update('poll-placement-diagnostics-v1').digest('hex');
	private readonly delegateObservations = new Map<string, DelegateObservation>();
	private readonly config: PollPlacementConfig | null;
	private snapshot: DiagnosticSnapshot | null = null;
	private writePending = false;
	private writeQueued = false;
	private destroyed = false;
	private cycleSequence = 0;

	constructor() {
		this.config = this.parseConfig(process.env.FB_SHELLY_POLL_PLACEMENT);
		if (this.config) {
			const now = this.now();
			this.snapshot = {
				schemaVersion: 1,
				runId: this.config.runId,
				status: 'armed',
				configFingerprint: createHash('sha256').update(JSON.stringify(this.config)).digest('hex'),
				processInstanceId: this.processInstanceId,
				processId: process.pid,
				sourceDeviceId: this.config.sourceDeviceId,
				observerRuntimeHash: this.observerRuntimeHash,
				backendClock: 'performance-now-v1',
				armedAtMonotonicMs: now,
				expiresAtMonotonicMs: now + this.config.durationMs,
				sequence: 0,
				observations: [],
			};
			void this.publish();
		}
	}

	onModuleDestroy(): void {
		this.destroyed = true;
		if (this.snapshot && (this.snapshot.status === 'armed' || this.snapshot.status === 'ready')) {
			this.snapshot.status = 'invalidated';
			this.snapshot.reason = 'process-shutdown';
			void this.publish();
		}
	}

	isEnabled(): boolean {
		return this.snapshot !== null && !this.destroyed;
	}

	observeDelegate(observation: DelegateObservation): void {
		if (!this.snapshot || this.destroyed) return;
		this.delegateObservations.set(observation.delegateId, observation);
	}

	invalidate(reason: string): void {
		if (!this.snapshot || this.snapshot.status === 'invalidated') return;
		this.snapshot.status = 'invalidated';
		this.snapshot.reason = reason;
		void this.publish();
	}

	observeCycle(generation: number, intervalMs: number, delegates: string[]): void {
		const snapshot = this.snapshot;
		if (!snapshot || this.destroyed || (snapshot.status !== 'armed' && snapshot.status !== 'ready')) return;
		if (this.now() >= snapshot.expiresAtMonotonicMs) {
			snapshot.status = 'expired';
			snapshot.reason = 'diagnostic-expired';
			void this.publish();
			return;
		}
		if (!Number.isInteger(generation) || !Number.isInteger(intervalMs) || intervalMs < 1 || delegates.length === 0)
			return;
		const ordered = delegates.slice();
		const targetMatches = ordered.filter(
			(id) => this.delegateObservations.get(id)?.sourceDeviceId === snapshot.sourceDeviceId,
		);
		const targetIndex = targetMatches.length === 1 ? ordered.indexOf(targetMatches[0]) : -1;
		const targetId = targetIndex >= 0 ? ordered[targetIndex] : null;
		const target = targetId ? this.delegateObservations.get(targetId) : undefined;
		const delayMs = targetId ? Math.floor((targetIndex * intervalMs) / ordered.length) : null;
		const before = this.now();
		const after = this.now();
		snapshot.observations.push({
			cycleSequence: ++this.cycleSequence,
			generation,
			intervalMs,
			anchorMonotonicMs: before,
			connectedDelegateCount: ordered.length,
			delegateOrderFingerprint: createHash('sha256').update(ordered.join('\n')).digest('hex'),
			target: {
				delegateId: targetId,
				slotIndex: targetId ? targetIndex : null,
				connected: target?.connected === true,
				generation: target?.generation ?? null,
				decision: 'unresolved',
				skipReason: targetId ? 'slot-pending' : 'target-unresolved',
				delayMs,
				registrationBeforeMs: before,
				registrationAfterMs: after,
			},
		});
		snapshot.sequence++;
		snapshot.status = 'ready';
		if (snapshot.observations.length > MAX_RECORDS || Buffer.byteLength(JSON.stringify(snapshot)) > MAX_BYTES) {
			snapshot.status = 'overflow';
			snapshot.reason = 'observation-bound-exceeded';
			snapshot.observations = snapshot.observations.slice(0, MAX_RECORDS);
		}
		void this.publish();
	}

	observeSlot(
		delegateId: string,
		generation: number,
		decision: 'dispatch-attempt' | 'skipped',
		skipReason?: string,
	): void {
		const snapshot = this.snapshot;
		if (!snapshot || this.destroyed || (snapshot.status !== 'armed' && snapshot.status !== 'ready')) return;
		if (this.now() >= snapshot.expiresAtMonotonicMs) {
			snapshot.status = 'expired';
			snapshot.reason = 'diagnostic-expired';
			void this.publish();
			return;
		}
		const observation = snapshot.observations.at(-1);
		if (!observation || observation.generation !== generation || observation.target.delegateId !== delegateId) return;
		observation.target.decision = decision;
		observation.target.skipReason = skipReason;
		snapshot.sequence++;
		void this.publish();
	}

	private parseConfig(raw: string | undefined): PollPlacementConfig | null {
		if (!raw) return null;
		try {
			if (Buffer.byteLength(raw, 'utf8') > 8192) return null;
			const value = JSON.parse(raw) as Record<string, unknown>;
			if (value.schemaVersion !== 1 || typeof value.runId !== 'string' || !UUID_RE.test(value.runId)) return null;
			if (typeof value.sourceDeviceId !== 'string' || !UUID_RE.test(value.sourceDeviceId)) return null;
			if (typeof value.exportPath !== 'string' || !value.exportPath.startsWith('/') || value.exportPath.includes('\0'))
				return null;
			const durationMs = value.durationMs === undefined ? 180_000 : value.durationMs;
			if (
				typeof durationMs !== 'number' ||
				!Number.isInteger(durationMs) ||
				durationMs < 1000 ||
				durationMs > MAX_DURATION_MS
			)
				return null;
			const allowed = new Set(['schemaVersion', 'runId', 'sourceDeviceId', 'exportPath', 'durationMs']);
			if (Object.keys(value).some((key) => !allowed.has(key))) return null;
			return {
				schemaVersion: 1,
				runId: value.runId,
				sourceDeviceId: value.sourceDeviceId,
				exportPath: value.exportPath,
				durationMs,
			};
		} catch {
			return null;
		}
	}

	private now(): number {
		return Number(process.hrtime.bigint()) / 1_000_000;
	}

	private async publish(): Promise<void> {
		if (!this.snapshot || !this.config) return;
		if (this.writePending) {
			this.writeQueued = true;
			return;
		}
		this.writePending = true;
		try {
			await mkdir(dirname(this.config.exportPath), { recursive: true, mode: 0o700 });
			const temporary = this.config.exportPath + '.tmp-' + process.pid + '-' + this.snapshot.sequence;
			const body = JSON.stringify(this.snapshot) + '\n';
			await writeFile(temporary, body, { mode: 0o600, flag: 'wx' });
			const handle = await open(temporary, 'r');
			try {
				await handle.sync();
			} catch (error) {
				try {
					await handle.close();
				} catch {
					// Preserve the original sync failure.
				}
				throw error;
			}
			await handle.close();
			await rename(temporary, this.config.exportPath);
			await stat(this.config.exportPath);
		} catch {
			if (this.snapshot) {
				this.snapshot.status = 'writer-failure';
				this.snapshot.reason = 'export-write-failed';
			}
		} finally {
			this.writePending = false;
			if (this.writeQueued) {
				this.writeQueued = false;
				void this.publish();
			}
		}
	}
}
