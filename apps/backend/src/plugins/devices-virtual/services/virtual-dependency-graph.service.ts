import { DataSource, EntityManager, IsNull, Not } from 'typeorm';

import { Injectable, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { getEnvValue } from '../../../common/utils/config.utils';
import {
	ClimateAutomationAcknowledgedJob,
	ClimateAutomationGraphDelta,
	ClimateAutomationGraphFacts,
	ClimateAutomationGraphValidation,
	ClimateAutomationParticipantConflict,
	ClimateAutomationParticipantTurn,
	ClimateAutomationValidationReason,
	ClimateAutomationValidationTicket,
	climateAutomationCanonical,
} from '../../../modules/devices/contracts/climate-automation.contract';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { ClimateAutomationWriterService } from '../../../modules/devices/services/climate-automation-writer.service';
import { ObservedProducerBatch, OwnedProducerPublisher, OwnedProducerEngine, OwnedPublicationReport, PreparedProducerBatch, PropertyProducerGuard, PropertyProducerRegistryService, ownedProducerMethodCurrent } from '../../../modules/devices/services/property-producer.registry.service';
import { DEVICES_VIRTUAL_PLUGIN_NAME } from '../devices-virtual.constants';
import { VirtualChannelPropertyEntity, VirtualValueOrigin } from '../entities/devices-virtual.entity';
import { VirtualDewPointSourceEntity } from '../entities/virtual-dew-point.entity';
import {
	VirtualAggregateConfigEntity,
	VirtualAggregateInputEntity,
	VirtualGraphRevisionEntity,
	VirtualLightGroupBindingEntity,
	VirtualLightGroupConfigEntity,
} from '../entities/virtual-producer.entity';
import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';

import { aggregateProfile, isEligibleAggregateOutput } from './virtual-numeric-profile.utils';

export interface VirtualDependencyEdge {
	outputPropertyId: string;
	sourcePropertyId: string;
}

export interface OwnedGraphLifecycle {
	readonly isCurrent: () => boolean;
	readonly guard: PropertyProducerGuard;
}
export interface OwnedGraphStageView {
	readonly revision: number;
	readonly quarantined: ReadonlySet<string>;
	readonly properties: readonly VirtualChannelPropertyEntity[];
	readonly configurationRevisions: readonly Readonly<{ propertyId: string; revision: number }>[];
}
export interface OwnedGraphStage {
	readonly batch: ObservedProducerBatch;
	readonly prepared: PreparedProducerBatch;
}
export interface OwnedGraphStagerV1 {
	readonly version: 1;
	readonly stage: (view: OwnedGraphStageView, lifecycle: OwnedGraphLifecycle) => Promise<OwnedGraphStage>;
}
export class OwnedGraphRegistration { toJSON(): Readonly<Record<string, never>> { return {}; } }
interface OwnedGraphRegistrationRecord {
	active: boolean;
	readonly registry: PropertyProducerRegistryService;
	readonly engine: OwnedProducerEngine;
	readonly owner: OwnedProducerPublisher;
	readonly capability: OwnedGraphStagerV1;
	readonly stage: OwnedGraphStagerV1['stage'];
	readonly receiver: object;
	readonly options: Readonly<{ requiresActivation: false }>;
	lastReport?: OwnedPublicationReport;
}
interface OwnedGraphWork { readonly generation: number; readonly registration: OwnedGraphRegistrationRecord; readonly stage: OwnedGraphStage; }
class OwnedGraphPublicationError extends Error {
	constructor() { super('Owned graph publication incomplete'); }
	toJSON(): Readonly<Record<string, never>> { return {}; }
}

class GuardedValidationShell {
	toJSON(): Readonly<Record<string, never>> {
		return {};
	}
}

/** Database writer reservation precedes all graph validation, including across independent processes. */
@Injectable()
export class VirtualDependencyGraphService implements OnApplicationBootstrap {
	private readonly ownedRegistrations = new Set<OwnedGraphRegistrationRecord>();
	private readonly ownedHandles = new WeakMap<OwnedGraphRegistration, OwnedGraphRegistrationRecord>();
	private quarantined = new Set<string>();
	private liveValueProperties = new Set<string>();
	private knownProperties = new Set<string>();
	private valueSources = new Map<string, { valueOrigin: VirtualValueOrigin; sourcePropertyId: string | null }>();
	private readonly validationListeners = new Map<
		(revision: number, quarantined: ReadonlySet<string>) => Promise<void>,
		{ requiresActivation?: boolean }
	>();
	private readonly validationTickets = new WeakMap<ClimateAutomationValidationTicket, number>();
	private readonly guardedListeners = new Set<{
		readonly listener: (view: Readonly<{ revision: number; quarantinedIds: readonly string[] }>) => Promise<void>;
		readonly options: { requiresActivation?: boolean };
	}>();
	private quarantineRevision = -1;
	// Module initialization may install leases before bootstrap validates the durable graph.
	private validationPending = true;
	private validationGeneration = 0;
	private readonly logger = createExtensionLogger(DEVICES_VIRTUAL_PLUGIN_NAME, 'VirtualDependencyGraphService');

	constructor(
		private readonly dataSource: DataSource,
		@Optional() private readonly configService: NestConfigService = new NestConfigService(),
		@Optional() private readonly writer?: ClimateAutomationWriterService,
	) {}

	/** Synchronous structural-event fence; a settled owner must refresh after commit or rollback. */
	invalidateValidation(): void {
		this.validationGeneration++;
		this.validationPending = true;
	}

	/** Applies committed validation before returning; runtime evaluation waits for the caller's activation events. */
	async withStructuralWrite<T>(
		operation: (manager: EntityManager) => Promise<T>,
		expectedGraphRevision?: number,
	): Promise<T> {
		// The caller already owns DeviceStructureLockService. Never acquire another lock from this transaction.
		const result = await this.dataSource.transaction(async (manager) => {
			// Even an ignored INSERT reserves SQLite's writer slot before a validation read. This also
			// initializes synchronized databases, which do not run the migration's singleton seed.
			await manager.query('INSERT OR IGNORE INTO "devices_virtual_graph_revision" ("id", "revision") VALUES (1, 0)');
			const current = await manager.findOneByOrFail(VirtualGraphRevisionEntity, { id: 1 });
			if (expectedGraphRevision !== undefined && current.revision !== expectedGraphRevision) {
				throw new DevicesValidationException('Virtual dependency graph revision changed; reload and retry.');
			}
			await manager.increment(VirtualGraphRevisionEntity, { id: 1 }, 'revision', 1);
			return operation(manager);
		});
		try {
			await this.refreshValidation(false);
		} catch (error) {
			// The owning COMMIT succeeded. Returning its result allows the caller to activate the
			// persisted catalog while validation guards keep live authority unavailable until retry.
			this.logger.error(
				'Virtual structural write committed, but graph validation failed; live authority remains unavailable until validation succeeds.',
				error instanceof Error ? error : new Error('Post-commit graph validation rejected', { cause: error }),
			);
		}
		return result;
	}

	/** The applied validated graph revision, safe for an internal provider publish guard. */
	isRevisionCurrent(revision: number): boolean {
		return !this.validationPending && this.quarantineRevision === revision;
	}

	/** Whether a complete graph snapshot and every validation listener have succeeded. */
	isValidated(): boolean {
		return !this.validationPending && this.quarantineRevision >= 0;
	}

	/** Policy from the same validated metadata snapshot as the dependency graph; null while suspended. */
	propertyRequiresLiveValue(propertyId: string): boolean | null {
		return this.isValidated() && this.knownProperties.has(propertyId) ? this.liveValueProperties.has(propertyId) : null;
	}

	/** A stale bound entity cannot read an old canonical source after a committed relink. */
	matchesValueSource(property: Pick<VirtualChannelPropertyEntity, 'id' | 'valueOrigin' | 'sourcePropertyId'>): boolean {
		const source = this.valueSources.get(property.id);
		return (
			this.isValidated() &&
			!!source &&
			source.valueOrigin === (property.valueOrigin ?? VirtualValueOrigin.SOURCE) &&
			source.sourcePropertyId === (property.sourcePropertyId ?? null)
		);
	}

	/** Captures one validation lifecycle so pending publications cannot survive a failed refresh/retry. */
	capturePublishGuard(): () => boolean {
		const generation = this.validationGeneration;
		return () => this.isValidated() && generation === this.validationGeneration;
	}

	async revision(manager: EntityManager = this.dataSource.manager): Promise<number> {
		return (await manager.findOneBy(VirtualGraphRevisionEntity, { id: 1 }))?.revision ?? 0;
	}

	async edges(manager: EntityManager): Promise<VirtualDependencyEdge[]> {
		const projections = await manager
			.createQueryBuilder(VirtualChannelPropertyEntity, 'property')
			.select(['property.id', 'property.sourcePropertyId', 'property.valueOrigin'])
			.where('property.sourcePropertyId IS NOT NULL')
			.callListeners(false)
			.getMany();
		const dewPoints = await manager.find(VirtualDewPointSourceEntity, { where: { sourcePropertyId: Not(IsNull()) } });
		const transforms = await manager.find(VirtualTransformSourceEntity, { where: { sourcePropertyId: Not(IsNull()) } });
		const inputs = await manager.find(VirtualAggregateInputEntity, { where: { sourcePropertyId: Not(IsNull()) } });
		const bindings = await manager.find(VirtualLightGroupBindingEntity, { where: { sourcePropertyId: Not(IsNull()) } });
		return [
			...dewPoints.map((input) => ({
				outputPropertyId: input.outputPropertyId,
				sourcePropertyId: input.sourcePropertyId,
			})),
			...transforms.map((input) => ({
				outputPropertyId: input.outputPropertyId,
				sourcePropertyId: input.sourcePropertyId,
			})),
			...projections
				.filter((property) => property.isProjecting)
				.map((property) => ({ outputPropertyId: property.id, sourcePropertyId: property.sourcePropertyId })),
			...inputs.map((input) => ({
				outputPropertyId: input.outputPropertyId,
				sourcePropertyId: input.sourcePropertyId,
			})),
			...bindings.map((binding) => ({
				outputPropertyId: binding.outputPropertyId,
				sourcePropertyId: binding.sourcePropertyId,
			})),
		];
	}

	async validateReplacement(
		manager: EntityManager,
		outputIds: string[],
		replacements: VirtualDependencyEdge[],
	): Promise<void> {
		const replacing = new Set(outputIds);
		this.validate([
			...(await this.edges(manager)).filter((edge) => !replacing.has(edge.outputPropertyId)),
			...replacements,
		]);
	}

	async validateProperty(manager: EntityManager, property: VirtualChannelPropertyEntity): Promise<void> {
		// Updating an owned producer cannot silently erase its durable input edges.
		if (property.valueOrigin === VirtualValueOrigin.DERIVED) {
			this.validate(await this.edges(manager));
			return;
		}
		const producerInputs = await manager.count(VirtualAggregateInputEntity, {
			where: { outputPropertyId: property.id },
		});
		const groupBindings = await manager.count(VirtualLightGroupBindingEntity, {
			where: { outputPropertyId: property.id },
		});
		const transformInputs = await manager.count(VirtualTransformSourceEntity, {
			where: { outputPropertyId: property.id },
		});
		const dewPointInputs = await manager.count(VirtualDewPointSourceEntity, {
			where: { outputPropertyId: property.id },
		});
		if (producerInputs || groupBindings || transformInputs || dewPointInputs)
			throw new DevicesValidationException(
				'A configured producer output must retain derived origin; edit or remove its producer configuration first.',
			);
		await this.validateReplacement(
			manager,
			[property.id],
			property.isLinked && property.sourcePropertyId
				? [{ outputPropertyId: property.id, sourcePropertyId: property.sourcePropertyId }]
				: [],
		);
	}

	validate(edges: VirtualDependencyEdge[]): void {
		if (edges.length > 8192) throw new DevicesValidationException('Virtual dependency graph exceeds the edge limit.');
		const graph = new Map<string, Set<string>>();
		const fanOut = new Map<string, Set<string>>();
		const nodes = new Set<string>();
		for (const edge of edges) {
			nodes.add(edge.outputPropertyId);
			nodes.add(edge.sourcePropertyId);
			const inputs = graph.get(edge.outputPropertyId) ?? new Set<string>();
			inputs.add(edge.sourcePropertyId);
			graph.set(edge.outputPropertyId, inputs);
			const outputs = fanOut.get(edge.sourcePropertyId) ?? new Set<string>();
			outputs.add(edge.outputPropertyId);
			fanOut.set(edge.sourcePropertyId, outputs);
			if (outputs.size > 256)
				throw new DevicesValidationException('Virtual dependency graph exceeds the fan-out limit.');
		}
		if (nodes.size > 4096) throw new DevicesValidationException('Virtual dependency graph exceeds the node limit.');
		const depths = new Map<string, number>();
		const visiting = new Set<string>();
		const depth = (node: string): number => {
			if (visiting.size > 16) throw new DevicesValidationException('Virtual dependency graph exceeds the depth limit.');
			if (visiting.has(node))
				throw new DevicesValidationException('Virtual dependency graph contains a cycle or self-reference.');
			if (depths.has(node)) return depths.get(node);
			visiting.add(node);
			let result = 0;
			for (const input of graph.get(node) ?? []) {
				result = Math.max(result, depth(input) + 1);
				if (result > 16) throw new DevicesValidationException('Virtual dependency graph exceeds the depth limit.');
			}
			visiting.delete(node);
			depths.set(node, result);
			return result;
		};
		for (const node of nodes) depth(node);
	}

	isQuarantined(propertyId: string): boolean {
		return this.quarantined.has(propertyId);
	}

	/**
	 * Quarantine masks run before structural writers return. Evaluators that require activation must
	 * instead observe the caller's subsequent catalog events, after fresh-input barriers are installed.
	 */
	observeValidation(
		listener: (revision: number, quarantined: ReadonlySet<string>) => Promise<void>,
		options: { requiresActivation?: boolean } = {},
	): () => void {
		this.validationListeners.set(listener, options);
		return () => this.validationListeners.delete(listener);
	}

	captureOwnedPublicationLifecycle(): OwnedGraphLifecycle {
		return this.lifecycleForGeneration(this.validationGeneration);
	}
	private lifecycleForGeneration(generation: number): OwnedGraphLifecycle {
		return Object.freeze({
			isCurrent: () => generation === this.validationGeneration,
			guard: Object.freeze({
				isCurrent: () => generation === this.validationGeneration && !this.validationPending && this.quarantineRevision >= 0,
				reason: 'graph_validation_pending',
			}),
		});
	}

	observeOwnedStaging(registry: PropertyProducerRegistryService | undefined, owner: OwnedProducerPublisher,
		capability: OwnedGraphStagerV1, receiver: object, options: Readonly<{ requiresActivation: false }>): OwnedGraphRegistration {
		if (!(registry instanceof PropertyProducerRegistryService) || !registry.isOwnedPublisherCurrent(owner) ||
			this.ownedRegistrations.size || Object.getOwnPropertyDescriptor(capability, 'version')?.value !== 1 || !Object.isFrozen(capability) ||
			Object.getOwnPropertyDescriptor(capability, 'stage')?.get !== undefined || typeof Object.getOwnPropertyDescriptor(capability, 'stage')?.value !== 'function' ||
			Object.getOwnPropertyDescriptor(options, 'requiresActivation')?.value !== false ||
			!ownedProducerMethodCurrent(receiver, 'stageOwned', capability.stage)) throw new OwnedGraphPublicationError();
		const record: OwnedGraphRegistrationRecord = {
			active: true, registry, engine: registry.captureOwnedEngine(), owner, capability,
			stage: capability.stage, receiver, options,
		};
		const handle = Object.freeze(new OwnedGraphRegistration());
		this.ownedHandles.set(handle, record);
		this.ownedRegistrations.add(record);
		this.invalidateValidation();
		return handle;
	}

	disposeOwnedStaging(handle: OwnedGraphRegistration): void {
		const record = this.ownedHandles.get(handle);
		if (!record || !record.active) return;
		record.active = false;
		if (this.ownedRegistrations.delete(record)) this.invalidateValidation();
	}

	readOwnedPublicationReport(handle: OwnedGraphRegistration): OwnedPublicationReport | undefined {
		return this.ownedHandles.get(handle)?.lastReport;
	}

	private ownedCurrent(records: readonly OwnedGraphRegistrationRecord[]): boolean {
		return records.length === this.ownedRegistrations.size && records.every((record) =>
			record.active && this.ownedRegistrations.has(record) && record.capability.stage === record.stage &&
			ownedProducerMethodCurrent(record.receiver, 'stageOwned', record.stage) &&
			Object.getOwnPropertyDescriptor(record.options, 'requiresActivation')?.value === false &&
			record.engine.isOwnedEngineCurrent.call(record.registry, record.engine) &&
			record.engine.isOwnedPublisherCurrent.call(record.registry, record.owner));
	}

	private async stageOwned(snapshot: Awaited<ReturnType<VirtualDependencyGraphService['validationSnapshot']>>,
		quarantined: ReadonlySet<string>, records: readonly OwnedGraphRegistrationRecord[], work: OwnedGraphWork[], lifecycle: OwnedGraphLifecycle, generation: number): Promise<void> {
		const revisions = snapshot.properties.filter((property) => property.isDerived).map((property) => {
			const channel = typeof property.channel === 'string' ? property.channel : property.channel?.id;
			return Object.freeze({ propertyId: property.id, revision:
				snapshot.transforms.find((row) => row.outputPropertyId === property.id)?.revision ??
				snapshot.aggregates.find((row) => row.outputPropertyId === property.id)?.revision ??
				snapshot.groups.find((row) => row.groupChannelId === channel)?.revision ?? 0 });
		});
		const view: OwnedGraphStageView = Object.freeze({ revision: snapshot.revision,
			quarantined, properties: Object.freeze(snapshot.properties), configurationRevisions: Object.freeze(revisions) });
		for (const registration of records) {
			const stage = await registration.stage.call(registration.receiver, view, lifecycle);
			work.push({ registration, stage, generation });
		}
	}

	private preparedCurrent(work: readonly OwnedGraphWork[]): boolean {
		return work.every(({ registration: r, stage }) => r.engine.validatePreparedBatch.call(r.registry, stage.prepared));
	}
	private installedCurrent(work: readonly OwnedGraphWork[]): boolean {
		return work.every(({ registration: r, stage }) => r.engine.isInstalledBatchCurrent.call(r.registry, stage.prepared));
	}
	/** Called after ALL external/pure checks: concrete engine install and graph assignments only. */
	private installOwned(work: readonly OwnedGraphWork[]): boolean {
		// Single fixed producer key: at most one engine, so no partial multi-engine installation.
		if (work.length > 1) return false;
		for (const { registration: r, stage } of work)
			if (!r.engine.installPreparedNoEvents.call(r.registry, stage.prepared)) return false;
		return true;
	}
	private notifyOwned(work: readonly OwnedGraphWork[], current: () => boolean): boolean {
		for (const { registration: r, stage } of work) {
			const count = r.engine.ownedNotificationCount.call(r.registry, stage.prepared);
			for (let index = 0; index < count; index++) {
				if (!current() || !this.installedCurrent(work)) return false;
				if (r.engine.notifyInstalled.call(r.registry, stage.prepared, index) !== 'completed') return false;
			}
		}
		return current() && this.installedCurrent(work);
	}
	private finishOwned(work: readonly OwnedGraphWork[], terminal: import('../../../modules/devices/services/property-producer.registry.service').OwnedPublicationTerminal): void {
		for (const { registration: r, stage, generation } of work) {
			r.engine.finishPublication.call(r.registry, stage.prepared, terminal);
			const report = r.engine.readInstalledReport.call(r.registry, stage.prepared);
			if (r.active && this.ownedRegistrations.has(r) && generation === this.validationGeneration) r.lastReport = report;
			// Closed counts only; never the listener exception, property, owner, job or evidence.
			if (report.terminal !== 'complete') this.logger.error('Owned graph publication incomplete', { ...report });
			r.engine.closeObservedBatch.call(r.registry, stage.batch);
		}
	}

	private participantWriter(): ClimateAutomationWriterService {
		if (!this.writer) throw new ClimateAutomationParticipantConflict('unavailable');
		return this.writer;
	}

	async readReservedGraph(
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
	): Promise<ClimateAutomationGraphFacts> {
		this.participantWriter().assertParticipantTurn(manager, turn, ['READ_BEFORE', 'READ_AFTER', 'FINAL_READ']);
		const row = await manager.findOneBy(VirtualGraphRevisionEntity, { id: 1 });
		if (!row) throw new ClimateAutomationParticipantConflict('uninitialized');
		if (!Number.isSafeInteger(row.revision) || row.revision < 0)
			throw new ClimateAutomationParticipantConflict('invalid');
		const edges = (await this.edges(manager)).map((edge) =>
			Object.freeze({ outputPropertyId: edge.outputPropertyId, sourcePropertyId: edge.sourcePropertyId }),
		);
		edges.sort((a, b) => climateAutomationCanonical(a).localeCompare(climateAutomationCanonical(b)));
		return Object.freeze({ revision: row.revision, edges: Object.freeze(edges) });
	}

	async validateReservedReplacement(
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		delta: ClimateAutomationGraphDelta,
	): Promise<void> {
		// Identity/phase must precede descriptor getters and every SQL operation.
		this.participantWriter().assertParticipantTurn(manager, turn, ['NORMALIZE'], delta);
		if (!delta) throw new ClimateAutomationParticipantConflict('invalid');
		const row = await manager.findOneBy(VirtualGraphRevisionEntity, { id: 1 });
		if (!row || row.revision !== delta.before.revision) throw new ClimateAutomationParticipantConflict('stale');
		const actual = (await this.edges(manager)).map((edge) => Object.freeze({ ...edge }));
		actual.sort((a, b) => climateAutomationCanonical(a).localeCompare(climateAutomationCanonical(b)));
		if (climateAutomationCanonical(actual) !== climateAutomationCanonical(delta.before.edges))
			throw new ClimateAutomationParticipantConflict('stale');
		const outputs = new Set(delta.plan.ownedOutputIds);
		if (
			outputs.size !== delta.plan.ownedOutputIds.length ||
			outputs.size > 4096 ||
			delta.plan.beforeEdges.length > 8192 ||
			delta.plan.replacementEdges.length > 8192 ||
			delta.plan.beforeEdges.some((edge) => !outputs.has(edge.outputPropertyId)) ||
			delta.plan.replacementEdges.some((edge) => !outputs.has(edge.outputPropertyId))
		)
			throw new ClimateAutomationParticipantConflict('invalid');
		const ownedBefore = actual.filter((edge) => outputs.has(edge.outputPropertyId));
		if (climateAutomationCanonical(ownedBefore) !== climateAutomationCanonical(delta.plan.beforeEdges))
			throw new ClimateAutomationParticipantConflict('stale');
		const candidate = [...actual.filter((edge) => !outputs.has(edge.outputPropertyId)), ...delta.plan.replacementEdges];
		candidate.sort((a, b) => climateAutomationCanonical(a).localeCompare(climateAutomationCanonical(b)));
		if (climateAutomationCanonical(candidate) !== climateAutomationCanonical(delta.afterEdges))
			throw new ClimateAutomationParticipantConflict('invalid');
		try {
			this.validate(candidate);
		} catch (cause) {
			if (cause instanceof DevicesValidationException) throw new ClimateAutomationParticipantConflict('invalid');
			throw cause;
		}
	}

	beginReservedValidation(
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		delta: ClimateAutomationGraphDelta,
	): ClimateAutomationValidationTicket {
		this.participantWriter().assertParticipantTurn(manager, turn, ['APPLY'], delta);
		if (climateAutomationCanonical(delta.structuralBefore) === climateAutomationCanonical(delta.structuralAfter))
			throw new ClimateAutomationParticipantConflict('invalid');
		this.validationGeneration++;
		this.validationPending = true;
		const ticket = Object.freeze(new GuardedValidationShell());
		this.validationTickets.set(ticket, this.validationGeneration);
		return ticket;
	}

	async advanceReservedGraph(
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		delta: ClimateAutomationGraphDelta,
	): Promise<ClimateAutomationGraphFacts> {
		this.participantWriter().assertParticipantTurn(manager, turn, ['GRAPH_CAS'], delta);
		if (!delta) throw new ClimateAutomationParticipantConflict('invalid');
		const row = await manager.findOneBy(VirtualGraphRevisionEntity, { id: 1 });
		if (!row || row.revision !== delta.before.revision) throw new ClimateAutomationParticipantConflict('stale');
		if (!Number.isSafeInteger(row.revision) || row.revision < 0 || row.revision === Number.MAX_SAFE_INTEGER)
			throw new ClimateAutomationParticipantConflict('invalid');
		const edges = (await this.edges(manager)).map((edge) => Object.freeze({ ...edge }));
		edges.sort((a, b) => climateAutomationCanonical(a).localeCompare(climateAutomationCanonical(b)));
		if (climateAutomationCanonical(edges) !== climateAutomationCanonical(delta.afterEdges))
			throw new ClimateAutomationParticipantConflict('stale');
		this.validate(edges);
		if (climateAutomationCanonical(delta.structuralBefore) === climateAutomationCanonical(delta.structuralAfter))
			throw new ClimateAutomationParticipantConflict('invalid');
		const result = await manager.update(
			VirtualGraphRevisionEntity,
			{ id: 1, revision: row.revision },
			{ revision: row.revision + 1 },
		);
		if (result.affected !== 1) throw new ClimateAutomationParticipantConflict('stale');
		return Object.freeze({ revision: row.revision + 1, edges: Object.freeze(edges) });
	}

	/** Trusted READ-ONLY checks only. No production consumer is converted by this dormant port. */
	observeGuardedValidation(
		listener: (view: Readonly<{ revision: number; quarantinedIds: readonly string[] }>) => Promise<void>,
		options: { requiresActivation?: boolean } = {},
	): () => void {
		const registration = Object.freeze({ listener, options });
		this.guardedListeners.add(registration);
		return () => {
			this.guardedListeners.delete(registration);
		};
	}

	private async validationSnapshot() {
		return this.dataSource.transaction(async (manager) => {
			const row = await manager.findOneBy(VirtualGraphRevisionEntity, { id: 1 });
			return {
				edges: await this.edges(manager), aggregates: await manager.find(VirtualAggregateConfigEntity),
				transforms: await manager.find(VirtualTransformConfigEntity), groups: await manager.find(VirtualLightGroupConfigEntity),
				knownProperties: await this.readProjectionSources(manager),
				properties: await manager.createQueryBuilder(VirtualChannelPropertyEntity, 'property')
					.leftJoinAndSelect('property.channel', 'channel').leftJoinAndSelect('channel.device', 'device')
					.callListeners(false).getMany(),
				row, revision: row?.revision ?? 0, // Existing ordinary bootstrap behavior; reserved jobs still require row.
			};
		});
	}
	private stageMetadata(snapshot: Awaited<ReturnType<VirtualDependencyGraphService['validationSnapshot']>>) {
		const quarantined = new Set<string>();
		const neighbors = new Map<string, Set<string>>();
		for (const edge of snapshot.edges)
			for (const [node, neighbor] of [
				[edge.outputPropertyId, edge.sourcePropertyId],
				[edge.sourcePropertyId, edge.outputPropertyId],
			]) {
				const adjacent = neighbors.get(node) ?? new Set<string>();
				adjacent.add(neighbor);
				neighbors.set(node, adjacent);
			}
		const visited = new Set<string>();
		for (const root of neighbors.keys()) {
			if (visited.has(root)) continue;
			const component = new Set<string>();
			const queue = [root];
			for (let index = 0; index < queue.length; index++) {
				const node = queue[index];
				if (component.has(node)) continue;
				component.add(node);
				visited.add(node);
				queue.push(...(neighbors.get(node) ?? []));
			}
			try {
				this.validate(snapshot.edges.filter((edge) => component.has(edge.outputPropertyId)));
			} catch (error) {
				if (!(error instanceof DevicesValidationException)) throw error;
				for (const node of component) quarantined.add(node);
			}
		}
		if (snapshot.edges.length > 8192 || neighbors.size > 4096)
			for (const node of neighbors.keys()) quarantined.add(node);
		for (const config of snapshot.aggregates) {
			const property = snapshot.properties.find((candidate) => candidate.id === config.outputPropertyId);
			const channel = property?.channel;
			const device = channel && typeof channel !== 'string' ? channel.device : null;
			if (
				!property ||
				!channel ||
				typeof channel === 'string' ||
				!device ||
				typeof device === 'string' ||
				!isEligibleAggregateOutput(property, channel, device) ||
				aggregateProfile(property, channel)?.id !== config.profile
			)
				quarantined.add(config.outputPropertyId);
		}
		const staged = {
			known: new Set(snapshot.knownProperties.map((property) => property.id)),
			sources: new Map(
				snapshot.properties.map((property) => [
					property.id,
					{ valueOrigin: property.valueOrigin, sourcePropertyId: property.sourcePropertyId ?? null },
				]),
			),
			live: new Set(
				snapshot.properties.filter((property) => property.requiresLiveValue).map((property) => property.id),
			),
		};
		return { quarantined, ...staged };
	}
	private activationValue(options: { requiresActivation?: boolean }): boolean | undefined | 'invalid' {
		const descriptor = Object.getOwnPropertyDescriptor(options, 'requiresActivation');
		if (!descriptor) return Object.getPrototypeOf(options) === Object.prototype ? undefined : 'invalid';
		const value: unknown = descriptor.value;
		return descriptor.get === undefined && descriptor.set === undefined &&
			(value === undefined || typeof value === 'boolean') ? value : 'invalid';
	}

	async validateAcknowledgedGraph(job: ClimateAutomationAcknowledgedJob, ticket: ClimateAutomationValidationTicket,
		revision: number): Promise<ClimateAutomationGraphValidation> {
		const writer = this.writer, generation = this.validationTickets.get(ticket);
		const lifecycle = this.lifecycleForGeneration(generation ?? -1);
		const ordinary = [...this.validationListeners].map(([listener, options]) => ({ listener, options, activation: this.activationValue(options) }));
		const readonly = [...this.guardedListeners].map((registration) => ({ registration, activation: this.activationValue(registration.options) }));
		const owned = [...this.ownedRegistrations];
		const work: OwnedGraphWork[] = [];
		let terminal: import('../../../modules/devices/services/property-producer.registry.service').OwnedPublicationTerminal = 'preinstall_refused';
		const refused = (reason: ClimateAutomationValidationReason): ClimateAutomationGraphValidation => Object.freeze({ outcome: 'THIS_JOB_NOT_VALIDATED', reason });
		const status = (): ClimateAutomationValidationReason | null => {
			if (!writer?.isAcknowledgedJobCurrent(job, ticket, revision)) return 'original_identity_lost';
			if (generation === undefined || generation !== this.validationGeneration) return 'validation_superseded';
			if (ordinary.length !== this.validationListeners.size || ordinary.some(({ listener, options, activation }) =>
				activation === 'invalid' || this.validationListeners.get(listener) !== options || this.activationValue(options) !== activation) ||
				readonly.length !== this.guardedListeners.size || readonly.some(({ registration, activation }) =>
					activation === 'invalid' || !this.guardedListeners.has(registration) || this.activationValue(registration.options) !== activation) ||
				!this.ownedCurrent(owned)) return 'listener_set_changed';
			return null;
		};
		const probe = async (): Promise<ClimateAutomationValidationReason | null> => {
			const row = await this.dataSource.transaction((manager) => manager.findOneBy(VirtualGraphRevisionEntity, { id: 1 }));
			return status() ?? (!row ? 'missing_graph' : row.revision !== revision ? 'revision_mismatch' : null);
		};
		try {
			let reason = status(); if (reason) return refused(reason);
			if (ordinary.some(({ activation }) => !activation)) return refused('unsupported_legacy_listener');
			const snapshot = await this.validationSnapshot();
			reason = status(); if (reason) return refused(reason);
			if (!snapshot.row) return refused('missing_graph');
			if (snapshot.row.revision !== revision || revision < this.quarantineRevision) return refused('revision_mismatch');
			const staged = this.stageMetadata(snapshot);
			await this.stageOwned(snapshot, staged.quarantined, owned, work, lifecycle, generation ?? -1);
			for (const { registration, activation } of readonly) {
				if (activation) continue;
				reason = await probe(); if (reason) return refused(reason);
				await registration.listener(Object.freeze({ revision, quarantinedIds: Object.freeze([...staged.quarantined].sort()) }));
				reason = status(); if (reason) return refused(reason);
			}
			reason = await probe(); if (reason) return refused(reason);
			reason = status(); if (reason || !this.preparedCurrent(work)) return refused(reason ?? 'validation_rejected');
			// S3: pinned concrete engine then ONLY preallocated graph reference assignments; still pending.
			if (!this.installOwned(work)) return refused('validation_rejected');
			this.quarantined = staged.quarantined;
			this.knownProperties = staged.known;
			this.valueSources = staged.sources;
			this.liveValueProperties = staged.live;
			terminal = 'superseded';
			if (!this.notifyOwned(work, () => status() === null)) return refused('validation_rejected');
			reason = status(); if (reason || !this.installedCurrent(work)) return refused(reason ?? 'validation_rejected');
			this.quarantineRevision = revision;
			this.validationPending = false;
			terminal = 'complete';
			return Object.freeze({ outcome: 'VALIDATED_AT_OBSERVED_REVISION', revision });
		} catch {
			return refused('validation_rejected');
		} finally {
			if (terminal !== 'complete' && generation === this.validationGeneration) this.validationPending = true;
			this.finishOwned(work, terminal);
		}
	}

	async onApplicationBootstrap(): Promise<void> {
		if (getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on') return;
		await this.refreshQuarantine();
	}

	/** Explicit/startup validation also refreshes activated runtime outputs. */
	async refreshQuarantine(): Promise<void> {
		await this.refreshValidation(true);
	}

	/** Reads only existing identities referenced by SOURCE projections, without hydrating value history. */
	private async readProjectionSources(manager: EntityManager): Promise<ChannelPropertyEntity[]> {
		const sources = manager
			.createQueryBuilder(VirtualChannelPropertyEntity, 'projection')
			.select('projection.sourcePropertyId')
			.where('projection.valueOrigin = :projectionOrigin', { projectionOrigin: VirtualValueOrigin.SOURCE })
			.andWhere('projection.sourcePropertyId IS NOT NULL');
		// Materialize the STI query before copying its generated discriminator parameters.
		const sourceQuery = sources.getQuery();
		return manager
			.createQueryBuilder(ChannelPropertyEntity, 'property')
			.select(['property.id'])
			.where(`property.id IN (${sourceQuery})`)
			.setParameters(sources.getParameters())
			.callListeners(false)
			.getMany();
	}

	/** Validates one committed snapshot without evaluating outputs before their writer activates them. */
	private async refreshValidation(activated: boolean): Promise<void> {
		const generation = ++this.validationGeneration;
		const lifecycle = this.lifecycleForGeneration(generation);
		this.validationPending = true;
		const ordinary = [...this.validationListeners].map(([listener, options]) => ({ listener, options, activation: this.activationValue(options) }));
		const owned = [...this.ownedRegistrations], work: OwnedGraphWork[] = [];
		let terminal: import('../../../modules/devices/services/property-producer.registry.service').OwnedPublicationTerminal = 'preinstall_refused';
		const current = () => generation === this.validationGeneration && this.ownedCurrent(owned) &&
			ordinary.length === this.validationListeners.size && ordinary.every(({ listener, options, activation }) =>
				activation !== 'invalid' && this.validationListeners.get(listener) === options && this.activationValue(options) === activation);
		try {
			const snapshot = await this.validationSnapshot();
			if (!current()) return;
			if (snapshot.revision < this.quarantineRevision) throw new OwnedGraphPublicationError();
			const staged = this.stageMetadata(snapshot);
			await this.stageOwned(snapshot, staged.quarantined, owned, work, lifecycle, generation ?? -1);
			const probe = async () => {
				const revision = await this.dataSource.transaction((manager) => this.revision(manager));
				return current() && revision === snapshot.revision;
			};
			if (!(await probe()) || !current() || !this.preparedCurrent(work)) throw new OwnedGraphPublicationError();
			// O2: all preparation/probes complete. No event/getter/await between install and last assignment.
			if (!this.installOwned(work)) throw new OwnedGraphPublicationError();
			this.quarantined = staged.quarantined;
			this.knownProperties = staged.known;
			this.valueSources = staged.sources;
			this.liveValueProperties = staged.live;
			terminal = 'superseded';
			if (!this.notifyOwned(work, current)) throw new OwnedGraphPublicationError();
			terminal = 'legacy_rejected';
			for (const { listener, activation } of ordinary) {
				if (!current()) return;
				if (!activation) await listener(snapshot.revision, staged.quarantined);
				if (!current()) return;
			}
			if (!(await probe()) || !current() || !this.installedCurrent(work)) throw new OwnedGraphPublicationError();
			this.quarantineRevision = snapshot.revision;
			this.validationPending = false;
			// Notification observations close before legitimate activation replaces fallback leases.
			this.finishOwned(work, 'complete');
			terminal = 'activation_rejected';
			if (activated) for (const { listener, activation } of ordinary) {
				if (!current()) return;
				if (activation) await listener(snapshot.revision, staged.quarantined);
				if (!current()) return;
			}
			terminal = 'complete';
		} catch (error) {
			if (generation === this.validationGeneration) this.validationPending = true;
			throw error;
		} finally {
			this.finishOwned(work, terminal);
		}
	}
}
