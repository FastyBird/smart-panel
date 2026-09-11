import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export type ObserverStage =
	| 'listener-ready'
	| 'subscription-acknowledged'
	| 'dispatch'
	| 'command-ack'
	| 'provider-receipt'
	| 'update-entry'
	| 'write-commit'
	| 'source-event'
	| 'projection-event';

export type TrialStatus = 'pending' | 'success' | 'timeout' | 'failure' | 'invalidated';

export type TrialScenario = 'idle' | 'poll-overlap';

export interface ObserverTargetConfig {
	deviceId: string;
	channelId: string;
	propertyId: string;
	projectionPropertyId?: string;
	expectedDataType?: string;
}

export interface ObserverTrialConfig {
	target: ObserverTargetConfig;
	commandValue: boolean | number | string;
	previousValue?: boolean | number | string | null;
	timeoutMs: number;
	correlationId?: string;
}

export interface PollActivitySnapshot {
	inFlightPolls: number;
	activeDrains: number;
	slotIndex?: number;
	rpcActive?: boolean;
}

export interface ObserverRecord {
	stage: ObserverStage;
	timestampMs: number;
	metadata?: Record<string, unknown>;
}

export interface StageSpans {
	commandToAckMs?: number;
	updateEntryToSourceMs?: number;
	sourceToProjectionMs?: number;
	commandToSourceMs?: number;
	totalConvergenceMs?: number;
}

export interface TrialResult {
	trialIndex: number;
	scenario: TrialScenario;
	status: TrialStatus;
	target: ObserverTargetConfig;
	commandValue: boolean | number | string;
	previousValue?: boolean | number | string | null;
	records: ObserverRecord[];
	spans: StageSpans;
	pollActivity?: PollActivitySnapshot;
	failureReason?: string;
	elapsedMs: number;
}

export interface AggregateStats {
	count: number;
	successCount: number;
	timeoutCount: number;
	failureCount: number;
	invalidatedCount: number;
	p50Ms: number | null;
	p95Ms: number | null;
	maxMs: number | null;
}

export interface SessionReport {
	observerHash: string;
	gitRevision?: string;
	startedAt: string;
	completedAt: string;
	idle: AggregateStats;
	pollOverlap: AggregateStats;
	overallPipelineGatePassed: boolean;
	trials: TrialResult[];
}

/**
 * Retained, reviewable measurement observer for property command convergence
 * and latency correlation under #1032 / #1052.
 */
export class CommandLatencyObserver {
	private readonly records: ObserverRecord[] = [];
	private status: TrialStatus = 'pending';
	private failureReason?: string;
	private pollActivity?: PollActivitySnapshot;
	private finalizedAtMs?: number;

	constructor(
		public readonly config: ObserverTrialConfig,
		public readonly trialIndex: number = 0,
		public readonly scenario: TrialScenario = 'idle',
	) {}

	static getSourceHash(): string {
		try {
			const content = readFileSync(__filename, 'utf8');
			return createHash('sha256').update(content).digest('hex');
		} catch {
			return createHash('sha256').update(CommandLatencyObserver.toString()).digest('hex');
		}
	}

	record(stage: ObserverStage, timestampMs: number, metadata?: Record<string, unknown>): void {
		if (this.status === 'timeout' || this.status === 'failure' || this.status === 'invalidated') {
			throw new Error(`Cannot record stage '${stage}' after trial has finalized with status '${this.status}'`);
		}

		const previous = this.records.at(-1);

		if (previous && timestampMs < previous.timestampMs) {
			throw new Error(
				`Observer timestamps must be monotonic: stage '${stage}' (${timestampMs}ms) < previous '${previous.stage}' (${previous.timestampMs}ms)`,
			);
		}

		if (stage === 'subscription-acknowledged' && !this.has('listener-ready')) {
			throw new Error('Subscription acknowledgement requires installed listeners');
		}

		if (stage === 'dispatch') {
			if (!this.has('listener-ready')) {
				throw new Error('Dispatch requires installed listeners');
			}
			if (!this.has('subscription-acknowledged')) {
				throw new Error('Dispatch requires an acknowledged exchange subscription');
			}
		}

		if (stage === 'command-ack' && !this.has('dispatch')) {
			throw new Error('Command acknowledgement requires prior dispatch');
		}

		if (stage === 'source-event' && !this.has('dispatch')) {
			throw new Error('Source event requires prior dispatch');
		}

		if (stage === 'projection-event' && !this.has('dispatch')) {
			throw new Error('Projection event requires prior dispatch');
		}

		this.records.push({ stage, timestampMs, metadata });

		// Check completion condition
		const hasSource = this.has('source-event');
		const expectsProjection = Boolean(this.config.target.projectionPropertyId);
		const hasProjection = this.has('projection-event');

		if (hasSource && (!expectsProjection || hasProjection)) {
			this.status = 'success';
		}
	}

	recordPollActivity(snapshot: PollActivitySnapshot): void {
		this.pollActivity = { ...snapshot };
	}

	recordReconnect(timestampMs: number, reason = 'Transport reconnected'): void {
		if (this.status === 'pending') {
			this.status = 'invalidated';
			this.finalizedAtMs = timestampMs;
			this.failureReason = reason;
			this.records.push({ stage: 'listener-ready', timestampMs, metadata: { invalidated: true, reason } });
		}
	}

	recordTimeout(timestampMs: number): void {
		if (this.status === 'pending') {
			this.status = 'timeout';
			this.finalizedAtMs = timestampMs;
			this.failureReason = `Timed out after ${this.config.timeoutMs}ms waiting for convergence`;
		}
	}

	recordFailure(timestampMs: number, reason: string): void {
		if (this.status === 'pending') {
			this.status = 'failure';
			this.finalizedAtMs = timestampMs;
			this.failureReason = reason;
		}
	}

	onPropertyEvent(
		propertyId: string,
		value: unknown,
		timestampMs: number,
		metadata?: Record<string, unknown>,
	): boolean {
		if (this.status !== 'pending') {
			return false;
		}

		// Check canonical source match
		if (propertyId === this.config.target.propertyId) {
			if (value === this.config.commandValue) {
				this.record('source-event', timestampMs, metadata);
				return true;
			}
			return false;
		}

		// Check virtual projection match
		if (this.config.target.projectionPropertyId && propertyId === this.config.target.projectionPropertyId) {
			if (value === this.config.commandValue) {
				this.record('projection-event', timestampMs, metadata);
				return true;
			}
			return false;
		}

		return false;
	}

	computeSpans(): StageSpans {
		const dispatch = this.findRecord('dispatch');
		const commandAck = this.findRecord('command-ack');
		const updateEntry = this.findRecord('update-entry');
		const sourceEvent = this.findRecord('source-event');
		const projectionEvent = this.findRecord('projection-event');

		const spans: StageSpans = {};

		if (dispatch && commandAck) {
			spans.commandToAckMs = commandAck.timestampMs - dispatch.timestampMs;
		}

		if (updateEntry && sourceEvent) {
			spans.updateEntryToSourceMs = sourceEvent.timestampMs - updateEntry.timestampMs;
		}

		if (sourceEvent && projectionEvent) {
			spans.sourceToProjectionMs = projectionEvent.timestampMs - sourceEvent.timestampMs;
		}

		if (dispatch && sourceEvent) {
			spans.commandToSourceMs = sourceEvent.timestampMs - dispatch.timestampMs;
		}

		const finalEvent = projectionEvent ?? sourceEvent;
		if (dispatch && finalEvent) {
			spans.totalConvergenceMs = finalEvent.timestampMs - dispatch.timestampMs;
		}

		return spans;
	}

	getResult(): TrialResult {
		const records = [...this.records];
		const first = records.at(0);
		const last = records.at(-1);
		const endTs = this.finalizedAtMs ?? last?.timestampMs ?? 0;
		const elapsedMs = first ? Math.max(0, endTs - first.timestampMs) : 0;

		return {
			trialIndex: this.trialIndex,
			scenario: this.scenario,
			status: this.status,
			target: this.config.target,
			commandValue: this.config.commandValue,
			previousValue: this.config.previousValue,
			records,
			spans: this.computeSpans(),
			pollActivity: this.pollActivity,
			failureReason: this.failureReason,
			elapsedMs,
		};
	}

	has(stage: ObserverStage): boolean {
		return this.records.some((record) => record.stage === stage);
	}

	private findRecord(stage: ObserverStage): ObserverRecord | undefined {
		return this.records.find((record) => record.stage === stage);
	}
}

/**
 * Calculates aggregate statistics (p50, p95, max) for an array of numbers.
 */
export function calculatePercentiles(values: number[]): { p50: number | null; p95: number | null; max: number | null } {
	if (values.length === 0) {
		return { p50: null, p95: null, max: null };
	}

	const sorted = [...values].sort((a, b) => a - b);
	const p50Index = Math.floor(sorted.length * 0.5);
	const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));

	return {
		p50: sorted[p50Index],
		p95: sorted[p95Index],
		max: sorted[sorted.length - 1],
	};
}

/**
 * Compiles a session report from an array of trial results.
 */
export function compileSessionReport(
	trials: TrialResult[],
	gitRevision?: string,
	startedAt = new Date().toISOString(),
	completedAt = new Date().toISOString(),
): SessionReport {
	const summarize = (scenarioTrials: TrialResult[]): AggregateStats => {
		const pipelineLatencies: number[] = [];

		let successCount = 0;
		let timeoutCount = 0;
		let failureCount = 0;
		let invalidatedCount = 0;

		for (const trial of scenarioTrials) {
			if (trial.status === 'success') {
				successCount++;
				if (trial.spans.updateEntryToSourceMs !== undefined) {
					pipelineLatencies.push(trial.spans.updateEntryToSourceMs);
				}
			} else if (trial.status === 'timeout') {
				timeoutCount++;
			} else if (trial.status === 'failure') {
				failureCount++;
			} else if (trial.status === 'invalidated') {
				invalidatedCount++;
			}
		}

		const { p50, p95, max } = calculatePercentiles(pipelineLatencies);

		return {
			count: scenarioTrials.length,
			successCount,
			timeoutCount,
			failureCount,
			invalidatedCount,
			p50Ms: p50,
			p95Ms: p95,
			maxMs: max,
		};
	};

	const idleTrials = trials.filter((trial) => trial.scenario === 'idle');
	const pollOverlapTrials = trials.filter((trial) => trial.scenario === 'poll-overlap');

	const idleStats = summarize(idleTrials);
	const pollOverlapStats = summarize(pollOverlapTrials);

	// Engineering gates:
	// 1. Write-pipeline p95 < 800ms
	// 2. No sample >= 3000ms
	// 3. No timeouts
	const p95Pass =
		(idleStats.p95Ms === null || idleStats.p95Ms < 800) &&
		(pollOverlapStats.p95Ms === null || pollOverlapStats.p95Ms < 800);
	const maxPass =
		(idleStats.maxMs === null || idleStats.maxMs < 3000) &&
		(pollOverlapStats.maxMs === null || pollOverlapStats.maxMs < 3000);
	const noTimeouts = idleStats.timeoutCount === 0 && pollOverlapStats.timeoutCount === 0;

	const overallPipelineGatePassed = p95Pass && maxPass && noTimeouts;

	return {
		observerHash: CommandLatencyObserver.getSourceHash(),
		gitRevision,
		startedAt,
		completedAt,
		idle: idleStats,
		pollOverlap: pollOverlapStats,
		overallPipelineGatePassed,
		trials,
	};
}
