import { createHash, randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import type { Stats } from 'fs';
import { FileHandle, link, lstat, mkdir, open, rename, unlink, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { performance } from 'perf_hooks';

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
	anchorUtc: string;
	connectedDelegateCount: number;
	delegateOrderFingerprint: string;
	activePollCount: number;
	concurrencyCap: number;
	targetInFlight: boolean;
	schedulerState: 'starting' | 'started';
	target: {
		delegateId: string | null;
		slotIndex: number | null;
		connected: boolean;
		generation: number | null;
		decision: 'dispatch-attempt' | 'skipped' | 'unresolved';
		skipReason?: string;
		delayMs: number | null;
		registrationBeforeMs: number;
		registrationBeforeUtc: string;
		registrationAfterMs: number | null;
		registrationAfterUtc: string | null;
	};
};

type DiagnosticSnapshot = {
	schemaVersion: 1;
	runId: string;
	status: 'armed' | 'ready' | 'invalidated' | 'expired' | 'overflow' | 'writer-failure';
	reason?: string;
	candidateStatus: 'valid' | 'invalidated';
	candidateReason?: string;
	configFingerprint: string;
	processInstanceId: string;
	processId: number;
	sourceDeviceId: string;
	observerRuntimeHash: string;
	backendClock: 'performance-now-v1';
	armedAtMonotonicMs: number;
	armedAtUtc: string;
	expiresAtMonotonicMs: number;
	sequence: number;
	observations: CycleObservation[];
};

type OwnerRecord = {
	schemaVersion: 1;
	runId: string;
	processInstanceId: string;
	processId: number;
	configFingerprint: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_DURATION_MS = 180_000;
const MAX_DURATION_MS = 360_000;
const MAX_RECORDS = 64;
const MAX_BYTES = 256 * 1024;
const OWNER_SUFFIX = '.owner.json';

class ExportOwnershipError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ExportOwnershipError';
	}
}

@Injectable()
export class PollPlacementDiagnosticsService implements OnModuleDestroy {
	private readonly processInstanceId = randomUUID();
	private readonly observerRuntimeHash = this.computeRuntimeHash();
	private readonly delegateObservations = new Map<string, DelegateObservation>();
	private readonly config: PollPlacementConfig | null;
	private readonly ownerPath: string | null;
	private snapshot: DiagnosticSnapshot | null = null;
	private writePending = false;
	private publishRequested = false;
	private writePromise: Promise<void> | null = null;
	private destroyed = false;
	private ownershipAcquired = false;
	private expiryTimer: NodeJS.Timeout | null = null;
	private cycleSequence = 0;

	constructor() {
		this.config = this.parseConfig(process.env.FB_SHELLY_POLL_PLACEMENT);
		this.ownerPath = this.config ? this.config.exportPath + OWNER_SUFFIX : null;
		if (this.config) {
			const now = this.now();
			const nowUtc = this.utcNow();
			this.snapshot = {
				schemaVersion: 1,
				runId: this.config.runId,
				status: 'armed',
				candidateStatus: 'invalidated',
				candidateReason: 'awaiting-cycle',
				configFingerprint: createHash('sha256').update(JSON.stringify(this.config)).digest('hex'),
				processInstanceId: this.processInstanceId,
				processId: process.pid,
				sourceDeviceId: this.config.sourceDeviceId,
				observerRuntimeHash: this.observerRuntimeHash,
				backendClock: 'performance-now-v1',
				armedAtMonotonicMs: now,
				armedAtUtc: nowUtc,
				expiresAtMonotonicMs: now + this.config.durationMs,
				sequence: 0,
				observations: [],
			};
			this.expiryTimer = setTimeout(() => this.expireIfNeeded(), this.config.durationMs);
			this.expiryTimer.unref?.();
			void this.publish();
		}
	}

	async onModuleDestroy(): Promise<void> {
		if (this.expiryTimer) {
			clearTimeout(this.expiryTimer);
			this.expiryTimer = null;
		}
		if (this.snapshot && this.isActive()) {
			this.snapshot.status = 'invalidated';
			this.snapshot.reason = 'process-shutdown';
			await this.publish();
		} else {
			const pending = this.writePromise;
			if (pending !== null) await pending;
		}
		this.destroyed = true;
	}

	isEnabled(): boolean {
		this.expireIfNeeded();
		return this.snapshot !== null && !this.destroyed && this.isActive();
	}

	observeDelegate(observation: DelegateObservation): void {
		if (!this.snapshot || this.destroyed || !this.isActive()) return;
		const previous = this.delegateObservations.get(observation.delegateId);
		this.delegateObservations.set(observation.delegateId, observation);
		if (
			previous &&
			(previous.sourceDeviceId === this.snapshot.sourceDeviceId ||
				observation.sourceDeviceId === this.snapshot.sourceDeviceId) &&
			(previous.sourceDeviceId !== observation.sourceDeviceId ||
				previous.generation !== observation.generation ||
				observation.connected !== true)
		) {
			this.invalidateCandidate('target-delegate-changed');
		}
	}

	removeDelegate(delegateId: string): void {
		const previous = this.delegateObservations.get(delegateId);
		this.delegateObservations.delete(delegateId);
		if (previous?.sourceDeviceId === this.snapshot?.sourceDeviceId) this.invalidateCandidate('target-delegate-removed');
	}

	invalidate(reason: string): void {
		if (!this.snapshot || this.destroyed || !this.isActive()) return;
		this.snapshot.status = 'invalidated';
		this.snapshot.reason = reason;
		void this.publish();
	}

	private invalidateCandidate(reason: string): void {
		if (!this.snapshot || this.destroyed || !this.isActive()) return;
		this.snapshot.candidateStatus = 'invalidated';
		this.snapshot.candidateReason = reason;
		this.snapshot.sequence++;
		void this.publish();
	}

	observeCycle(
		generation: number,
		intervalMs: number,
		delegates: string[],
		activePollCount = 0,
		concurrencyCap = 10,
		inFlightDelegates: readonly string[] = [],
		schedulerState: 'starting' | 'started' = 'started',
	): number | null {
		const snapshot = this.snapshot;
		if (!snapshot || this.destroyed || !this.isActive()) return null;
		if (!Number.isInteger(generation) || !Number.isInteger(intervalMs) || intervalMs < 1 || delegates.length === 0) {
			return null;
		}
		const cycleEntryMonotonicMs = this.now();
		const cycleEntryUtc = this.utcNow();
		const registrationBeforeMs = this.now();
		const registrationBeforeUtc = this.utcNow();
		const ordered = delegates.slice();
		const targetMatches = ordered.filter((id) => {
			const delegate = this.delegateObservations.get(id);
			return delegate?.sourceDeviceId === snapshot.sourceDeviceId && delegate.connected === true;
		});
		const targetIndex = targetMatches.length === 1 ? ordered.indexOf(targetMatches[0]) : -1;
		const targetId = targetIndex >= 0 ? ordered[targetIndex] : null;
		const target = targetId ? this.delegateObservations.get(targetId) : undefined;
		const cycleSequence = ++this.cycleSequence;
		snapshot.candidateStatus = targetId === null ? 'invalidated' : 'valid';
		snapshot.candidateReason = targetId === null ? 'target-unresolved' : undefined;
		snapshot.observations.push({
			cycleSequence,
			generation,
			intervalMs,
			anchorMonotonicMs: cycleEntryMonotonicMs,
			anchorUtc: cycleEntryUtc,
			connectedDelegateCount: ordered.length,
			delegateOrderFingerprint: createHash('sha256').update(ordered.join('\n')).digest('hex'),
			activePollCount,
			concurrencyCap,
			targetInFlight: targetId !== null && inFlightDelegates.includes(targetId),
			schedulerState,
			target: {
				delegateId: targetId,
				slotIndex: targetId ? targetIndex : null,
				connected: target?.connected === true,
				generation: target?.generation ?? null,
				decision: 'unresolved',
				skipReason: targetId ? 'slot-pending' : 'target-unresolved',
				delayMs: targetId ? Math.floor((targetIndex * intervalMs) / ordered.length) : null,
				registrationBeforeMs,
				registrationBeforeUtc,
				registrationAfterMs: null,
				registrationAfterUtc: null,
			},
		});
		snapshot.sequence++;
		snapshot.status = 'ready';
		this.enforceBounds();
		void this.publish();
		return cycleSequence;
	}

	completeCycleRegistration(cycleSequence: number): void {
		const snapshot = this.snapshot;
		if (!snapshot || this.destroyed || !this.isActive()) return;
		const observation = snapshot.observations.find((candidate) => candidate.cycleSequence === cycleSequence);
		if (!observation) return;
		observation.target.registrationAfterMs = this.now();
		observation.target.registrationAfterUtc = this.utcNow();
		snapshot.sequence++;
		void this.publish();
	}

	observeSlot(
		delegateId: string,
		generation: number,
		cycleSequence: number,
		decision: 'dispatch-attempt' | 'skipped',
		skipReason?: string,
	): void {
		const snapshot = this.snapshot;
		if (!snapshot || this.destroyed || !this.isActive()) return;
		const observation = snapshot.observations.find((candidate) => candidate.cycleSequence === cycleSequence);
		if (!observation || observation.generation !== generation || observation.target.delegateId !== delegateId) return;
		observation.target.decision = decision;
		observation.target.skipReason = skipReason;
		snapshot.sequence++;
		void this.publish();
	}

	private isActive(): boolean {
		return this.snapshot?.status === 'armed' || this.snapshot?.status === 'ready';
	}

	private expireIfNeeded(): void {
		if (!this.snapshot || this.destroyed || !this.isActive() || this.now() < this.snapshot.expiresAtMonotonicMs) return;
		this.snapshot.status = 'expired';
		this.snapshot.reason = 'diagnostic-expired';
		void this.publish();
	}

	private enforceBounds(): void {
		if (!this.snapshot) return;
		if (
			this.snapshot.observations.length <= MAX_RECORDS &&
			Buffer.byteLength(JSON.stringify(this.snapshot)) <= MAX_BYTES
		)
			return;
		this.snapshot.status = 'overflow';
		this.snapshot.reason = 'observation-bound-exceeded';
		this.snapshot.observations = this.snapshot.observations.slice(0, MAX_RECORDS);
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
			const durationMs = value.durationMs === undefined ? DEFAULT_DURATION_MS : value.durationMs;
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

	private computeRuntimeHash(): string {
		try {
			return createHash('sha256').update(readFileSync(__filename)).digest('hex');
		} catch {
			return createHash('sha256').update(__filename).digest('hex');
		}
	}

	private now(): number {
		return performance.now();
	}

	private utcNow(): string {
		return new Date().toISOString();
	}

	private ownerRecord(): OwnerRecord {
		return {
			schemaVersion: 1,
			runId: this.snapshot.runId,
			processInstanceId: this.processInstanceId,
			processId: process.pid,
			configFingerprint: this.snapshot.configFingerprint,
		};
	}

	private async acquireOwnership(): Promise<void> {
		if (this.ownershipAcquired) return;
		if (!this.config || !this.ownerPath || !this.snapshot) throw new ExportOwnershipError('diagnostic is disabled');
		const directory = dirname(this.config.exportPath);
		await mkdir(directory, { recursive: true, mode: 0o700 });
		const directoryStat = await lstat(directory);
		if (!directoryStat.isDirectory()) throw new ExportOwnershipError('export parent is not a directory');
		if ((directoryStat.mode & 0o077) !== 0) throw new ExportOwnershipError('export parent is not owner-only');
		const existingOutput = await this.lstatIfExists(this.config.exportPath);
		if (existingOutput?.isSymbolicLink()) throw new ExportOwnershipError('export output is a symlink');
		if (existingOutput) throw new ExportOwnershipError('export output already exists');
		let ownerHandle: FileHandle;
		try {
			ownerHandle = await open(this.ownerPath, 'wx', 0o600);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
				throw new ExportOwnershipError('owner record already exists');
			}
			throw error;
		}
		try {
			await ownerHandle.writeFile(`${JSON.stringify(this.ownerRecord())}\n`);
			await ownerHandle.sync();
		} finally {
			await ownerHandle.close();
		}
		await this.syncDirectory(directory);
		this.ownershipAcquired = true;
	}

	private async assertOwnership(requireOutput: boolean): Promise<void> {
		if (!this.config || !this.ownerPath || !this.snapshot || !this.ownershipAcquired)
			throw new ExportOwnershipError('export ownership is not acquired');
		const directoryStat = await lstat(dirname(this.config.exportPath));
		if (!directoryStat.isDirectory()) throw new ExportOwnershipError('export parent is not a directory');
		if ((directoryStat.mode & 0o077) !== 0) throw new ExportOwnershipError('export parent is not owner-only');
		const ownerStat = await lstat(this.ownerPath);
		if (ownerStat.isSymbolicLink()) throw new ExportOwnershipError('owner record is a symlink');
		if ((ownerStat.mode & 0o177) !== 0) throw new ExportOwnershipError('owner record is not owner-only');
		const ownerHandle = await open(this.ownerPath, 'r');
		let owner: OwnerRecord;
		try {
			owner = JSON.parse(await ownerHandle.readFile('utf8')) as OwnerRecord;
		} finally {
			await ownerHandle.close();
		}
		if (JSON.stringify(owner) !== JSON.stringify(this.ownerRecord()))
			throw new ExportOwnershipError('export ownership changed');
		const outputStat = await this.lstatIfExists(this.config.exportPath);
		if (!outputStat) {
			if (requireOutput) throw new ExportOwnershipError('export output is missing');
			return;
		}
		if (outputStat.isSymbolicLink()) throw new ExportOwnershipError('export output is a symlink');
		if ((outputStat.mode & 0o177) !== 0) throw new ExportOwnershipError('export output is not owner-only');
		const outputHandle = await open(this.config.exportPath, 'r');
		let current: DiagnosticSnapshot;
		try {
			current = JSON.parse(await outputHandle.readFile('utf8')) as DiagnosticSnapshot;
		} finally {
			await outputHandle.close();
		}
		const expected = this.ownerRecord();
		if (
			current.runId !== expected.runId ||
			current.processInstanceId !== expected.processInstanceId ||
			current.configFingerprint !== expected.configFingerprint
		) {
			throw new ExportOwnershipError('export output belongs to another session');
		}
	}

	private async syncDirectory(directory: string): Promise<void> {
		const handle = await open(directory, 'r');
		try {
			await handle.sync();
		} finally {
			await handle.close();
		}
	}

	private async lstatIfExists(path: string): Promise<Stats | null> {
		try {
			return await lstat(path);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
			throw error;
		}
	}

	private publish(): Promise<void> {
		if (!this.snapshot || !this.config) return Promise.resolve();
		this.publishRequested = true;
		if (this.writePending) return this.writePromise ?? Promise.resolve();
		this.writePending = true;
		this.writePromise = this.flushPublish();
		return this.writePromise;
	}

	private async flushPublish(): Promise<void> {
		try {
			do {
				this.publishRequested = false;
				await this.writeSnapshot();
			} while (this.publishRequested && this.snapshot?.status !== 'writer-failure');
		} finally {
			this.writePending = false;
			this.writePromise = null;
		}
	}

	private async writeSnapshot(): Promise<void> {
		if (!this.snapshot || !this.config) return;
		let temporary: string | null = null;
		let temporaryCreated = false;
		try {
			await this.acquireOwnership();
			await this.assertOwnership(false);
			temporary = this.config.exportPath + '.tmp-' + process.pid + '-' + this.snapshot.sequence;
			await writeFile(temporary, JSON.stringify(this.snapshot) + '\n', { mode: 0o600, flag: 'wx' });
			temporaryCreated = true;
			const handle = await open(temporary, 'r');
			try {
				await handle.sync();
			} finally {
				await handle.close();
			}
			const outputExists = (await this.lstatIfExists(this.config.exportPath)) !== null;
			if (outputExists) {
				await this.assertOwnership(true);
				await rename(temporary, this.config.exportPath);
				temporaryCreated = false;
			} else {
				await link(temporary, this.config.exportPath);
				await unlink(temporary);
				temporaryCreated = false;
			}
			await this.syncDirectory(dirname(this.config.exportPath));
			await this.assertOwnership(true);
		} catch (error) {
			if (temporaryCreated && temporary !== null) await unlink(temporary).catch(() => undefined);
			if (this.snapshot) {
				this.snapshot.status = 'writer-failure';
				this.snapshot.reason =
					error instanceof ExportOwnershipError ? 'export-ownership-failed' : 'export-write-failed';
			}
		}
	}
}
