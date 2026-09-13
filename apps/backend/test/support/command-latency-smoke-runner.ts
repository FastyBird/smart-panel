import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { type FileHandle, open, rename, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

export type CommandAcknowledgementOutcome =
	| 'pending'
	| 'success'
	| 'rejected'
	| 'timeout'
	| 'transport-failure'
	| 'malformed'
	| 'runner-exception'
	| 'not-dispatched';

export type CommandLatencySmokeFailureKind =
	| 'evidence-initialization'
	| 'evidence-acknowledgement'
	| 'rejected-acknowledgement'
	| 'acknowledgement-timeout'
	| 'transport-failure'
	| 'runner-decoding'
	| 'runner-exception'
	| 'restoration'
	| 'evidence-finalization';

export interface CommandLatencySmokeFailure {
	kind: CommandLatencySmokeFailureKind;
	message: string;
}

export interface CommandLatencySmokeAcknowledgement {
	outcome: CommandAcknowledgementOutcome;
	envelope: unknown;
	handlerResult: unknown;
	failureReason: string | null;
}

export interface CommandLatencySmokeCommand {
	event: string;
	payload: Record<string, unknown>;
}

export interface CommandLatencySmokeDispatch extends CommandLatencySmokeCommand {
	requestId: string;
}

export interface CommandLatencySmokeObservationContext {
	dispatch: CommandLatencySmokeDispatch;
	acknowledgement: unknown;
}

export interface CommandLatencySmokeCleanupContext {
	correlationId: string;
	trialRequestId: string;
}

export interface CommandLatencySmokeCleanupResult {
	restored: boolean;
	result?: unknown;
}

export interface CommandLatencySmokeTransport {
	emit(dispatch: CommandLatencySmokeDispatch): Promise<unknown>;
}

export interface CommandLatencySmokeEvidenceStore {
	writeInitial(artifact: CommandLatencySmokeArtifact): Promise<void>;
	writeAcknowledgement(artifact: CommandLatencySmokeArtifact): Promise<void>;
	writeFinal(artifact: CommandLatencySmokeArtifact): Promise<void>;
}

export interface CommandLatencySmokeArtifact {
	schemaVersion: 1;
	runnerHash: string;
	wrapperHash: string | null;
	runId: string;
	observerHash: string | null;
	collectorHash: string | null;
	target: unknown;
	baseline: unknown;
	trial: {
		requestId: string;
		dispatchAttempted: boolean;
		emittedRequestId: string | null;
		acknowledgement: CommandLatencySmokeAcknowledgement;
		observation: unknown;
	};
	cleanup: {
		correlationId: string;
		attempted: boolean;
		restored: boolean | null;
		result: unknown;
	};
	failures: {
		original: CommandLatencySmokeFailure | null;
		cleanup: CommandLatencySmokeFailure | null;
		acknowledgementPersistence: CommandLatencySmokeFailure | null;
		finalization: CommandLatencySmokeFailure | null;
	};
	evidence: {
		initialPersisted: boolean;
		finalPersisted: boolean;
		valid: boolean;
	};
}

export interface CommandLatencySmokeRunOptions {
	runId: string;
	target: unknown;
	baseline: unknown;
	wrapperHash?: string;
	observerHash?: string;
	collectorHash?: string;
	createCommand: () => CommandLatencySmokeCommand;
	transport: CommandLatencySmokeTransport;
	evidenceStore: CommandLatencySmokeEvidenceStore;
	restore: (context: CommandLatencySmokeCleanupContext) => Promise<CommandLatencySmokeCleanupResult>;
	observe?: (context: CommandLatencySmokeObservationContext) => Promise<unknown>;
	requestIdFactory?: () => string;
}

export interface CommandLatencySmokeRunResult {
	artifact: CommandLatencySmokeArtifact;
	initialPersisted: boolean;
	finalPersisted: boolean;
}

/**
 * The private Socket.IO adapter must map a no-ack timeout to this type. A generic rejected
 * promise is otherwise retained as a transport failure, rather than being mistaken for an
 * explicit negative acknowledgement.
 */
export class CommandAcknowledgementTimeoutError extends Error {
	constructor(message = 'Command acknowledgement timed out.') {
		super(message);
		this.name = 'CommandAcknowledgementTimeoutError';
	}
}

const COMMIT_UNCERTAIN_MESSAGE = 'Private artifact commit is uncertain after atomic rename.';

class CommandLatencySmokeEvidenceCommitUncertainError extends Error {
	constructor() {
		super(COMMIT_UNCERTAIN_MESSAGE);
		this.name = 'CommandLatencySmokeEvidenceCommitUncertainError';
	}
}

interface CommandLatencySmokeEvidenceFileSystem {
	open(path: string, flags: 'r' | 'w', mode?: number): Promise<FileHandle>;
	rename(oldPath: string, newPath: string): Promise<void>;
	rm(path: string, options: { force: boolean }): Promise<void>;
}

const commandLatencySmokeEvidenceFileSystem: CommandLatencySmokeEvidenceFileSystem = { open, rename, rm };

/**
 * Persists the private artifact atomically in a caller-created, private directory. The runner
 * deliberately does not create that directory: its ownership and permissions are a preflight
 * responsibility, and a missing/unwritable directory must stop dispatch before the command.
 */
export class JsonFileCommandLatencySmokeEvidenceStore implements CommandLatencySmokeEvidenceStore {
	constructor(
		private readonly artifactPath: string,
		private readonly fileSystem: CommandLatencySmokeEvidenceFileSystem = commandLatencySmokeEvidenceFileSystem,
	) {}

	/** Writes the pre-dispatch checkpoint required before a command can be emitted. */
	async writeInitial(artifact: CommandLatencySmokeArtifact): Promise<void> {
		await this.write(artifact);
	}

	/** Writes the acknowledgement checkpoint before optional observations are collected. */
	async writeAcknowledgement(artifact: CommandLatencySmokeArtifact): Promise<void> {
		await this.write(artifact);
	}

	/** Writes the final artifact after restoration has been attempted. */
	async writeFinal(artifact: CommandLatencySmokeArtifact): Promise<void> {
		await this.write(artifact);
	}

	/** Replaces the artifact atomically and preserves owner-only permissions on each write. */
	private async write(artifact: CommandLatencySmokeArtifact): Promise<void> {
		const temporaryPath = this.createTemporaryPath();
		let renamed = false;

		try {
			await this.writeTemporaryArtifact(temporaryPath, artifact);
			await this.fileSystem.rename(temporaryPath, this.artifactPath);
			renamed = true;
			await this.syncParentDirectory();
		} catch (error) {
			await this.fileSystem.rm(temporaryPath, { force: true }).catch(() => undefined);

			if (renamed) {
				await this.replaceWithCommitUncertainArtifact(artifact).catch(() => undefined);
				throw new CommandLatencySmokeEvidenceCommitUncertainError();
			}

			throw error;
		}
	}

	private createTemporaryPath(): string {
		return join(dirname(this.artifactPath), `.${basename(this.artifactPath)}.${randomUUID()}.tmp`);
	}

	private async writeTemporaryArtifact(path: string, artifact: CommandLatencySmokeArtifact): Promise<void> {
		const file = await this.fileSystem.open(path, 'w', 0o600);

		try {
			await file.writeFile(`${JSON.stringify(artifact)}\n`, 'utf8');
			await file.chmod(0o600);
			await file.sync();
		} finally {
			await file.close();
		}
	}

	private async syncParentDirectory(): Promise<void> {
		const directory = await this.fileSystem.open(dirname(this.artifactPath), 'r');

		try {
			await directory.sync();
		} finally {
			await directory.close();
		}
	}

	/** Replaces a post-rename failure with an explicitly invalid artifact before reporting uncertainty. */
	private async replaceWithCommitUncertainArtifact(artifact: CommandLatencySmokeArtifact): Promise<void> {
		const uncertainArtifact = structuredClone(artifact);
		uncertainArtifact.evidence.finalPersisted = false;
		uncertainArtifact.evidence.valid = false;
		uncertainArtifact.failures.finalization = {
			kind: 'evidence-finalization',
			message: COMMIT_UNCERTAIN_MESSAGE,
		};

		await this.fileSystem.rm(this.artifactPath, { force: true });

		const temporaryPath = this.createTemporaryPath();
		try {
			await this.writeTemporaryArtifact(temporaryPath, uncertainArtifact);
			await this.fileSystem.rename(temporaryPath, this.artifactPath);
			await this.syncParentDirectory().catch(() => undefined);
		} finally {
			await this.fileSystem.rm(temporaryPath, { force: true }).catch(() => undefined);
		}
	}
}

/**
 * Builds a fallback digest input when the TypeScript source is not available at runtime. Every
 * runtime implementation that affects the artifact is included so the fallback still identifies
 * the complete runner rather than only its top-level orchestration function.
 */
function getCommandLatencySmokeRunnerFallbackSource(): string {
	return [
		CommandAcknowledgementTimeoutError,
		JsonFileCommandLatencySmokeEvidenceStore,
		getCommandLatencySmokeRunnerSourceHash,
		getCommandLatencySmokeRunnerFallbackSource,
		runCommandLatencySmokeTrial,
		persistAcknowledgementArtifact,
		persistFinalArtifact,
		decodeAcknowledgement,
		findPropertyHandlerResult,
		acknowledgement,
		failure,
		errorMessage,
		isRecord,
	]
		.map((implementation) => implementation.toString())
		.join('\n');
}

/** Returns the runner source digest recorded with each private trial artifact. */
export function getCommandLatencySmokeRunnerSourceHash(): string {
	try {
		const source = readFileSync(__filename, 'utf8');
		return createHash('sha256').update(source).digest('hex');
	} catch {
		return createHash('sha256').update(getCommandLatencySmokeRunnerFallbackSource()).digest('hex');
	}
}

/**
 * Executes one private command-latency smoke trial while retaining enough evidence to diagnose
 * acknowledgement failures. It intentionally owns neither credentials nor endpoint details.
 */
export async function runCommandLatencySmokeTrial(
	options: CommandLatencySmokeRunOptions,
): Promise<CommandLatencySmokeRunResult> {
	const requestIdFactory = options.requestIdFactory ?? (() => randomUUID());
	const requestId = requestIdFactory();
	const cleanupCorrelationId = requestIdFactory();
	const artifact: CommandLatencySmokeArtifact = {
		schemaVersion: 1,
		runnerHash: getCommandLatencySmokeRunnerSourceHash(),
		wrapperHash: options.wrapperHash ?? null,
		runId: options.runId,
		observerHash: options.observerHash ?? null,
		collectorHash: options.collectorHash ?? null,
		target: options.target,
		baseline: options.baseline,
		trial: {
			requestId,
			dispatchAttempted: false,
			emittedRequestId: null,
			acknowledgement: {
				outcome: 'pending',
				envelope: null,
				handlerResult: null,
				failureReason: null,
			},
			observation: null,
		},
		cleanup: {
			correlationId: cleanupCorrelationId,
			attempted: false,
			restored: null,
			result: null,
		},
		failures: {
			original: null,
			cleanup: null,
			acknowledgementPersistence: null,
			finalization: null,
		},
		evidence: {
			initialPersisted: true,
			finalPersisted: false,
			valid: false,
		},
	};

	try {
		await options.evidenceStore.writeInitial(artifact);
	} catch (error) {
		artifact.evidence.initialPersisted = false;
		artifact.failures.original = failure('evidence-initialization', error);
		artifact.trial.acknowledgement = acknowledgement('not-dispatched', null, null, artifact.failures.original.message);

		return persistFinalArtifact(options.evidenceStore, artifact);
	}

	let command: CommandLatencySmokeCommand;
	try {
		command = options.createCommand();
	} catch (error) {
		artifact.trial.acknowledgement = acknowledgement('runner-exception', null, null, errorMessage(error));
		artifact.failures.original = failure('runner-exception', error);

		return persistFinalArtifact(options.evidenceStore, artifact);
	}

	const dispatch: CommandLatencySmokeDispatch = {
		...command,
		requestId,
		payload: {
			...command.payload,
			request_id: requestId,
		},
	};

	artifact.trial.dispatchAttempted = true;
	artifact.trial.emittedRequestId = requestId;

	try {
		const envelope = await options.transport.emit(dispatch);
		artifact.trial.acknowledgement = decodeAcknowledgement(envelope);

		if (artifact.trial.acknowledgement.outcome === 'rejected') {
			artifact.failures.original = {
				kind: 'rejected-acknowledgement',
				message: artifact.trial.acknowledgement.failureReason ?? 'Command acknowledgement was rejected.',
			};
		} else if (artifact.trial.acknowledgement.outcome === 'malformed') {
			artifact.failures.original = {
				kind: 'runner-decoding',
				message: artifact.trial.acknowledgement.failureReason ?? 'Command acknowledgement was malformed.',
			};
		}
	} catch (error) {
		if (error instanceof CommandAcknowledgementTimeoutError) {
			artifact.trial.acknowledgement = acknowledgement('timeout', null, null, error.message);
			artifact.failures.original = failure('acknowledgement-timeout', error);
		} else {
			artifact.trial.acknowledgement = acknowledgement('transport-failure', null, null, errorMessage(error));
			artifact.failures.original = failure('transport-failure', error);
		}
	}

	const acknowledgementPersisted = await persistAcknowledgementArtifact(options.evidenceStore, artifact);

	if (acknowledgementPersisted && artifact.trial.acknowledgement.outcome === 'success') {
		try {
			artifact.trial.observation =
				(await options.observe?.({ dispatch, acknowledgement: artifact.trial.acknowledgement.envelope })) ?? null;
		} catch (error) {
			artifact.failures.original = failure('runner-exception', error);
		}
	}

	artifact.cleanup.attempted = true;
	try {
		const cleanup = await options.restore({
			correlationId: cleanupCorrelationId,
			trialRequestId: requestId,
		});
		artifact.cleanup.restored = cleanup.restored;
		artifact.cleanup.result = cleanup.result ?? null;
		if (!cleanup.restored) {
			artifact.failures.cleanup = {
				kind: 'restoration',
				message: 'Target restoration did not complete.',
			};
		}
	} catch (error) {
		artifact.cleanup.restored = false;
		artifact.failures.cleanup = failure('restoration', error);
	}

	return persistFinalArtifact(options.evidenceStore, artifact);
}

/**
 * Checkpoints the decoded acknowledgement before observations. A failed checkpoint invalidates
 * evidence and skips observations, but does not prevent restoration or finalization.
 */
async function persistAcknowledgementArtifact(
	evidenceStore: CommandLatencySmokeEvidenceStore,
	artifact: CommandLatencySmokeArtifact,
): Promise<boolean> {
	try {
		await evidenceStore.writeAcknowledgement(artifact);
		return true;
	} catch (error) {
		artifact.failures.acknowledgementPersistence = failure('evidence-acknowledgement', error);
		artifact.evidence.valid = false;
		return false;
	}
}

/** Calculates validity and attempts the terminal write without obscuring earlier failures. */
async function persistFinalArtifact(
	evidenceStore: CommandLatencySmokeEvidenceStore,
	artifact: CommandLatencySmokeArtifact,
): Promise<CommandLatencySmokeRunResult> {
	artifact.evidence.finalPersisted = true;
	artifact.evidence.valid =
		artifact.evidence.initialPersisted &&
		artifact.trial.acknowledgement.outcome === 'success' &&
		artifact.cleanup.restored === true &&
		artifact.failures.original === null &&
		artifact.failures.cleanup === null &&
		artifact.failures.acknowledgementPersistence === null;

	try {
		await evidenceStore.writeFinal(artifact);
	} catch (error) {
		artifact.evidence.finalPersisted = false;
		artifact.evidence.valid = false;
		artifact.failures.finalization = failure('evidence-finalization', error);
	}

	return {
		artifact,
		initialPersisted: artifact.evidence.initialPersisted,
		finalPersisted: artifact.evidence.finalPersisted,
	};
}

/** Decodes the raw private response envelope into a retained acknowledgement classification. */
function decodeAcknowledgement(envelope: unknown): CommandLatencySmokeAcknowledgement {
	if (!isRecord(envelope) || typeof envelope.status !== 'string') {
		return acknowledgement('malformed', envelope, null, 'Command acknowledgement is missing a string status.');
	}

	if (envelope.status !== 'ok') {
		return acknowledgement(
			'rejected',
			envelope,
			findPropertyHandlerResult(envelope.results),
			'Command acknowledgement status is not ok.',
		);
	}

	if (!Array.isArray(envelope.results)) {
		return acknowledgement('malformed', envelope, null, 'Command acknowledgement is missing its results array.');
	}

	const handlerResult = findPropertyHandlerResult(envelope.results);
	if (!isRecord(handlerResult) || typeof handlerResult.success !== 'boolean') {
		return acknowledgement(
			'malformed',
			envelope,
			handlerResult,
			'Command acknowledgement has no decodable property result.',
		);
	}

	if (!handlerResult.success) {
		return acknowledgement(
			'rejected',
			envelope,
			handlerResult,
			'Command acknowledgement contains a rejected property result.',
		);
	}

	return acknowledgement('success', envelope, handlerResult, null);
}

/** Finds the property-operation result nested within a command acknowledgement. */
function findPropertyHandlerResult(results: unknown): unknown {
	if (!Array.isArray(results)) {
		return null;
	}

	return (
		results.find((result) => isRecord(result) && result.handler === 'DevicesModule.Internal.SetPropertyValue') ?? null
	);
}

/** Constructs one acknowledgement record while preserving raw evidence values untouched. */
function acknowledgement(
	outcome: CommandAcknowledgementOutcome,
	envelope: unknown,
	handlerResult: unknown,
	failureReason: string | null,
): CommandLatencySmokeAcknowledgement {
	return { outcome, envelope, handlerResult, failureReason };
}

/** Normalizes a caught error into the artifact's structured failure form. */
function failure(kind: CommandLatencySmokeFailureKind, error: unknown): CommandLatencySmokeFailure {
	return { kind, message: errorMessage(error) };
}

/** Provides a safe, non-sensitive message for arbitrary thrown values. */
function errorMessage(error: unknown): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	return 'Unexpected runner failure.';
}

/** Narrows an unknown value to a non-null object record. */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
