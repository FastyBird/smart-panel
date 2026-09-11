import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';

import { ChannelPropertyEntity } from '../entities/devices.entity';
import { type PropertyCommandValue } from '../utils/property-command-value.utils';

/**
 * This diagnostic is deliberately opt-in. It is armed only by a private process configuration on
 * a validation candidate, never through an HTTP/WebSocket contract or persistent application
 * configuration. A capture is limited to one canonical source (and its requested projection).
 */
export interface CommandLatencyTraceConfig {
	readonly runId: string;
	readonly sourcePropertyId: string;
	readonly projectionPropertyId?: string;
	readonly sourceDeviceId?: string;
	/** Private validation-host path; never returned through an application API. */
	readonly exportPath?: string;
	readonly captureDurationMs?: number;
	readonly maxRecords?: number;
}

export const COMMAND_LATENCY_TRACE_OPTIONS = Symbol('COMMAND_LATENCY_TRACE_OPTIONS');

export type CommandLatencyTraceStage =
	| 'command-received'
	| 'window-bound'
	| 'provider-receipt'
	| 'poll-rpc-start'
	| 'poll-rpc-complete'
	| 'poll-coalescer-admission'
	| 'poll-drain'
	| 'update-entry'
	| 'write-complete'
	| 'source-publication'
	| 'suppressed'
	| 'update-complete'
	| 'update-error';

export type CommandLatencyTraceStatus = 'complete' | 'suppressed' | 'error' | 'expired' | 'overflow' | 'shutdown';

export interface CommandLatencyTraceRecord {
	readonly stage: CommandLatencyTraceStage;
	readonly timestampMs: number;
	readonly processId: number;
	readonly runId: string;
	readonly trialId: string;
	readonly invocationId?: string;
	readonly sourcePropertyId: string;
	readonly projectionPropertyId?: string;
	readonly commandValue: PropertyCommandValue;
	readonly intentId?: string;
	readonly windowGeneration?: string;
	readonly metadata?: Record<string, unknown>;
}

export interface CommandLatencyTraceCapture {
	readonly schemaVersion: 1;
	readonly clock: 'backend-performance-now-v1';
	readonly collectorHash: string;
	readonly processId: number;
	readonly runId: string;
	readonly trialId: string;
	readonly invocationId?: string;
	readonly sourcePropertyId: string;
	readonly projectionPropertyId?: string;
	readonly commandValue: PropertyCommandValue;
	readonly intentId?: string;
	readonly windowGeneration?: string;
	readonly status: CommandLatencyTraceStatus;
	readonly failureReason?: string;
	readonly records: readonly CommandLatencyTraceRecord[];
}

export interface CommandLatencyTraceCommand {
	readonly requestId?: string;
	readonly intentId: string;
	readonly properties: readonly {
		readonly property: string;
		readonly value: PropertyCommandValue;
	}[];
}

interface ActiveTrial {
	readonly trialId: string;
	readonly intentId: string;
	readonly requestedPropertyId: string;
	readonly commandValue: PropertyCommandValue;
	readonly startedAtMs: number;
	readonly expiryTimer: NodeJS.Timeout;
	/** Unassigned receipt/poll records are transferred to exactly one subsequent invocation capture. */
	readonly pendingRecords: CommandLatencyTraceRecord[];
	windowGeneration?: string;
	completed: boolean;
	activeInvocationCount: number;
}

interface TraceInvocation {
	readonly invocationId: string;
	readonly trial: ActiveTrial;
	readonly records: CommandLatencyTraceRecord[];
	status: 'pending' | 'suppressed' | 'error';
	failureReason?: string;
}

const MAX_CAPTURE_DURATION_MS = 30_000;
const MAX_CAPTURE_RECORDS = 4_096;

/**
 * A bounded, in-process server clock collector used only for the #1032 RPi validation run.
 *
 * The collector does not perform I/O, log, acquire locks, or await from a production path. Its
 * immutable captures are read by the live validation adapter after a trial settles. The caller
 * joins them with client observations afterwards; server timestamps are never inserted into the
 * client observer's monotonic stream.
 */
@Injectable()
export class CommandLatencyTraceCollectorService implements OnModuleDestroy {
	private readonly config:
		| (Required<Pick<CommandLatencyTraceConfig, 'captureDurationMs' | 'maxRecords'>> & CommandLatencyTraceConfig)
		| null;
	private readonly context = new AsyncLocalStorage<TraceInvocation>();
	private readonly trialsByIntent = new Map<string, ActiveTrial>();
	private readonly trialsByGeneration = new Map<string, ActiveTrial>();
	private readonly captures: CommandLatencyTraceCapture[] = [];
	private readonly pendingExports = new Set<CommandLatencyTraceCapture>();
	private readonly exportTasks = new Set<Promise<void>>();
	private readonly collectorHash: string;
	private recordCount = 0;
	private overflowed = false;

	constructor(
		@Optional()
		@Inject(COMMAND_LATENCY_TRACE_OPTIONS)
		options?: CommandLatencyTraceConfig | null,
	) {
		this.config = normalizeConfig(options ?? parseEnvironmentConfig());
		this.collectorHash = CommandLatencyTraceCollectorService.getSourceHash();
	}

	static getSourceHash(): string {
		try {
			return createHash('sha256').update(readFileSync(__filename, 'utf8')).digest('hex');
		} catch {
			return createHash('sha256').update(CommandLatencyTraceCollectorService.toString()).digest('hex');
		}
	}

	isEnabled(): boolean {
		return this.config !== null && !this.overflowed;
	}

	/** Starts a trial only for an existing, explicitly-correlated WebSocket command request id. */
	observeCommand(command: CommandLatencyTraceCommand): void {
		if (!this.isEnabled() || !command.requestId || this.config === null) {
			return;
		}

		this.expireDueTrials();

		const matching = command.properties.filter(
			(property) =>
				property.property === this.config.sourcePropertyId || property.property === this.config.projectionPropertyId,
		);

		if (matching.length !== 1) {
			return;
		}

		const selected = matching[0];
		if (selected === undefined || this.trialsByIntent.has(command.intentId)) {
			return;
		}

		const startedAtMs = this.now();
		const expiryTimer = setTimeout(() => this.expireTrial(command.intentId), this.config.captureDurationMs);
		expiryTimer.unref();

		const trial: ActiveTrial = {
			trialId: command.requestId,
			intentId: command.intentId,
			requestedPropertyId: selected.property,
			commandValue: selected.value,
			startedAtMs,
			expiryTimer,
			pendingRecords: [],
			completed: false,
			activeInvocationCount: 0,
		};

		this.trialsByIntent.set(trial.intentId, trial);
		this.recordTrial(trial, 'command-received', undefined, { requestedPropertyId: selected.property });
	}

	/** Associates a pre-existing command-window generation with the private validation trial. */
	bindWindow(intentId: string | undefined, sourcePropertyId: string, windowGeneration: string): void {
		if (!this.isEnabled() || !intentId || this.config === null || sourcePropertyId !== this.config.sourcePropertyId) {
			return;
		}

		this.expireDueTrials();
		const trial = this.trialsByIntent.get(intentId);
		if (trial === undefined || trial.completed) {
			return;
		}

		if (trial.windowGeneration !== undefined && trial.windowGeneration !== windowGeneration) {
			this.finishTrial(trial, 'error', 'A validation trial was bound to more than one command-window generation.');
			return;
		}

		const colliding = this.trialsByGeneration.get(windowGeneration);
		if (colliding !== undefined && colliding !== trial) {
			this.finishTrial(colliding, 'error', 'A command-window generation was correlated to multiple validation trials.');
			this.finishTrial(trial, 'error', 'A command-window generation was correlated to multiple validation trials.');
			return;
		}

		trial.windowGeneration = windowGeneration;
		this.trialsByGeneration.set(windowGeneration, trial);
		this.recordTrial(trial, 'window-bound');
	}

	/** Records the physical-provider callback before any coalescing, storage, or property lock. */
	recordProviderReceipt(
		propertyId: string,
		value: PropertyCommandValue,
		origin: 'notify' | 'poll',
		metadata?: Record<string, unknown>,
	): void {
		const trial = this.getBoundTrial(propertyId);
		if (trial === null) {
			return;
		}

		this.recordTrial(trial, 'provider-receipt', undefined, { origin, receivedValue: value, ...metadata });
	}

	/** Marks actual poll coalescer admission/drain activity separately from provider confirmation. */
	recordPollActivity(
		propertyId: string,
		stage: Extract<CommandLatencyTraceStage, 'poll-coalescer-admission' | 'poll-drain'>,
		metadata?: Record<string, unknown>,
	): void {
		const trial = this.getBoundTrial(propertyId);
		if (trial !== null) {
			this.recordTrial(trial, stage, undefined, metadata);
		}
	}

	/** Records actual provider RPC activity separately when the private source-device scope is supplied. */
	recordPollRpc(
		deviceId: string,
		stage: Extract<CommandLatencyTraceStage, 'poll-rpc-start' | 'poll-rpc-complete'>,
		metadata?: Record<string, unknown>,
	): void {
		if (!this.isEnabled() || this.config?.sourceDeviceId !== deviceId) {
			return;
		}

		for (const trial of this.trialsByGeneration.values()) {
			if (!trial.completed) {
				this.recordTrial(trial, stage, undefined, { deviceId, ...metadata });
			}
		}
	}

	/**
	 * Captures the outer update entry and retains its identity across every await, including the
	 * value-only structural fallback. The wrapped callback remains the original update behavior.
	 */
	async traceUpdate<T>(
		input: { propertyId: string; value: PropertyCommandValue | undefined; windowGeneration?: string },
		callback: () => Promise<T>,
	): Promise<T> {
		const invocation = this.beginInvocation(input);
		if (invocation === null) {
			return callback();
		}

		return this.context.run(invocation, async () => {
			try {
				const result = await callback();
				this.finishInvocation(invocation);

				return result;
			} catch (error) {
				invocation.status = 'error';
				invocation.failureReason = error instanceof Error ? error.message : 'Unknown update failure';
				this.recordInvocation(invocation, 'update-error', { reason: invocation.failureReason });
				this.finishInvocation(invocation);
				throw error;
			}
		});
	}

	recordWriteComplete(property: ChannelPropertyEntity, metadata?: Record<string, unknown>): void {
		this.recordCurrentInvocation('write-complete', property.id, metadata);
	}

	recordSuppressed(property: ChannelPropertyEntity, reason: string): void {
		const invocation = this.context.getStore();
		if (invocation === undefined || property.id !== this.config?.sourcePropertyId) {
			return;
		}

		invocation.status = 'suppressed';
		this.recordInvocation(invocation, 'suppressed', { reason });
	}

	/** Must run immediately before the existing source event emitter call. */
	recordSourcePublication(property: ChannelPropertyEntity): void {
		const invocation = this.context.getStore();
		if (invocation === undefined || property.id !== this.config?.sourcePropertyId) {
			return;
		}

		const publishedValue = property.value?.value;
		if (publishedValue !== invocation.trial.commandValue) {
			invocation.status = 'error';
			invocation.failureReason = 'Canonical source publication did not match the commanded value.';
			this.recordInvocation(invocation, 'update-error', { reason: invocation.failureReason, publishedValue });
			return;
		}

		this.recordInvocation(invocation, 'source-publication');
	}

	/** A live adapter reads immutable completed captures after the client observer has settled. */
	getCaptures(): readonly CommandLatencyTraceCapture[] {
		this.expireDueTrials();
		return this.captures.map((capture) => ({ ...capture, records: [...capture.records] }));
	}

	/** Waits outside the update path until private post-capture exports have either completed or failed. */
	async waitForExports(): Promise<void> {
		await Promise.all([...this.exportTasks]);
	}

	onModuleDestroy(): void {
		for (const trial of [...this.trialsByIntent.values()]) {
			this.finishTrial(trial, 'shutdown', 'The backend stopped before the validation capture completed.');
		}
	}

	private beginInvocation(input: {
		propertyId: string;
		value: PropertyCommandValue | undefined;
		windowGeneration?: string;
	}): TraceInvocation | null {
		const trial = this.getBoundTrial(input.propertyId, input.windowGeneration);
		if (trial === null || input.value === undefined) {
			return null;
		}
		if (trial.activeInvocationCount > 0) {
			this.finishTrial(
				trial,
				'error',
				'Concurrent provider updates share one command-window generation; server evidence is ambiguous.',
			);
			return null;
		}

		const invocation: TraceInvocation = {
			invocationId: randomUUID(),
			trial,
			records: trial.pendingRecords.splice(0),
			status: 'pending',
		};
		trial.activeInvocationCount++;
		this.recordInvocation(invocation, 'update-entry', { receivedValue: input.value });

		return invocation;
	}

	private finishInvocation(invocation: TraceInvocation): void {
		invocation.trial.activeInvocationCount = Math.max(0, invocation.trial.activeInvocationCount - 1);
		if (invocation.trial.completed) {
			return;
		}
		const published = invocation.records.some((record) => record.stage === 'source-publication');
		if (invocation.status === 'pending' && published) {
			this.recordInvocation(invocation, 'update-complete');
			this.finishTrial(invocation.trial, 'complete', undefined, invocation);
			return;
		}

		if (invocation.status === 'suppressed') {
			this.finishTrial(invocation.trial, 'suppressed', undefined, invocation, false);
			return;
		}

		if (invocation.status === 'error') {
			this.finishTrial(invocation.trial, 'error', invocation.failureReason, invocation);
		}
	}

	private recordCurrentInvocation(
		stage: Extract<CommandLatencyTraceStage, 'write-complete'>,
		propertyId: string,
		metadata?: Record<string, unknown>,
	): void {
		const invocation = this.context.getStore();
		if (invocation !== undefined && propertyId === this.config?.sourcePropertyId) {
			this.recordInvocation(invocation, stage, metadata);
		}
	}

	private getBoundTrial(propertyId: string, windowGeneration?: string): ActiveTrial | null {
		if (!this.isEnabled() || this.config === null || propertyId !== this.config.sourcePropertyId) {
			return null;
		}

		this.expireDueTrials();
		if (windowGeneration !== undefined) {
			return this.trialsByGeneration.get(windowGeneration) ?? null;
		}

		const candidates = [...this.trialsByGeneration.values()].filter((trial) => !trial.completed);
		return candidates.length === 1 ? (candidates[0] ?? null) : null;
	}

	private recordTrial(
		trial: ActiveTrial,
		stage: CommandLatencyTraceStage,
		invocationId?: string,
		metadata?: Record<string, unknown>,
	): CommandLatencyTraceRecord | null {
		const record = this.createRecord(trial, stage, invocationId, metadata);
		if (!this.acceptRecord(record)) {
			return null;
		}
		if (invocationId === undefined) {
			trial.pendingRecords.push(record);
		}

		return record;
	}

	private recordInvocation(
		invocation: TraceInvocation,
		stage: CommandLatencyTraceStage,
		metadata?: Record<string, unknown>,
	): void {
		if (invocation.trial.completed) {
			return;
		}
		const record = this.recordTrial(invocation.trial, stage, invocation.invocationId, metadata);
		if (record !== null) {
			invocation.records.push(record);
		}
	}

	private createRecord(
		trial: ActiveTrial,
		stage: CommandLatencyTraceStage,
		invocationId?: string,
		metadata?: Record<string, unknown>,
	): CommandLatencyTraceRecord {
		if (this.config === null) {
			throw new Error('Cannot create a command latency trace record while capture is disabled.');
		}

		return Object.freeze({
			stage,
			timestampMs: this.now(),
			processId: process.pid,
			runId: this.config.runId,
			trialId: trial.trialId,
			invocationId,
			sourcePropertyId: this.config.sourcePropertyId,
			projectionPropertyId: this.config.projectionPropertyId,
			commandValue: trial.commandValue,
			intentId: trial.intentId,
			windowGeneration: trial.windowGeneration,
			metadata: metadata === undefined ? undefined : Object.freeze({ ...metadata }),
		});
	}

	private acceptRecord(_record: CommandLatencyTraceRecord): boolean {
		if (this.overflowed) {
			return false;
		}
		if (this.recordCount >= (this.config?.maxRecords ?? 0)) {
			this.overflowed = true;
			for (const trial of [...this.trialsByIntent.values()]) {
				this.finishTrial(trial, 'overflow', 'The bounded command latency capture exceeded its record limit.');
			}
			return false;
		}

		this.recordCount++;
		return true;
	}

	private finishTrial(
		trial: ActiveTrial,
		status: CommandLatencyTraceStatus,
		failureReason?: string,
		invocation?: TraceInvocation,
		finalize = true,
	): void {
		if (trial.completed && finalize) {
			return;
		}

		const records = invocation?.records ?? trial.pendingRecords;
		const capture: CommandLatencyTraceCapture = Object.freeze({
			schemaVersion: 1,
			clock: 'backend-performance-now-v1',
			collectorHash: this.collectorHash,
			processId: process.pid,
			runId: this.config?.runId ?? 'disabled',
			trialId: trial.trialId,
			invocationId: invocation?.invocationId,
			sourcePropertyId: this.config?.sourcePropertyId ?? '',
			projectionPropertyId: this.config?.projectionPropertyId,
			commandValue: trial.commandValue,
			intentId: trial.intentId,
			windowGeneration: trial.windowGeneration,
			status,
			failureReason,
			records: Object.freeze([...records]),
		});
		this.captures.push(capture);
		this.scheduleExport(capture);

		if (!finalize) {
			return;
		}

		trial.completed = true;
		clearTimeout(trial.expiryTimer);
		this.trialsByIntent.delete(trial.intentId);
		if (trial.windowGeneration !== undefined && this.trialsByGeneration.get(trial.windowGeneration) === trial) {
			this.trialsByGeneration.delete(trial.windowGeneration);
		}
	}

	private expireDueTrials(): void {
		const now = this.now();
		for (const trial of [...this.trialsByIntent.values()]) {
			if (now - trial.startedAtMs >= (this.config?.captureDurationMs ?? 0)) {
				this.finishTrial(
					trial,
					'expired',
					'The 30 second validation capture window elapsed before source publication.',
				);
			}
		}
	}

	private expireTrial(intentId: string): void {
		const trial = this.trialsByIntent.get(intentId);
		if (trial !== undefined) {
			this.finishTrial(trial, 'expired', 'The 30 second validation capture window elapsed before source publication.');
		}
	}

	private now(): number {
		return performance.now();
	}

	private scheduleExport(capture: CommandLatencyTraceCapture): void {
		if (!this.config?.exportPath) {
			return;
		}

		this.pendingExports.add(capture);
		const task = new Promise<void>((resolve) => {
			setImmediate(() => {
				void appendFile(this.config?.exportPath ?? '', `${JSON.stringify(capture)}\n`, 'utf8')
					.catch(() => {
						this.replaceCaptureAfterSinkFailure(capture);
					})
					.finally(() => {
						this.pendingExports.delete(capture);
						this.exportTasks.delete(task);
						resolve();
					});
			});
		});
		this.exportTasks.add(task);
	}

	private replaceCaptureAfterSinkFailure(capture: CommandLatencyTraceCapture): void {
		const index = this.captures.indexOf(capture);
		if (index === -1) {
			return;
		}

		this.captures[index] = Object.freeze({
			...capture,
			status: 'error',
			failureReason: 'The private command latency capture sink failed to export this report.',
		});
	}
}

function parseEnvironmentConfig(): CommandLatencyTraceConfig | null {
	const raw = process.env.FB_COMMAND_LATENCY_CAPTURE;
	if (!raw) {
		return null;
	}

	try {
		return JSON.parse(raw) as CommandLatencyTraceConfig;
	} catch {
		return null;
	}
}

function normalizeConfig(
	config: CommandLatencyTraceConfig | null,
): (Required<Pick<CommandLatencyTraceConfig, 'captureDurationMs' | 'maxRecords'>> & CommandLatencyTraceConfig) | null {
	if (
		config === null ||
		!isNonEmptyString(config.runId) ||
		!isNonEmptyString(config.sourcePropertyId) ||
		(config.projectionPropertyId !== undefined && !isNonEmptyString(config.projectionPropertyId)) ||
		(config.sourceDeviceId !== undefined && !isNonEmptyString(config.sourceDeviceId)) ||
		(config.exportPath !== undefined && !isNonEmptyString(config.exportPath))
	) {
		return null;
	}

	const captureDurationMs = config.captureDurationMs ?? MAX_CAPTURE_DURATION_MS;
	const maxRecords = config.maxRecords ?? MAX_CAPTURE_RECORDS;
	if (
		!Number.isInteger(captureDurationMs) ||
		captureDurationMs <= 0 ||
		captureDurationMs > MAX_CAPTURE_DURATION_MS ||
		!Number.isInteger(maxRecords) ||
		maxRecords <= 0 ||
		maxRecords > MAX_CAPTURE_RECORDS
	) {
		return null;
	}

	return Object.freeze({ ...config, captureDurationMs, maxRecords });
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}
