import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { type FileHandle, link, lstat, open, rename, rm } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { Socket } from 'socket.io';

import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';

const COMMAND_EVENT = 'command';
const PROPERTY_SET_EVENT = 'DevicesModule.ChannelProperty.Set';
const MAX_CONFIGURATION_BYTES = 8 * 1024;
const MAX_CAPTURE_DURATION_MS = 30_000;
const MAX_RECORDS = 256;
const MAX_SNAPSHOT_BYTES = 256 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CommandAcknowledgementTraceConfig {
	readonly schemaVersion: 1;
	readonly runId: string;
	readonly target: {
		readonly deviceId: string;
		readonly channelId: string;
		readonly propertyId: string;
	};
	readonly requests: readonly [
		{ readonly phase: 'trial'; readonly requestId: string; readonly value: boolean },
		{ readonly phase: 'restoration'; readonly requestId: string; readonly value: boolean },
	];
	/** Absolute, private, unique-run path. It is never exposed through an application API. */
	readonly exportPath: string;
	readonly captureDurationMs?: number;
	readonly maxRecords?: number;
}

export const COMMAND_ACKNOWLEDGEMENT_TRACE_OPTIONS = Symbol('COMMAND_ACKNOWLEDGEMENT_TRACE_OPTIONS');

type TraceState = 'armed' | 'recording' | 'closed' | 'invalid';
type TracePhase = 'trial' | 'restoration';
type TraceStage =
	| 'socket-receipt'
	| 'gateway-entry'
	| 'handler-start'
	| 'handler-settled'
	| 'handler-skipped'
	| 'gateway-return'
	| 'gateway-throw'
	| 'ack-invoked'
	| 'ack-returned'
	| 'ack-threw'
	| 'socket-close';

interface NormalizedConfig extends Omit<CommandAcknowledgementTraceConfig, 'captureDurationMs' | 'maxRecords'> {
	readonly captureDurationMs: number;
	readonly maxRecords: number;
}

interface TraceRequest {
	readonly phase: TracePhase;
	readonly requestId: string;
	readonly value: boolean;
	seen: boolean;
	ackCalls: number;
}

type AcknowledgementFunction = (this: unknown, ...args: unknown[]) => unknown;

interface TraceRecord {
	readonly sequence: number;
	readonly monotonicMs: number;
	readonly stage: TraceStage;
	readonly phase: TracePhase;
	readonly requestId: string;
	readonly metadata?: Record<string, boolean | number | string>;
}

interface CommandAcknowledgementTraceSnapshot {
	readonly schemaVersion: 1;
	readonly snapshotSequence: number;
	readonly snapshotMonotonicMs: number;
	readonly configFingerprint: string;
	readonly process: {
		readonly id: number;
		readonly instanceId: string;
		readonly runtimeSourceHash: string;
	};
	readonly runId: string;
	readonly target: {
		readonly deviceId: string;
		readonly channelId: string;
		readonly propertyId: string;
	};
	readonly state: TraceState;
	readonly cutoffReason: string | null;
	readonly socketTraceId: string | null;
	readonly requests: readonly {
		readonly phase: TracePhase;
		readonly requestId: string;
		readonly value: boolean;
		readonly status: 'not-observed' | 'received';
		readonly acknowledgementCalls: number;
	}[];
	readonly records: readonly TraceRecord[];
}

interface SocketTraceContext {
	readonly socket: Socket;
	readonly socketTraceId: string;
	readonly disconnectListener: (reason: unknown) => void;
}

interface CommandAcknowledgementTraceFileSystem {
	lstat(path: string): Promise<unknown>;
	open(path: string, flags: 'r' | 'wx', mode?: number): Promise<FileHandle>;
	link(existingPath: string, newPath: string): Promise<void>;
	rename(oldPath: string, newPath: string): Promise<void>;
	rm(path: string, options: { force: boolean }): Promise<void>;
}

const commandAcknowledgementTraceFileSystem: CommandAcknowledgementTraceFileSystem = { lstat, link, open, rename, rm };

/**
 * Coalesces snapshots outside command handling. The newest immutable state wins, but no newer
 * write can overtake an older in-flight atomic replacement.
 */
export class CommandAcknowledgementSnapshotWriter {
	private writing = false;
	private pending: CommandAcknowledgementTraceSnapshot | null = null;
	private ownedDestination = false;
	private readonly idleWaiters = new Set<() => void>();

	constructor(
		private readonly destination: string,
		private readonly onFailure: () => void,
		private readonly fileSystem: CommandAcknowledgementTraceFileSystem = commandAcknowledgementTraceFileSystem,
	) {}

	queue(snapshot: CommandAcknowledgementTraceSnapshot): void {
		this.pending = snapshot;
		if (!this.writing) {
			void this.drain();
		}
	}

	async waitForIdle(): Promise<void> {
		if (!this.writing && this.pending === null) {
			return;
		}

		await new Promise<void>((resolve) => this.idleWaiters.add(resolve));
	}

	private async drain(): Promise<void> {
		this.writing = true;
		try {
			while (this.pending !== null) {
				const snapshot = this.pending;
				this.pending = null;
				try {
					await this.write(snapshot);
				} catch {
					this.pending = null;
					this.onFailure();
					break;
				}
			}
		} finally {
			this.writing = false;
			for (const resolve of this.idleWaiters) {
				resolve();
			}
			this.idleWaiters.clear();
		}
	}

	private async write(snapshot: CommandAcknowledgementTraceSnapshot): Promise<void> {
		if (!this.ownedDestination) {
			await this.assertDestinationIsAbsent();
		}

		const temporaryPath = join(dirname(this.destination), `.${basename(this.destination)}.${randomUUID()}.tmp`);
		try {
			const file = await this.fileSystem.open(temporaryPath, 'wx', 0o600);
			try {
				await file.writeFile(`${JSON.stringify(snapshot)}\n`, 'utf8');
				await file.chmod(0o600);
				await file.sync();
			} finally {
				await file.close();
			}

			if (this.ownedDestination) {
				await this.fileSystem.rename(temporaryPath, this.destination);
			} else {
				await this.fileSystem.link(temporaryPath, this.destination);
			}
			this.ownedDestination = true;
			await this.syncParentDirectory();
		} finally {
			await this.fileSystem.rm(temporaryPath, { force: true }).catch(() => undefined);
		}
	}

	private async assertDestinationIsAbsent(): Promise<void> {
		try {
			await this.fileSystem.lstat(this.destination);
			throw new Error('The acknowledgement trace destination already exists.');
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
				throw error;
			}
		}
	}

	private async syncParentDirectory(): Promise<void> {
		const directory = await this.fileSystem.open(dirname(this.destination), 'r');
		try {
			await directory.sync();
		} finally {
			await directory.close();
		}
	}
}

/**
 * Opt-in, private evidence for exactly two preallocated property-command acknowledgements.
 * It observes Socket.IO and gateway boundaries only; it never changes command routing,
 * authorization, acknowledgements, device state, or any public API contract.
 */
@Injectable()
export class CommandAcknowledgementTraceService implements OnModuleInit, OnModuleDestroy {
	private readonly config: NormalizedConfig | null;
	private readonly runtimeSourceHash = CommandAcknowledgementTraceService.getSourceHash();
	private readonly configFingerprint: string | null;
	private readonly processInstanceId = randomUUID();
	private readonly requests = new Map<string, TraceRequest>();
	private readonly attachedSockets = new WeakSet<Socket>();
	private readonly disconnectListeners = new WeakMap<Socket, (reason: unknown) => void>();
	private readonly writer: CommandAcknowledgementSnapshotWriter | null;
	private socketContext: SocketTraceContext | null = null;
	private state: TraceState = 'armed';
	private cutoffReason: string | null = null;
	private records: TraceRecord[] = [];
	private nextSequence = 1;
	private nextSnapshotSequence = 1;
	private timer: NodeJS.Timeout | null = null;
	private exportFailed = false;

	constructor(
		@Optional()
		@Inject(COMMAND_ACKNOWLEDGEMENT_TRACE_OPTIONS)
		options?: CommandAcknowledgementTraceConfig | null,
	) {
		this.config = normalizeConfig(options ?? parseEnvironmentConfig());
		this.configFingerprint = this.config === null ? null : fingerprintConfig(this.config);
		this.writer =
			this.config === null
				? null
				: new CommandAcknowledgementSnapshotWriter(this.config.exportPath, () => this.handleExportFailure());

		for (const request of this.config?.requests ?? []) {
			this.requests.set(request.requestId, { ...request, seen: false, ackCalls: 0 });
		}
	}

	static getSourceHash(): string {
		try {
			return createHash('sha256').update(readFileSync(__filename, 'utf8')).digest('hex');
		} catch {
			return createHash('sha256').update(CommandAcknowledgementTraceService.toString()).digest('hex');
		}
	}

	onModuleInit(): void {
		this.scheduleSnapshot();
	}

	onModuleDestroy(): void {
		if (!this.isEnabled()) {
			return;
		}

		if (this.state !== 'invalid') {
			this.close('backend-shutdown');
		}
		this.removeObservedSocketListener();
	}

	isEnabled(): boolean {
		return this.config !== null;
	}

	/** Allows a private lifecycle finalizer to await only deferred snapshot writes. */
	async waitForExports(): Promise<void> {
		await this.writer?.waitForIdle();
	}

	/** Adds one transparent command middleware to an authenticated Socket.IO connection. */
	attachSocket(socket: Socket): void {
		if (!this.isEnabled() || this.attachedSockets.has(socket)) {
			return;
		}
		this.attachedSockets.add(socket);

		if (typeof socket.use === 'function') {
			socket.use((packet: unknown[], next: (error?: Error) => void): void => {
				try {
					this.observeSocketPacket(socket, packet);
				} catch {
					// Diagnostic observation cannot alter Socket.IO command behavior.
				}
				next();
			});
		}

		if (typeof socket.on === 'function') {
			const disconnectListener = (reason: unknown): void => {
				this.recordSocketClose(socket, toBoundedReason(reason));
			};
			socket.on('disconnect', disconnectListener);
			this.disconnectListeners.set(socket, disconnectListener);
		}
	}

	recordGatewayEntry(socket: Socket, message: unknown): void {
		this.recordForGateway(socket, message, 'gateway-entry');
	}

	recordHandlerStart(socket: Socket, message: unknown, handlerName: string): void {
		this.recordForGateway(socket, message, 'handler-start', { handler: boundedHandlerName(handlerName) });
	}

	recordHandlerSettled(
		socket: Socket,
		message: unknown,
		handlerName: string,
		outcome: 'resolved' | 'null' | 'rejected',
	): void {
		this.recordForGateway(socket, message, 'handler-settled', { handler: boundedHandlerName(handlerName), outcome });
	}

	recordHandlerSkipped(socket: Socket, message: unknown, handlerName: string): void {
		this.recordForGateway(socket, message, 'handler-skipped', {
			handler: boundedHandlerName(handlerName),
			reason: 'authorization',
		});
	}

	recordGatewayReturn(socket: Socket, message: unknown, status: 'ok' | 'error'): void {
		this.recordForGateway(socket, message, 'gateway-return', { status });
	}

	recordGatewayThrow(socket: Socket, message: unknown): void {
		this.recordForGateway(socket, message, 'gateway-throw');
	}

	recordSocketClose(socket: Socket, reason: string): void {
		if (!this.isCurrentSocket(socket) || this.state === 'invalid') {
			return;
		}
		for (const request of this.requests.values()) {
			if (request.seen) {
				this.record(request, 'socket-close', { reason });
			}
		}
		this.close('socket-closed');
		this.removeObservedSocketListener();
	}

	getSnapshot(): CommandAcknowledgementTraceSnapshot | null {
		return this.config === null ? null : this.createSnapshot();
	}

	private observeSocketPacket(socket: Socket, packet: unknown[]): void {
		if (this.state === 'closed' || this.state === 'invalid') {
			return;
		}
		if (packet[0] !== COMMAND_EVENT || !isPlainObject(packet[1])) {
			return;
		}

		const message = packet[1];
		if (!isPlainObject(message.payload)) {
			return;
		}

		const request = this.findRequest(message.payload.request_id);
		if (request === null) {
			return;
		}
		if (message.event !== PROPERTY_SET_EVENT || !this.matchesTarget(request, message.payload)) {
			this.invalidate('scope-mismatch');
			return;
		}
		if (!this.bindSocket(socket)) {
			return;
		}
		if (request.seen) {
			this.invalidate('duplicate-request');
			return;
		}

		request.seen = true;
		this.record(request, 'socket-receipt');
		this.startTimer();

		const acknowledgement = packet.at(-1);
		if (isAcknowledgementFunction(acknowledgement)) {
			packet[packet.length - 1] = this.wrapAcknowledgement(request, acknowledgement);
		}
	}

	private wrapAcknowledgement(
		request: TraceRequest,
		acknowledgement: AcknowledgementFunction,
	): AcknowledgementFunction {
		return CommandAcknowledgementTraceService.createAcknowledgementWrapper(this, request, acknowledgement);
	}

	private static createAcknowledgementWrapper(
		trace: CommandAcknowledgementTraceService,
		request: TraceRequest,
		acknowledgement: AcknowledgementFunction,
	): AcknowledgementFunction {
		return function acknowledgementTraceWrapper(this: unknown, ...args: unknown[]): unknown {
			request.ackCalls++;
			trace.record(request, 'ack-invoked', { callCount: request.ackCalls });
			try {
				const result: unknown = acknowledgement.call(this, ...args) as unknown;
				trace.record(request, 'ack-returned', { callCount: request.ackCalls });
				return result;
			} catch (error) {
				trace.record(request, 'ack-threw', { callCount: request.ackCalls });
				throw error;
			}
		};
	}

	private recordForGateway(
		socket: Socket,
		message: unknown,
		stage: TraceStage,
		metadata?: Record<string, boolean | number | string>,
	): void {
		if (this.state === 'invalid' || !this.isCurrentSocket(socket) || !isPlainObject(message)) {
			return;
		}
		const request = this.findRequestFromGatewayMessage(message);
		if (request !== null && request.seen) {
			this.record(request, stage, metadata);
		}
	}

	private findRequestFromGatewayMessage(message: Record<string, unknown>): TraceRequest | null {
		if (message.event !== PROPERTY_SET_EVENT || !isPlainObject(message.payload)) {
			return null;
		}
		const request = this.findRequest(message.payload.request_id);
		return request !== null && this.matchesTarget(request, message.payload) ? request : null;
	}

	private findRequest(value: unknown): TraceRequest | null {
		return typeof value === 'string' ? (this.requests.get(value) ?? null) : null;
	}

	private matchesTarget(request: TraceRequest, payload: unknown): boolean {
		if (this.config === null || !isPlainObject(payload)) {
			return false;
		}
		const properties = payload.properties;
		if (!Array.isArray(properties) || properties.length !== 1 || !isPlainObject(properties[0])) {
			return false;
		}
		const property = properties[0];
		return (
			property.device === this.config.target.deviceId &&
			property.channel === this.config.target.channelId &&
			property.property === this.config.target.propertyId &&
			property.value === request.value
		);
	}

	private bindSocket(socket: Socket): boolean {
		if (this.socketContext === null) {
			const disconnectListener = this.disconnectListeners.get(socket);
			if (disconnectListener === undefined) {
				this.invalidate('socket-listener-unavailable');
				return false;
			}
			this.socketContext = { socket, socketTraceId: randomUUID(), disconnectListener };
			return true;
		}
		if (this.socketContext.socket !== socket) {
			this.invalidate('socket-mismatch');
			return false;
		}
		return true;
	}

	private isCurrentSocket(socket: Socket): boolean {
		return this.socketContext?.socket === socket;
	}

	private removeObservedSocketListener(): void {
		if (this.socketContext === null || typeof this.socketContext.socket.off !== 'function') {
			return;
		}
		this.socketContext.socket.off('disconnect', this.socketContext.disconnectListener);
	}

	private startTimer(): void {
		if (this.timer !== null || this.config === null) {
			return;
		}
		this.timer = setTimeout(() => this.close('capture-duration-elapsed'), this.config.captureDurationMs);
		this.timer.unref();
	}

	private close(reason: string): void {
		if (this.state === 'invalid' || this.state === 'closed') {
			return;
		}
		this.state = 'closed';
		this.cutoffReason = reason;
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.scheduleSnapshot();
	}

	private invalidate(reason: string): void {
		if (this.state === 'invalid') {
			return;
		}
		this.state = 'invalid';
		this.cutoffReason = reason;
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.scheduleSnapshot();
	}

	private record(request: TraceRequest, stage: TraceStage, metadata?: Record<string, boolean | number | string>): void {
		if (this.state === 'closed' || this.state === 'invalid' || this.config === null) {
			return;
		}
		if (this.records.length >= this.config.maxRecords) {
			this.invalidate('record-limit-exceeded');
			return;
		}
		this.state = 'recording';
		this.records.push(
			Object.freeze({
				sequence: this.nextSequence++,
				monotonicMs: performance.now(),
				stage,
				phase: request.phase,
				requestId: request.requestId,
				metadata: metadata === undefined ? undefined : Object.freeze({ ...metadata }),
			}),
		);
		this.scheduleSnapshot();
	}

	private scheduleSnapshot(): void {
		if (this.config === null || this.writer === null || this.exportFailed) {
			return;
		}
		const snapshot = this.createSnapshot();
		if (Buffer.byteLength(JSON.stringify(snapshot), 'utf8') > MAX_SNAPSHOT_BYTES) {
			// Keep the invalidation observable: retaining an oversized record set would make
			// the follow-up terminal snapshot oversized as well and prevent it from exporting.
			this.records = [];
			this.invalidate('snapshot-size-exceeded');
			return;
		}
		this.writer.queue(snapshot);
	}

	private createSnapshot(): CommandAcknowledgementTraceSnapshot {
		if (this.config === null || this.configFingerprint === null) {
			throw new Error('Acknowledgement tracing is disabled.');
		}
		return Object.freeze({
			schemaVersion: 1,
			snapshotSequence: this.nextSnapshotSequence++,
			snapshotMonotonicMs: performance.now(),
			configFingerprint: this.configFingerprint,
			process: Object.freeze({
				id: process.pid,
				instanceId: this.processInstanceId,
				runtimeSourceHash: this.runtimeSourceHash,
			}),
			runId: this.config.runId,
			target: Object.freeze({ ...this.config.target }),
			state: this.state,
			cutoffReason: this.cutoffReason,
			socketTraceId: this.socketContext?.socketTraceId ?? null,
			requests: Object.freeze(
				[...this.requests.values()].map((request) =>
					Object.freeze({
						phase: request.phase,
						requestId: request.requestId,
						value: request.value,
						status: request.seen ? 'received' : 'not-observed',
						acknowledgementCalls: request.ackCalls,
					}),
				),
			),
			records: Object.freeze([...this.records]),
		});
	}

	private handleExportFailure(): void {
		if (this.exportFailed) {
			return;
		}
		this.exportFailed = true;
		this.invalidate('export-failed');
	}
}

function parseEnvironmentConfig(): CommandAcknowledgementTraceConfig | null {
	const raw = process.env.FB_COMMAND_ACK_TRACE;
	if (!raw || Buffer.byteLength(raw, 'utf8') > MAX_CONFIGURATION_BYTES) {
		return null;
	}
	try {
		return JSON.parse(raw) as CommandAcknowledgementTraceConfig;
	} catch {
		return null;
	}
}

function normalizeConfig(config: CommandAcknowledgementTraceConfig | null): NormalizedConfig | null {
	if (
		config === null ||
		!isPlainObject(config) ||
		config.schemaVersion !== 1 ||
		!isUuid(config.runId) ||
		!isUuid(config.target?.deviceId) ||
		!isUuid(config.target?.channelId) ||
		!isUuid(config.target?.propertyId) ||
		typeof config.exportPath !== 'string' ||
		!isAbsolute(config.exportPath) ||
		!Array.isArray(config.requests) ||
		config.requests.length !== 2
	) {
		return null;
	}
	const [first, second] = config.requests;
	if (
		!isPlainObject(first) ||
		!isPlainObject(second) ||
		first.phase !== 'trial' ||
		second.phase !== 'restoration' ||
		!isUuid(first.requestId) ||
		!isUuid(second.requestId) ||
		first.requestId === second.requestId ||
		typeof first.value !== 'boolean' ||
		typeof second.value !== 'boolean' ||
		first.value === second.value
	) {
		return null;
	}
	const captureDurationMs = config.captureDurationMs ?? MAX_CAPTURE_DURATION_MS;
	const maxRecords = config.maxRecords ?? MAX_RECORDS;
	if (
		!Number.isInteger(captureDurationMs) ||
		captureDurationMs <= 0 ||
		captureDurationMs > MAX_CAPTURE_DURATION_MS ||
		!Number.isInteger(maxRecords) ||
		maxRecords <= 0 ||
		maxRecords > MAX_RECORDS
	) {
		return null;
	}
	return Object.freeze({ ...config, captureDurationMs, maxRecords });
}

function isUuid(value: unknown): value is string {
	return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isAcknowledgementFunction(value: unknown): value is AcknowledgementFunction {
	return typeof value === 'function';
}

function fingerprintConfig(config: NormalizedConfig): string {
	return createHash('sha256').update(JSON.stringify(config)).digest('hex');
}

function boundedHandlerName(handlerName: string): string {
	return handlerName.slice(0, 160);
}

function toBoundedReason(reason: unknown): string {
	return typeof reason === 'string' && reason.length > 0 ? reason.slice(0, 160) : 'unknown';
}
