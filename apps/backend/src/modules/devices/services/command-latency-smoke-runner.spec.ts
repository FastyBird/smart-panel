import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	CommandAcknowledgementTimeoutError,
	type CommandLatencySmokeArtifact,
	type CommandLatencySmokeEvidenceStore,
	type CommandLatencySmokeRunOptions,
	type CommandLatencySmokeTransport,
	JsonFileCommandLatencySmokeEvidenceStore,
	runCommandLatencySmokeTrial,
} from '../../../../test/support/command-latency-smoke-runner';

class MemoryEvidenceStore implements CommandLatencySmokeEvidenceStore {
	initial: CommandLatencySmokeArtifact | null = null;
	acknowledgement: CommandLatencySmokeArtifact | null = null;
	final: CommandLatencySmokeArtifact | null = null;
	initialFailure: Error | null = null;
	acknowledgementFailure: Error | null = null;
	finalFailure: Error | null = null;

	writeInitial(artifact: CommandLatencySmokeArtifact): Promise<void> {
		if (this.initialFailure) {
			return Promise.reject(this.initialFailure);
		}

		this.initial = structuredClone(artifact);
		return Promise.resolve();
	}

	writeAcknowledgement(artifact: CommandLatencySmokeArtifact): Promise<void> {
		if (this.acknowledgementFailure) {
			return Promise.reject(this.acknowledgementFailure);
		}

		this.acknowledgement = structuredClone(artifact);
		return Promise.resolve();
	}

	writeFinal(artifact: CommandLatencySmokeArtifact): Promise<void> {
		if (this.finalFailure) {
			return Promise.reject(this.finalFailure);
		}

		this.final = structuredClone(artifact);
		return Promise.resolve();
	}
}

describe('runCommandLatencySmokeTrial', () => {
	const successAcknowledgement = {
		status: 'ok',
		results: [
			{
				handler: 'DevicesModule.Internal.SetPropertyValue',
				success: true,
			},
		],
	};

	const createOptions = (
		transport: CommandLatencySmokeTransport,
		evidenceStore: CommandLatencySmokeEvidenceStore,
		overrides: Partial<CommandLatencySmokeRunOptions> = {},
	): CommandLatencySmokeRunOptions => ({
		runId: 'private-run',
		target: { sourcePropertyId: 'source-property', projectionPropertyId: 'projection-property' },
		baseline: { source: false, projection: false },
		wrapperHash: 'private-wrapper-hash',
		observerHash: 'observer-hash',
		collectorHash: 'collector-hash',
		createCommand: () => ({
			event: 'DevicesModule.ChannelProperty.Set',
			payload: { value: true },
		}),
		transport,
		evidenceStore,
		restore: () => Promise.resolve({ restored: true, result: { state: 'restored' } }),
		requestIdFactory: jest.fn().mockReturnValueOnce('trial-request-id').mockReturnValueOnce('cleanup-request-id'),
		...overrides,
	});

	it('persists the exact outbound request before emitting a successful acknowledgement', async () => {
		const evidenceStore = new MemoryEvidenceStore();
		const emit = jest.fn().mockResolvedValue(successAcknowledgement);
		const transport: CommandLatencySmokeTransport = {
			emit,
		};
		const observe = jest.fn().mockResolvedValue({ status: 'success' });

		const result = await runCommandLatencySmokeTrial(createOptions(transport, evidenceStore, { observe }));

		expect(evidenceStore.initial?.trial).toMatchObject({
			requestId: 'trial-request-id',
			dispatchAttempted: false,
			emittedRequestId: null,
			acknowledgement: { outcome: 'pending' },
		});
		expect(evidenceStore.initial).toMatchObject({
			runId: 'private-run',
			wrapperHash: 'private-wrapper-hash',
			observerHash: 'observer-hash',
			collectorHash: 'collector-hash',
			target: { sourcePropertyId: 'source-property', projectionPropertyId: 'projection-property' },
			baseline: { source: false, projection: false },
		});
		expect(emit).toHaveBeenCalledWith({
			event: 'DevicesModule.ChannelProperty.Set',
			requestId: 'trial-request-id',
			payload: { value: true, request_id: 'trial-request-id' },
		});
		expect(result.artifact.trial).toMatchObject({
			requestId: 'trial-request-id',
			emittedRequestId: 'trial-request-id',
			acknowledgement: { outcome: 'success', envelope: successAcknowledgement },
			observation: { status: 'success' },
		});
		expect(evidenceStore.acknowledgement?.trial.acknowledgement).toEqual({
			outcome: 'success',
			envelope: successAcknowledgement,
			handlerResult: successAcknowledgement.results[0],
			failureReason: null,
		});
		expect(result.artifact.cleanup).toMatchObject({
			correlationId: 'cleanup-request-id',
			attempted: true,
			restored: true,
		});
		expect(result.artifact.evidence).toEqual({ initialPersisted: true, finalPersisted: true, valid: true });
	});

	it('retains an exact nested negative acknowledgement and the emitted request correlation', async () => {
		const evidenceStore = new MemoryEvidenceStore();
		const rejectedAcknowledgement = {
			status: 'error',
			results: [
				{
					handler: 'DevicesModule.Internal.SetPropertyValue',
					success: false,
					error: {
						code: 'devices.command.rejected',
						details: { device: { code: 'platform.offline' } },
					},
				},
			],
		};
		const transport: CommandLatencySmokeTransport = {
			emit: jest.fn().mockResolvedValue(rejectedAcknowledgement),
		};
		const observe = jest.fn();

		const result = await runCommandLatencySmokeTrial(createOptions(transport, evidenceStore, { observe }));

		expect(result.artifact.trial).toMatchObject({
			requestId: 'trial-request-id',
			emittedRequestId: 'trial-request-id',
			acknowledgement: {
				outcome: 'rejected',
				envelope: rejectedAcknowledgement,
				handlerResult: rejectedAcknowledgement.results[0],
			},
		});
		expect(result.artifact.failures.original).toEqual({
			kind: 'rejected-acknowledgement',
			message: 'Command acknowledgement status is not ok.',
		});
		expect(observe).not.toHaveBeenCalled();
		expect(evidenceStore.final).toEqual(result.artifact);
	});

	it('distinguishes a timeout without an acknowledgement from a negative acknowledgement', async () => {
		const evidenceStore = new MemoryEvidenceStore();
		const transport: CommandLatencySmokeTransport = {
			emit: jest.fn().mockRejectedValue(new CommandAcknowledgementTimeoutError('No acknowledgement before deadline.')),
		};

		const result = await runCommandLatencySmokeTrial(createOptions(transport, evidenceStore));

		expect(result.artifact.trial.acknowledgement).toEqual({
			outcome: 'timeout',
			envelope: null,
			handlerResult: null,
			failureReason: 'No acknowledgement before deadline.',
		});
		expect(result.artifact.failures.original).toEqual({
			kind: 'acknowledgement-timeout',
			message: 'No acknowledgement before deadline.',
		});
		expect(result.artifact.cleanup).toMatchObject({ attempted: true, restored: true });
	});

	it('retains a transport failure separately from an acknowledgement timeout', async () => {
		const evidenceStore = new MemoryEvidenceStore();
		const transport: CommandLatencySmokeTransport = {
			emit: jest.fn().mockRejectedValue(new Error('Socket disconnected.')),
		};

		const result = await runCommandLatencySmokeTrial(createOptions(transport, evidenceStore));

		expect(result.artifact.trial.acknowledgement).toEqual({
			outcome: 'transport-failure',
			envelope: null,
			handlerResult: null,
			failureReason: 'Socket disconnected.',
		});
		expect(result.artifact.failures.original).toEqual({ kind: 'transport-failure', message: 'Socket disconnected.' });
	});

	it('retains a malformed acknowledgement instead of collapsing it into a generic failure', async () => {
		const evidenceStore = new MemoryEvidenceStore();
		const malformedAcknowledgement = { status: 'ok', results: { unexpected: true } };
		const transport: CommandLatencySmokeTransport = {
			emit: jest.fn().mockResolvedValue(malformedAcknowledgement),
		};

		const result = await runCommandLatencySmokeTrial(createOptions(transport, evidenceStore));

		expect(result.artifact.trial.acknowledgement).toEqual({
			outcome: 'malformed',
			envelope: malformedAcknowledgement,
			handlerResult: null,
			failureReason: 'Command acknowledgement is missing its results array.',
		});
		expect(result.artifact.failures.original).toEqual({
			kind: 'runner-decoding',
			message: 'Command acknowledgement is missing its results array.',
		});
	});

	it('retains a successful acknowledgement when later runner observation fails', async () => {
		const evidenceStore = new MemoryEvidenceStore();
		const transport: CommandLatencySmokeTransport = {
			emit: jest.fn().mockResolvedValue(successAcknowledgement),
		};

		const result = await runCommandLatencySmokeTrial(
			createOptions(transport, evidenceStore, {
				observe: () => Promise.reject(new Error('Observer decode failed.')),
			}),
		);

		expect(result.artifact.trial.acknowledgement).toEqual({
			outcome: 'success',
			envelope: successAcknowledgement,
			handlerResult: successAcknowledgement.results[0],
			failureReason: null,
		});
		expect(result.artifact.failures.original).toEqual({ kind: 'runner-exception', message: 'Observer decode failed.' });
	});

	it('continues restoration when acknowledgement persistence fails and invalidates the evidence', async () => {
		const evidenceStore = new MemoryEvidenceStore();
		evidenceStore.acknowledgementFailure = new Error('Acknowledgement checkpoint write failed.');
		const transport: CommandLatencySmokeTransport = {
			emit: jest.fn().mockResolvedValue(successAcknowledgement),
		};
		const restore = jest.fn().mockResolvedValue({ restored: true });
		const observe = jest.fn();

		const result = await runCommandLatencySmokeTrial(createOptions(transport, evidenceStore, { observe, restore }));

		expect(restore).toHaveBeenCalledWith({ correlationId: 'cleanup-request-id', trialRequestId: 'trial-request-id' });
		expect(observe).not.toHaveBeenCalled();
		expect(result.artifact.failures.acknowledgementPersistence).toEqual({
			kind: 'evidence-acknowledgement',
			message: 'Acknowledgement checkpoint write failed.',
		});
		expect(result.artifact.evidence).toEqual({ initialPersisted: true, finalPersisted: true, valid: false });
		expect(evidenceStore.final?.trial.acknowledgement.envelope).toEqual(successAcknowledgement);
	});

	it('writes the durable private artifact with owner-only permissions', async () => {
		const artifactDirectory = await mkdtemp(join(tmpdir(), 'command-latency-smoke-runner-'));
		const artifactPath = join(artifactDirectory, 'raw-smoke.json');
		const evidenceStore = new JsonFileCommandLatencySmokeEvidenceStore(artifactPath);
		const transport: CommandLatencySmokeTransport = {
			emit: jest.fn().mockResolvedValue(successAcknowledgement),
		};

		try {
			const result = await runCommandLatencySmokeTrial(createOptions(transport, evidenceStore));
			const persisted: unknown = JSON.parse(await readFile(artifactPath, 'utf8'));

			expect(persisted).toEqual(result.artifact);
			expect((await stat(artifactPath)).mode & 0o777).toBe(0o600);
		} finally {
			await rm(artifactDirectory, { force: true, recursive: true });
		}
	});

	it('aborts before dispatch when the initial durable write fails', async () => {
		const evidenceStore = new MemoryEvidenceStore();
		evidenceStore.initialFailure = new Error('Private artifact directory is unavailable.');
		const emit = jest.fn();
		const transport: CommandLatencySmokeTransport = { emit };
		const restore = jest.fn();

		const result = await runCommandLatencySmokeTrial(createOptions(transport, evidenceStore, { restore }));

		expect(emit).not.toHaveBeenCalled();
		expect(restore).not.toHaveBeenCalled();
		expect(result.artifact.trial).toMatchObject({
			requestId: 'trial-request-id',
			dispatchAttempted: false,
			emittedRequestId: null,
			acknowledgement: { outcome: 'not-dispatched' },
		});
		expect(result.artifact.failures.original).toEqual({
			kind: 'evidence-initialization',
			message: 'Private artifact directory is unavailable.',
		});
		expect(result.artifact.evidence).toEqual({ initialPersisted: false, finalPersisted: true, valid: false });
	});

	it('finalizes a runner setup exception without attempting a command', async () => {
		const evidenceStore = new MemoryEvidenceStore();
		const emit = jest.fn();
		const transport: CommandLatencySmokeTransport = { emit };
		const restore = jest.fn();

		const result = await runCommandLatencySmokeTrial(
			createOptions(transport, evidenceStore, {
				createCommand: () => {
					throw new Error('Private payload preparation failed.');
				},
				restore,
			}),
		);

		expect(emit).not.toHaveBeenCalled();
		expect(restore).not.toHaveBeenCalled();
		expect(result.artifact.trial.acknowledgement).toEqual({
			outcome: 'runner-exception',
			envelope: null,
			handlerResult: null,
			failureReason: 'Private payload preparation failed.',
		});
		expect(result.artifact.failures.original).toEqual({
			kind: 'runner-exception',
			message: 'Private payload preparation failed.',
		});
	});

	it('preserves the original failure when restoration also fails', async () => {
		const evidenceStore = new MemoryEvidenceStore();
		const transport: CommandLatencySmokeTransport = {
			emit: jest.fn().mockResolvedValue({ status: 'error', results: [] }),
		};

		const result = await runCommandLatencySmokeTrial(
			createOptions(transport, evidenceStore, {
				restore: () => Promise.reject(new Error('Restoration command was not acknowledged.')),
			}),
		);

		expect(result.artifact.failures).toEqual({
			original: { kind: 'rejected-acknowledgement', message: 'Command acknowledgement status is not ok.' },
			cleanup: { kind: 'restoration', message: 'Restoration command was not acknowledged.' },
			acknowledgementPersistence: null,
			finalization: null,
		});
		expect(result.artifact.cleanup).toMatchObject({
			correlationId: 'cleanup-request-id',
			attempted: true,
			restored: false,
		});
	});

	it('does not let finalization failure prevent restoration or erase the original failure', async () => {
		const evidenceStore = new MemoryEvidenceStore();
		evidenceStore.finalFailure = new Error('Final evidence write failed.');
		const transport: CommandLatencySmokeTransport = {
			emit: jest.fn().mockResolvedValue({ status: 'error', results: [] }),
		};
		const restore = jest.fn().mockResolvedValue({ restored: true });

		const result = await runCommandLatencySmokeTrial(createOptions(transport, evidenceStore, { restore }));

		expect(restore).toHaveBeenCalledWith({ correlationId: 'cleanup-request-id', trialRequestId: 'trial-request-id' });
		expect(result.artifact.failures).toEqual({
			original: { kind: 'rejected-acknowledgement', message: 'Command acknowledgement status is not ok.' },
			cleanup: null,
			acknowledgementPersistence: null,
			finalization: { kind: 'evidence-finalization', message: 'Final evidence write failed.' },
		});
		expect(result.artifact.evidence).toEqual({ initialPersisted: true, finalPersisted: false, valid: false });
	});
});
