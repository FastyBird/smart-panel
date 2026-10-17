import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';

import { Injectable, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { hasCurrentSqliteConnectionLease, registerSqliteCommitGuard, SqliteCommitGuardReceipt, SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { getEnvValue } from '../../../common/utils/config.utils';
import {
	climateAutomationCanonical,
	climateAutomationJson,
	ClimateAutomationCapturedRegistration,
	ClimateAutomationProducer,
	ClimateAutomationProvider,
	ClimateAutomationCommittedOutcome,
	ClimateAutomationConflictReason,
	ClimateAutomationControllerFacts,
	ClimateAutomationHandle,
	ClimateAutomationJson,
	ClimateAutomationScope,
	ClimateAutomationSelection,
	ClimateAutomationSlotFacts,
	ClimateAutomationSourceFacts,
	ClimateAutomationWriteError,
} from '../contracts/climate-automation.contract';
import { CLIMATE_SLOT_TABLE, ClimateAutomationSlotEntity, ClimateAutomationSourceEntity } from '../entities/climate-automation.entity';

import { ClimateAutomationRegistryService } from './climate-automation.registry.service';
import { DeviceStructureLockService } from './device-structure-lock.service';

type Phase = 'OPENING' | 'RESERVING' | 'BODY_OPEN' | 'DRAINING' | 'FINALIZING' | 'READY_TO_COMMIT' | 'SETTLED';
interface Operation {
	phase: Phase;
	readonly scope: ClimateAutomationScope;
	manager?: EntityManager;
	runner?: QueryRunner;
	receipt?: SqliteCommitGuardReceipt;
	tail: Promise<void>;
	readonly callbacks: Promise<void>[];
	pending: number;
	mutationEpoch: number;
	frozenEpoch: number;
	failure?: { cause: unknown };
	readonly guards: Array<() => boolean>;
	readonly issued: Set<ClimateAutomationHandle>;
}
interface Context { readonly operation: Operation; readonly internal: boolean; }
interface Snapshot {
	readonly source?: { readonly key: { producerKey: string; subjectId: string }; readonly value: ClimateAutomationSourceFacts | null };
	readonly slot?: { readonly controllerId: string; readonly value: ClimateAutomationSlotFacts | null };
	readonly controller?: { readonly providerKey: string; readonly controllerId: string; readonly value: ClimateAutomationControllerFacts | null; readonly capture: ClimateAutomationCapturedRegistration<ClimateAutomationProvider> };
	readonly producer?: { readonly value: ClimateAutomationSourceFacts; readonly capture: ClimateAutomationCapturedRegistration<ClimateAutomationProducer> };
}
interface HandleRecord extends Snapshot { readonly operation: Operation; readonly changed: boolean; }
class Conflict extends Error {
	constructor(readonly reason: ClimateAutomationConflictReason) { super('Private climate ownership conflict'); }
}
class PrivateShell { toJSON(): Readonly<Record<string, never>> { return {}; } }
const shell = () => Object.freeze(new PrivateShell());
const same = (a: unknown, b: unknown) => climateAutomationCanonical(a) === climateAutomationCanonical(b);
const uuid = (value: string) => {
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Conflict('invalid');
	return value;
};
const increment = (value: number) => {
	if (!Number.isSafeInteger(value) || value < 1 || value === Number.MAX_SAFE_INTEGER) throw new Conflict('invalid');
	return value + 1;
};

/**
 * Dormant trusted protocol, not an EntityManager sandbox. Participating ledger/source/config writes
 * must use tracked CAS commands; provider validation is same-manager read-only. Only the explicit
 * trusted creation callback may create its config. Raw subscriber writes/untracked SQL are forbidden
 * protocol bypasses, not claimed detected by the pure guard. Audit every future route before enabling.
 * No bootstrap/recovery hooks, production producer/provider registration or LIVE transition.
 */
@Injectable()
export class ClimateAutomationWriterService {
	private readonly context = new AsyncLocalStorage<Context>();
	private readonly scopes = new WeakMap<ClimateAutomationScope, Operation>();
	private readonly handles = new WeakMap<ClimateAutomationHandle, HandleRecord>();
	constructor(
		private readonly dataSource: DataSource,
		private readonly structureLock: DeviceStructureLockService,
		private readonly registry: ClimateAutomationRegistryService,
		@Optional() private readonly configService: NestConfigService = new NestConfigService(),
	) {}

	async runReserved(work: (manager: EntityManager, scope: ClimateAutomationScope) => Promise<ClimateAutomationSelection>): Promise<ClimateAutomationCommittedOutcome> {
		if (getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on') throw new ClimateAutomationWriteError('not_started', new Error('CLI writer unavailable'));
		const ambient = this.context.getStore();
		if (ambient) throw this.refuse(ambient.operation);
		if (!(this.dataSource instanceof SqliteDataSource) || hasCurrentSqliteConnectionLease(this.dataSource)) {
			throw new ClimateAutomationWriteError('not_started', new Error('An independent coordinated writer lease is required'));
		}
		return this.structureLock.runExclusive(async () => {
			const operation: Operation = { phase: 'OPENING', scope: shell(), tail: Promise.resolve(), callbacks: [], pending: 0, mutationEpoch: 0, frozenEpoch: 0, guards: [], issued: new Set() };
			this.scopes.set(operation.scope, operation);
			return this.context.run({ operation, internal: false }, async () => {
				try {
					const result = await this.dataSource.transaction(async (manager) => {
						operation.manager = manager;
						operation.runner = manager.queryRunner;
						operation.receipt = registerSqliteCommitGuard(manager, () =>
							operation.phase === 'READY_TO_COMMIT' && operation.pending === 0 && !operation.failure &&
							operation.mutationEpoch === operation.frozenEpoch && operation.guards.every((guard) => guard()));
						operation.phase = 'RESERVING';
						await manager.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET "slotRevision" = "slotRevision" WHERE 0`);
						this.assertHealthy(operation);
						operation.phase = 'BODY_OPEN';
						let selected: ClimateAutomationSelection | undefined;
						try { selected = await work(manager, operation.scope); }
						catch (cause) { this.fail(operation, cause); }
						operation.phase = 'DRAINING';
						await Promise.all(operation.callbacks);
						await operation.tail;
						this.assertHealthy(operation);
						if (!selected) throw new Conflict('invalid');
						const records = this.selection(operation, selected);
						operation.phase = 'FINALIZING';
						await this.context.run({ operation, internal: true }, async () => {
							for (const record of records) await this.validateSnapshot(manager, record);
						});
						this.assertHealthy(operation);
						operation.frozenEpoch = operation.mutationEpoch;
						operation.phase = 'READY_TO_COMMIT';
						const outcome: ClimateAutomationCommittedOutcome = Object.freeze({
							outcome: operation.mutationEpoch > 0 ? 'applied' : 'unchanged',
							items: Object.freeze(records.map((record) => Object.freeze({ outcome: record.changed ? 'applied' : 'unchanged' }))),
						});
						return outcome;
					});
					if (operation.receipt?.outcome !== 'committed') throw new Error('Missing acknowledged ownership COMMIT');
					return result;
				} catch (cause) {
					const receipt = operation.receipt?.outcome;
					if (cause instanceof Conflict && receipt === 'rolled_back') return Object.freeze({ outcome: 'conflict', reason: cause.reason });
					const outcome = receipt === 'committed' || receipt === 'unknown' || receipt === 'refused' || receipt === 'rolled_back' ? receipt : 'not_started';
					throw new ClimateAutomationWriteError(outcome, cause);
				} finally {
					operation.phase = 'SETTLED';
					this.scopes.delete(operation.scope);
					for (const handle of operation.issued) this.handles.delete(handle);
					operation.issued.clear(); operation.callbacks.length = 0; operation.guards.length = 0;
					operation.tail = Promise.resolve(); operation.manager = undefined; operation.runner = undefined;
				}
			});
		});
	}

	inReservedManager(manager: EntityManager, scope: ClimateAutomationScope, work: () => Promise<ClimateAutomationSelection>): Promise<ClimateAutomationSelection> {
		const operation = this.admit(manager, scope);
		operation.pending++;
		// Record before invoking the callback; a settled/caught failure remains attached to this operation.
		const promise = Promise.resolve().then(work);
		const settled = promise.then(() => { operation.pending--; }, (cause: unknown) => { operation.pending--; this.fail(operation, cause); });
		operation.callbacks.push(settled);
		return promise;
	}

	addOriginalCommitGuard(manager: EntityManager, scope: ClimateAutomationScope, guard: () => boolean): void {
		this.admit(manager, scope).guards.push(guard);
	}

	readSource(manager: EntityManager, scope: ClimateAutomationScope, producerKey: string, subjectId: string): Promise<ClimateAutomationHandle> {
		return this.command(manager, scope, async (operation) => this.handle(operation, { source: { key: { producerKey, subjectId }, value: await this.source(manager, producerKey, subjectId) } }, false));
	}
	readSlot(manager: EntityManager, scope: ClimateAutomationScope, controllerId: string, withController = false): Promise<ClimateAutomationHandle> {
		return this.command(manager, scope, async (operation) => {
			const value = await this.slot(manager, controllerId);
			const capture = value && withController ? this.registry.captureProvider(value.providerKey) : null;
			if (capture && value) {
				operation.guards.push(capture.isCurrent);
				const facts = await capture.implementation.readControllerInManager(manager, controllerId);
				return this.handle(operation, { slot: { controllerId, value }, controller: { providerKey: value.providerKey, controllerId, value: this.controllerFacts(facts), capture } }, false);
			}
			return this.handle(operation, { slot: { controllerId, value } }, false);
		});
	}

	stageSource(manager: EntityManager, scope: ClimateAutomationScope, request: { producerKey: string; subjectId: string; expected: ClimateAutomationHandle; evidence: ClimateAutomationJson }): Promise<ClimateAutomationHandle> {
		return this.ownedCommand(manager, scope, () => {
			const { producerKey, subjectId, expected, evidence } = request;
			const evidenceBytes = climateAutomationCanonical(evidence);
			return Object.freeze({ producerKey, subjectId, expected, evidenceBytes, evidenceDigest: createHash('sha256').update(evidenceBytes).digest('hex') });
		}, async (operation, owned) => {
			const record = this.record(operation, owned.expected);
			if (!record.source || record.source.key.producerKey !== owned.producerKey || record.source.key.subjectId !== owned.subjectId) throw new Conflict('invalid');
			await this.validateSnapshot(manager, record);
			const previous = record.source.value;
			if (previous && !['REVOKED','DELETED','FINALIZED_INACTIVE'].includes(previous.state)) throw new Conflict('stale');
			if (previous && await manager.countBy(ClimateAutomationSlotEntity, { generationId: previous.generationId, state: 'PROVISIONAL' }) > 0) throw new Conflict('stale');
			if (previous && await manager.countBy(ClimateAutomationSlotEntity, { generationId: previous.generationId, state: 'LIVE' }) > 0) throw new Conflict('stale');
			const capture = this.registry.captureProducer(owned.producerKey);
			if (!capture) throw new Conflict('unavailable');
			operation.guards.push(capture.isCurrent);
			const source: ClimateAutomationSourceFacts = Object.freeze({
				generationId: randomUUID(), ownerId: previous && previous.state !== 'DELETED' ? previous.ownerId : randomUUID(),
				producerKey: owned.producerKey, subjectId: owned.subjectId,
				generationIndex: previous && previous.state !== 'DELETED' ? increment(previous.generationIndex) : 1,
				revision: 1, isCurrent: true, state: 'PENDING', evidence: owned.evidenceBytes, evidenceDigest: owned.evidenceDigest,
			});
			const actual = await capture.implementation.validateInManager(manager, source, 'prepare');
			if (actual === null || climateAutomationCanonical(actual) !== source.evidence) throw new Conflict('stale');
			if (previous) await this.updateSource(manager, previous, { ...previous, revision: increment(previous.revision), isCurrent: false });
			await manager.insert(ClimateAutomationSourceEntity, source);
			operation.mutationEpoch++;
			return this.handle(operation, { source: { key: record.source.key, value: source }, producer: { value: source, capture } }, true);
		});
	}

	initializeSlot(manager: EntityManager, scope: ClimateAutomationScope, request: { providerKey: string; controllerId: string; expected: ClimateAutomationHandle; configuration: ClimateAutomationJson }): Promise<ClimateAutomationHandle> {
		return this.ownedCommand(manager, scope, () => {
			const { providerKey, controllerId, expected, configuration } = request;
			const configurationBytes = climateAutomationCanonical(configuration);
			const parsed: unknown = JSON.parse(configurationBytes);
			return Object.freeze({ providerKey, controllerId, expected, configuration: climateAutomationJson(parsed) });
		}, async (operation, owned) => {
			uuid(owned.controllerId);
			const record = this.record(operation, owned.expected);
			if (!record.slot || record.slot.controllerId !== owned.controllerId) throw new Conflict('invalid');
			await this.validateSnapshot(manager, record);
			const previous = record.slot.value;
			if (previous && !['EMPTY','LEGACY','RETIRED'].includes(previous.state)) throw new Conflict('stale');
			const capture = this.registry.captureProvider(owned.providerKey);
			if (!capture) throw new Conflict('unavailable');
			operation.guards.push(capture.isCurrent);
			if (await capture.implementation.readControllerInManager(manager, owned.controllerId)) throw new Conflict('uninitialized');
			await capture.implementation.createControllerInManager(manager, owned.controllerId, owned.configuration);
			operation.mutationEpoch++;
			const facts = this.controllerFacts(await capture.implementation.readControllerInManager(manager, owned.controllerId));
			if (!facts || facts.legacyBaseline !== null) throw new Conflict('invalid');
			const slot: ClimateAutomationSlotFacts = Object.freeze({
				controllerId: owned.controllerId, providerKey: owned.providerKey, controllerIncarnation: randomUUID(), slotRevision: previous ? increment(previous.slotRevision) : 1,
				manualGeneration: randomUUID(), manualCounter: previous ? increment(previous.manualCounter) : 1, manualHold: false, state: 'EMPTY',
				ownerId: null, baselineId: null, generationId: null, candidateId: null, bundleId: null, selection: null, installEvidence: null, legacyDigest: null,
			});
			if (previous) await this.updateSlot(manager, previous, slot);
			else await manager.insert(ClimateAutomationSlotEntity, slot);
			operation.mutationEpoch++;
			return this.handle(operation, { slot: { controllerId: owned.controllerId, value: slot }, controller: { providerKey: owned.providerKey, controllerId: owned.controllerId, value: facts, capture } }, true);
		});
	}

	stageSlot(manager: EntityManager, scope: ClimateAutomationScope, request: { expectedSlot: ClimateAutomationHandle; expectedSource: ClimateAutomationHandle; selection: ClimateAutomationJson; bundleId: string }): Promise<ClimateAutomationHandle> {
		return this.ownedCommand(manager, scope, () => {
			const { expectedSlot, expectedSource, selection, bundleId } = request;
			const selectionBytes = climateAutomationCanonical(selection);
			const parsed: unknown = JSON.parse(selectionBytes);
			return Object.freeze({ expectedSlot, expectedSource, bundleId, selectionBytes, selection: climateAutomationJson(parsed) });
		}, async (operation, owned) => {
			const slotRecord = this.record(operation, owned.expectedSlot);
			const sourceRecord = this.record(operation, owned.expectedSource);
			await this.validateSnapshot(manager, slotRecord);
			await this.validateSnapshot(manager, sourceRecord);
			const previous = slotRecord.slot?.value;
			const source = sourceRecord.source?.value;
			if (!previous) throw new Conflict('uninitialized');
			if (!source || !source.isCurrent || source.state !== 'PENDING' || !['EMPTY','RETIRED'].includes(previous.state)) throw new Conflict('stale');
			const producer = this.registry.captureProducer(source.producerKey);
			const provider = this.registry.captureProvider(previous.providerKey);
			if (!producer || !provider || !slotRecord.controller?.value) throw new Conflict('unavailable');
			operation.guards.push(producer.isCurrent, provider.isCurrent);
			const actual = await producer.implementation.validateInManager(manager, source, 'prepare');
			if (actual === null || climateAutomationCanonical(actual) !== source.evidence) throw new Conflict('stale');
			const facts = slotRecord.controller.value;
			if (!await provider.implementation.validateSelectionInManager(manager, previous.controllerId, facts, owned.selection)) throw new Conflict('invalid');
			const next: ClimateAutomationSlotFacts = Object.freeze({ ...previous, state: 'PROVISIONAL', slotRevision: increment(previous.slotRevision), ownerId: source.ownerId, generationId: source.generationId, baselineId: randomUUID(), candidateId: randomUUID(), bundleId: uuid(owned.bundleId), selection: owned.selectionBytes, installEvidence: climateAutomationCanonical(facts), legacyDigest: null });
			await this.updateSlot(manager, previous, next, source);
			operation.mutationEpoch++;
			return this.handle(operation, { slot: { controllerId: previous.controllerId, value: next }, source: sourceRecord.source, controller: slotRecord.controller, producer: { value: source, capture: producer } }, true);
		});
	}

	retireSlot(manager: EntityManager, scope: ClimateAutomationScope, expectedSlot: ClimateAutomationHandle, expectedSource: ClimateAutomationHandle): Promise<ClimateAutomationHandle> {
		return this.command(manager, scope, async (operation) => {
			const slotRecord = this.record(operation, expectedSlot);
			const sourceRecord = this.record(operation, expectedSource);
			// Retirement deliberately needs neither loaded provider nor registered source producer.
			await this.validateLedgerSnapshot(manager, slotRecord);
			await this.validateLedgerSnapshot(manager, sourceRecord);
			const previous = slotRecord.slot?.value;
			const source = sourceRecord.source?.value;
			if (!previous || !source || previous.ownerId !== source.ownerId || previous.generationId !== source.generationId || !['PROVISIONAL','LIVE','RETIRED'].includes(previous.state)) throw new Conflict('stale');
			if (previous.state === 'RETIRED') return this.handle(operation, { slot: slotRecord.slot, source: sourceRecord.source }, false);
			const next: ClimateAutomationSlotFacts = Object.freeze({ ...previous, state: 'RETIRED', slotRevision: increment(previous.slotRevision) });
			await this.updateSlot(manager, previous, next, source);
			operation.mutationEpoch++;
			return this.handle(operation, { slot: { controllerId: previous.controllerId, value: next }, source: sourceRecord.source }, true);
		});
	}

	revokeSource(manager: EntityManager, scope: ClimateAutomationScope, expectedSource: ClimateAutomationHandle, slots: readonly ClimateAutomationHandle[], deleted = false): Promise<ClimateAutomationHandle> {
		return this.ownedCommand(manager, scope, () => Object.freeze({ expectedSource, slots: Object.freeze([...slots]), deleted }), async (operation, owned) => {
			const record = this.record(operation, owned.expectedSource);
			await this.validateLedgerSnapshot(manager, record);
			const sourceSnapshot = record.source;
			const previous = sourceSnapshot?.value;
			if (!sourceSnapshot || !previous || !previous.isCurrent) throw new Conflict('stale');
			const rows = await manager.findBy(ClimateAutomationSlotEntity, { ownerId: previous.ownerId, generationId: previous.generationId });
			const active = rows.filter((row) => row.state === 'LIVE' || row.state === 'PROVISIONAL');
			const expected = owned.slots.map((handle) => this.record(operation, handle).slot?.value);
			if (active.length !== expected.length || active.some((row) => !expected.some((value) => value && same(this.slotFacts(row), value)))) throw new Conflict('stale');
			for (const row of active) {
				const old = this.slotFacts(row);
				await this.updateSlot(manager, old, { ...old, state: 'RETIRED', slotRevision: increment(old.slotRevision) }, previous);
				operation.mutationEpoch++;
			}
			const state = owned.deleted ? 'DELETED' : 'REVOKED';
			if (previous.state === state && active.length === 0) return this.handle(operation, { source: record.source }, false);
			const next: ClimateAutomationSourceFacts = Object.freeze({ ...previous, state, revision: increment(previous.revision) });
			await this.updateSource(manager, previous, next);
			operation.mutationEpoch++;
			return this.handle(operation, { source: { key: sourceSnapshot.key, value: next } }, true);
		});
	}

	private admit(manager: EntityManager, scope: ClimateAutomationScope): Operation {
		const context = this.context.getStore();
		const operation = this.scopes.get(scope);
		if (!operation || context?.operation !== operation) {
			if (context) throw this.refuse(context.operation);
			throw new Error('Invalid private climate writer scope');
		}
		if (operation.manager !== manager || manager.queryRunner !== operation.runner || context.internal || operation.phase !== 'BODY_OPEN' || !!operation.failure || !hasCurrentSqliteConnectionLease(this.dataSource)) throw this.refuse(operation);
		return operation;
	}
	private ownedCommand<Input>(manager: EntityManager, scope: ClimateAutomationScope, snapshot: () => Input, work: (operation: Operation, input: Input) => Promise<ClimateAutomationHandle>): Promise<ClimateAutomationHandle> {
		// Admission must precede every caller getter/JSON traversal, including invalid closed-phase calls.
		const operation = this.admit(manager, scope);
		let input: Input;
		try { input = snapshot(); }
		catch (cause) { this.fail(operation, cause); throw cause; }
		return this.enqueue(operation, () => work(operation, input));
	}
	private command(manager: EntityManager, scope: ClimateAutomationScope, work: (operation: Operation) => Promise<ClimateAutomationHandle>): Promise<ClimateAutomationHandle> {
		const operation = this.admit(manager, scope);
		return this.enqueue(operation, () => work(operation));
	}
	private enqueue(operation: Operation, work: () => Promise<ClimateAutomationHandle>): Promise<ClimateAutomationHandle> {
		operation.pending++;
		const task = operation.tail.then(() => {
			this.assertHealthy(operation);
			return this.context.run({ operation, internal: true }, work);
		});
		operation.tail = task.then(() => { operation.pending--; }, (cause: unknown) => { operation.pending--; this.fail(operation, cause); });
		return task;
	}
	private fail(operation: Operation, cause: unknown): void { operation.failure ??= { cause }; }
	private refuse(operation: Operation): Error {
		const error = new Error('Private climate business admission is closed or requires its explicit original scope');
		if (operation.phase !== 'SETTLED') this.fail(operation, error);
		return error;
	}
	private assertHealthy(operation: Operation): void { if (operation.failure) throw operation.failure.cause; }
	private handle(operation: Operation, snapshot: Snapshot, changed: boolean): ClimateAutomationHandle {
		const handle = shell();
		this.handles.set(handle, Object.freeze({ ...snapshot, operation, changed }));
		operation.issued.add(handle);
		return handle;
	}
	private record(operation: Operation, handle: ClimateAutomationHandle): HandleRecord {
		const record = this.handles.get(handle);
		if (!record || record.operation !== operation) throw new Conflict('invalid');
		return record;
	}
	private selection(operation: Operation, selected: ClimateAutomationSelection): HandleRecord[] {
		if (Array.isArray(selected)) {
			if (selected.length === 0) throw new Conflict('invalid');
			return selected.map((handle: ClimateAutomationHandle) => this.record(operation, handle));
		}
		if (selected instanceof PrivateShell) return [this.record(operation, selected)];
		throw new Conflict('invalid');
	}
	private async source(manager: EntityManager, producerKey: string, subjectId: string): Promise<ClimateAutomationSourceFacts | null> {
		const row = await manager.findOneBy(ClimateAutomationSourceEntity, { producerKey, subjectId, isCurrent: true });
		return row ? this.sourceFacts(row) : null;
	}
	private async slot(manager: EntityManager, controllerId: string): Promise<ClimateAutomationSlotFacts | null> {
		const row = await manager.findOneBy(ClimateAutomationSlotEntity, { controllerId });
		return row ? this.slotFacts(row) : null;
	}
	private sourceFacts(row: ClimateAutomationSourceFacts): ClimateAutomationSourceFacts {
		return Object.freeze({ generationId: row.generationId, ownerId: row.ownerId, producerKey: row.producerKey, subjectId: row.subjectId, generationIndex: row.generationIndex, revision: row.revision, isCurrent: row.isCurrent, state: row.state, evidence: row.evidence, evidenceDigest: row.evidenceDigest });
	}
	private slotFacts(row: ClimateAutomationSlotFacts): ClimateAutomationSlotFacts {
		return Object.freeze({ controllerId: row.controllerId, providerKey: row.providerKey, controllerIncarnation: row.controllerIncarnation, slotRevision: row.slotRevision, manualGeneration: row.manualGeneration, manualCounter: row.manualCounter, manualHold: row.manualHold, state: row.state, ownerId: row.ownerId, baselineId: row.baselineId, generationId: row.generationId, candidateId: row.candidateId, bundleId: row.bundleId, selection: row.selection, installEvidence: row.installEvidence, legacyDigest: row.legacyDigest });
	}
	private controllerFacts(facts: ClimateAutomationControllerFacts | null): ClimateAutomationControllerFacts | null {
		if (!facts) return null;
		if (!Number.isSafeInteger(facts.controllerRevision) || facts.controllerRevision < 1 || !Number.isSafeInteger(facts.graphRevision) || facts.graphRevision < 0) throw new Conflict('invalid');
		// Freeze serialized evidence now; later mutation of provider-owned objects cannot change a capture.
		const evidence = climateAutomationJson(facts.evidence);
		const legacyBaseline = climateAutomationJson(facts.legacyBaseline);
		return Object.freeze({ controllerRevision: facts.controllerRevision, graphRevision: facts.graphRevision, evidence, legacyBaseline });
	}
	private async validateLedgerSnapshot(manager: EntityManager, snapshot: Snapshot): Promise<void> {
		if (snapshot.source && !same(snapshot.source.value, await this.source(manager, snapshot.source.key.producerKey, snapshot.source.key.subjectId))) throw new Conflict('stale');
		if (snapshot.slot && !same(snapshot.slot.value, await this.slot(manager, snapshot.slot.controllerId))) throw new Conflict('stale');
	}
	private async validateSnapshot(manager: EntityManager, snapshot: Snapshot): Promise<void> {
		await this.validateLedgerSnapshot(manager, snapshot);
		if (snapshot.controller) {
			const capture = snapshot.controller.capture;
			if (!capture.isCurrent()) throw new Conflict('unavailable');
			const facts = this.controllerFacts(await capture.implementation.readControllerInManager(manager, snapshot.controller.controllerId));
			if (!same(facts, snapshot.controller.value)) throw new Conflict('stale');
		}
		if (snapshot.producer) {
			const { capture, value } = snapshot.producer;
			if (!capture.isCurrent()) throw new Conflict('unavailable');
			const actual = await capture.implementation.validateInManager(manager, value, 'prepare');
			if (actual === null || climateAutomationCanonical(actual) !== value.evidence) throw new Conflict('stale');
		}
	}
	private async updateSource(manager: EntityManager, expected: ClimateAutomationSourceFacts, next: ClimateAutomationSourceFacts): Promise<void> {
		const query = manager.createQueryBuilder().update(ClimateAutomationSourceEntity).set(next);
		for (const column of Object.keys(expected)) {
			const value: unknown = Reflect.get(expected, column);
			query.andWhere(`"${column}" IS :source_${column}`, { [`source_${column}`]: value });
		}
		if ((await query.execute()).affected !== 1) throw new Conflict('stale');
	}
	private async updateSlot(manager: EntityManager, expected: ClimateAutomationSlotFacts, next: ClimateAutomationSlotFacts, source?: ClimateAutomationSourceFacts): Promise<void> {
		const query = manager.createQueryBuilder().update(ClimateAutomationSlotEntity).set(next);
		for (const column of Object.keys(expected)) {
			const value: unknown = Reflect.get(expected, column);
			query.andWhere(`"${column}" IS :slot_${column}`, { [`slot_${column}`]: value });
		}
		if (source) {
			const clauses: string[] = [];
			const parameters: Record<string, unknown> = {};
			for (const column of Object.keys(source)) {
				const value: unknown = Reflect.get(source, column);
				clauses.push(`s."${column}" IS :fence_${column}`);
				parameters[`fence_${column}`] = value;
			}
			query.andWhere(`EXISTS (SELECT 1 FROM "devices_module_climate_automation_sources" s WHERE ${clauses.join(' AND ')})`, parameters);
		}
		if ((await query.execute()).affected !== 1) throw new Conflict('stale');
	}
}
