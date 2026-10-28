import { DataSource, EntityManager, IsNull, Not } from 'typeorm';

import { Injectable, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { SqliteGuardedCommitOutcome, observeSqliteOuterOutcome } from '../../../common/database/sqlite-data-source';
import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { getEnvValue } from '../../../common/utils/config.utils';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import {
	PropertyReadPolicyObservation,
	observePropertyReadPolicy,
} from '../../../modules/devices/models/property-read-policy.model';
import { ClimateAutomationLedgerService } from '../../../modules/devices/services/climate-automation-ledger.service';
import {
	CreationCapture,
	captureCreation,
	invokeCreation,
	snapshotCreation,
} from '../../../modules/devices/services/creation-capture';
import { DEVICES_VIRTUAL_PLUGIN_NAME } from '../devices-virtual.constants';
import { VirtualChannelPropertyEntity, VirtualValueOrigin } from '../entities/devices-virtual.entity';
import { VirtualDewPointSourceEntity } from '../entities/virtual-dew-point.entity';
import {
	VirtualAggregateConfigEntity,
	VirtualAggregateInputEntity,
	VirtualGraphRevisionEntity,
	VirtualLightGroupBindingEntity,
	VirtualLightGroupConfigEntity,
	VirtualLightGroupMemberEntity,
} from '../entities/virtual-producer.entity';
import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';

import { aggregateProfile, isEligibleAggregateOutput } from './virtual-numeric-profile.utils';

export interface VirtualDependencyEdge {
	outputPropertyId: string;
	sourcePropertyId: string;
}

export interface GraphStatePublicationView {
	readonly revision: number;
	readonly properties: readonly VirtualChannelPropertyEntity[];
	readonly transforms: readonly VirtualTransformConfigEntity[];
	readonly aggregates: readonly VirtualAggregateConfigEntity[];
	readonly groups: readonly VirtualLightGroupConfigEntity[];
	readonly quarantined: readonly string[];
	readonly sourceCatalog: readonly ChannelPropertyEntity[];
	readonly aggregateInputs: readonly VirtualAggregateInputEntity[];
	readonly transformSources: readonly VirtualTransformSourceEntity[];
	readonly groupMembers: readonly VirtualLightGroupMemberEntity[];
	readonly groupBindings: readonly VirtualLightGroupBindingEntity[];
}
export interface GraphStatePublicationStage {
	validate(): boolean;
	install(): boolean;
	publish(): Promise<void>;
	close(): void;
}
export interface GraphStatePublicationParticipant {
	prepare(
		view: Promise<GraphStatePublicationView>,
		lifecycle: { current: () => boolean; ready: () => boolean; configuration?: object },
	): Promise<GraphStatePublicationStage>;
}
interface GraphStateRegistration {
	readonly participant: GraphStatePublicationParticipant;
	active: boolean;
}
interface GraphLegacyRegistration {
	readonly listener: (revision: number, quarantined: ReadonlySet<string>) => Promise<void>;
	readonly options: { requiresActivation?: boolean };
	readonly optionsCurrent: () => boolean;
	readonly requiresActivation: boolean;
	active: boolean;
}
interface GraphPublicationAdmission {
	active: boolean;
	generation?: number;
	expectedRevision?: number;
	resolved: boolean;
	readonly current: () => boolean;
	readonly listeners: readonly GraphLegacyRegistration[];
	readonly tasks: readonly Promise<CreationCapture<GraphStatePublicationStage>>[];
	readonly resolve: (view: GraphStatePublicationView) => void;
	readonly reject: (cause: unknown) => void;
}
function ownGraphView<T>(value: T): T {
	const owned = snapshotCreation(value),
		seen = new Set<object>();
	const freeze = (item: unknown): void => {
		if (!item || typeof item !== 'object' || seen.has(item)) return;
		seen.add(item);
		for (const key of Object.keys(item)) freeze(Reflect.get(item, key));
		Object.freeze(item);
	};
	freeze(owned);
	return owned;
}

/** Database writer reservation precedes all graph validation, including across independent processes. */
@Injectable()
export class VirtualDependencyGraphService implements OnApplicationBootstrap {
	private quarantined = new Set<string>();
	private liveValueProperties = new Set<string>();
	private knownProperties = new Set<string>();
	private valueSources = new Map<string, { valueOrigin: VirtualValueOrigin; sourcePropertyId: string | null }>();
	private readonly validationListeners = new Map<
		(revision: number, quarantined: ReadonlySet<string>) => Promise<void>,
		GraphLegacyRegistration
	>();
	private readonly stateParticipants = new Set<GraphStateRegistration>();
	observeStatePublication(participant: GraphStatePublicationParticipant): () => void {
		const registration = { participant, active: true };
		this.stateParticipants.add(registration);
		return () => {
			registration.active = false;
			this.stateParticipants.delete(registration);
		};
	}
	private capturePublication(configuration?: object): GraphPublicationAdmission {
		const listeners = [...this.validationListeners.values()];
		const participants = [...this.stateParticipants].map((record) => ({
			record,
			pin: captureCreation(record.participant, ['prepare']),
		}));
		const own = captureCreation(this, [
			'observeStatePublication',
			'observeValidation',
			'readPublicationSnapshot',
			'capturePublishGuard',
			'isValidated',
			'isRevisionCurrent',
		]);
		let resolve: (view: GraphStatePublicationView) => void, reject: (cause: unknown) => void;
		const view = new Promise<GraphStatePublicationView>((yes, no) => {
			resolve = yes;
			reject = no;
		});
		void view.catch(() => undefined);
		const admission: GraphPublicationAdmission = {
			active: true,
			resolved: false,
			listeners,
			current: () =>
				admission.active &&
				own.current() &&
				participants.every(({ record, pin }) => record.active && this.stateParticipants.has(record) && pin.current()) &&
				listeners.every(
					(record) =>
						record.active && this.validationListeners.get(record.listener) === record && record.optionsCurrent(),
				) &&
				(admission.generation === undefined || admission.generation === this.validationGeneration),
			tasks: [],
			resolve: (value) => resolve(value),
			reject: (cause) => reject(cause),
		};
		Object.assign(admission, {
			tasks: participants.map(({ pin }) => {
				try {
					const input = view.then((value) => ownGraphView(value));
					void input.catch(() => undefined);
					const task = pin.values.prepare.call(pin.receiver, input, {
						configuration,
						current: () => admission.current(),
						ready: () => admission.current() && admission.generation !== undefined && !this.validationPending,
					});
					const captured = task.then((stage) => captureCreation(stage, ['validate', 'install', 'publish', 'close']));
					void captured.catch(() => undefined);
					return captured;
				} catch (cause: unknown) {
					const task = Promise.resolve().then((): CreationCapture<GraphStatePublicationStage> => {
						throw cause;
					});
					void task.catch(() => undefined);
					return task;
				}
			}),
		});
		return admission;
	}
	private async closePublication(admission: GraphPublicationAdmission): Promise<void> {
		if (!admission.active) return;
		admission.active = false;
		if (!admission.resolved) admission.reject(new Error('Original graph publication closed'));
		const results = await Promise.allSettled(admission.tasks);
		for (const result of results)
			if (result.status === 'fulfilled') {
				try {
					invokeCreation(result.value.values.close, result.value.receiver);
				} catch {
					/* Preserve the original mutation/validation failure. */
				}
			}
	}

	private quarantineRevision = -1;
	// Module initialization may install leases before bootstrap validates the durable graph.
	private validationPending = true;
	private validationGeneration = 0;
	private readonly logger = createExtensionLogger(DEVICES_VIRTUAL_PLUGIN_NAME, 'VirtualDependencyGraphService');

	constructor(
		private readonly dataSource: DataSource,
		@Optional() private readonly configService: NestConfigService = new NestConfigService(),
		@Optional() private readonly climateLedger?: ClimateAutomationLedgerService,
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
		return this.structuralWrite(operation, expectedGraphRevision);
	}

	/** Existing configuration consumers borrow this exact outer writer; no second transaction or owner. */
	withProducerConfigurationWrite<T>(
		operation: (manager: EntityManager) => Promise<T>,
		expectedGraphRevision: number | undefined,
		handoff: {
			token: object;
			admit(manager: EntityManager): void;
			validate(manager: EntityManager): Promise<void>;
			outcome(): SqliteGuardedCommitOutcome | undefined;
			settled(): void;
		},
	): Promise<T> {
		const original = captureCreation(handoff, ['token', 'admit', 'validate', 'outcome', 'settled']);
		return this.structuralWrite(
			async (manager) => {
				const result = await operation(manager);
				await original.values.validate.call(original.receiver, manager);
				if (!original.current()) throw new Error('Original producer configuration handoff changed');
				return result;
			},
			expectedGraphRevision,
			(manager) => original.values.admit.call(original.receiver, manager),
			undefined,
			undefined,
			false,
			original.values.token,
			() => original.values.outcome.call(original.receiver),
		).finally(() => original.values.settled.call(original.receiver));
	}

	/** Creation-only receipt admission on the SAME outer transaction, before the graph reservation. */
	withCreationWrite<T>(
		operation: (manager: EntityManager) => Promise<T>,
		expectedGraphRevision: number | undefined,
		admit: (manager: EntityManager) => void,
	): Promise<T> {
		return this.structuralWrite(operation, expectedGraphRevision, admit, undefined, undefined, true);
	}

	/** Configure/restore admit their own native image without relaxing four-comfort revision rules. */
	withControllerMutationWrite<T>(
		operation: (manager: EntityManager) => Promise<T>,
		expectedGraphRevision: number | undefined,
		admit: (manager: EntityManager) => void,
		accepted: () => void,
		deferredOperation?: (manager: EntityManager, advanceGraph?: () => Promise<number>) => Promise<T>,
		readWindow?: { reserveZeroRows(table: string, column: string): Promise<void>; beginReads(): void },
	): Promise<T> {
		return this.structuralWrite(
			deferredOperation ?? operation,
			expectedGraphRevision,
			admit,
			accepted,
			undefined,
			true,
			undefined,
			undefined,
			deferredOperation !== undefined,
			readWindow,
		);
	}

	/** Closed thermostat intents require their own original ACK/result before ordinary graph settlement. */
	withComfortSelectionWrite<T>(
		operation: (manager: EntityManager) => Promise<T>,
		expectedGraphRevision: number | undefined,
		admit: (manager: EntityManager) => void,
		accepted: () => void,
		kind?: 'registered-settings' | 'release-request',
		deferredOperation?: (manager: EntityManager, advanceGraph?: () => Promise<number>) => Promise<T>,
		readWindow?: { reserveZeroRows(table: string, column: string): Promise<void>; beginReads(): void },
	): Promise<T> {
		const refresh = this.refreshValidation.bind(this) as VirtualDependencyGraphService['refreshValidation'];
		return this.structuralWrite(
			deferredOperation ?? operation,
			expectedGraphRevision,
			(manager) => {
				admit(manager);
				if (
					!((kind === 'registered-settings' || kind === 'release-request') && expectedGraphRevision === undefined) &&
					(!Number.isSafeInteger(expectedGraphRevision) ||
						expectedGraphRevision === undefined ||
						expectedGraphRevision < 0)
				)
					throw new DevicesValidationException('Invalid virtual dependency graph revision.');
			},
			accepted,
			(publication) => refresh(false, publication),
			true,
			undefined,
			undefined,
			deferredOperation !== undefined,
			readWindow,
		);
	}

	/** Internal parent READY boundary; no transaction or structural ownership is acquired here. */
	async sealControllerLedger(manager: EntityManager): Promise<void> {
		if (this.climateLedger) await this.climateLedger.sealAdmittedManager(manager);
	}

	private async structuralWrite<T>(
		operation: (manager: EntityManager, advanceGraph?: () => Promise<number>) => Promise<T>,
		expectedGraphRevision?: number,
		admit?: (manager: EntityManager) => void,
		accepted?: () => void,
		settleValidation?: (publication: GraphPublicationAdmission) => Promise<void>,
		borrowClimateLedger = false,
		configuration?: object,
		configurationOutcome?: () => SqliteGuardedCommitOutcome | undefined,
		deferMutation = false,
		readWindow?: { reserveZeroRows(table: string, column: string): Promise<void>; beginReads(): void },
	): Promise<T> {
		// The caller already owns DeviceStructureLockService. Never acquire another lock from this transaction.
		const publication = this.capturePublication(configuration);
		let applied = !deferMutation;
		try {
			const result = await this.dataSource.transaction(async (manager) => {
				const receipt = borrowClimateLedger && this.climateLedger ? observeSqliteOuterOutcome(manager) : undefined;
				admit?.(manager);
				// Even an ignored INSERT reserves SQLite's writer slot before a validation read. This also
				// initializes synchronized databases, which do not run the migration's singleton seed.
				if (readWindow) await readWindow.reserveZeroRows('devices_virtual_graph_revision', 'revision');
				else if (deferMutation)
					await manager.query('UPDATE "devices_virtual_graph_revision" SET "revision"="revision" WHERE 0');
				else
					await manager.query(
						'INSERT OR IGNORE INTO "devices_virtual_graph_revision" ("id", "revision") VALUES (1, 0)',
					);
				readWindow?.beginReads();
				const current = await manager.findOneBy(VirtualGraphRevisionEntity, { id: 1 });
				const initialRevision = current?.revision ?? 0;
				if (expectedGraphRevision !== undefined && initialRevision !== expectedGraphRevision) {
					throw new DevicesValidationException('Virtual dependency graph revision changed; reload and retry.');
				}
				if (
					admit &&
					(!Number.isSafeInteger(initialRevision) || (!deferMutation && initialRevision >= Number.MAX_SAFE_INTEGER))
				)
					throw new DevicesValidationException('Virtual dependency graph revision overflow.');
				if (accepted && initialRevision < 0)
					throw new DevicesValidationException('Invalid virtual dependency graph revision.');
				let advanced = false;
				const advance = async () => {
					if (advanced) throw new DevicesValidationException('Graph mutation was already admitted.');
					if (!Number.isSafeInteger(initialRevision) || initialRevision >= Number.MAX_SAFE_INTEGER)
						throw new DevicesValidationException('Virtual dependency graph revision overflow.');
					if (current) {
						const update = await manager
							.createQueryBuilder()
							.update(VirtualGraphRevisionEntity)
							.set({ revision: initialRevision + 1 })
							.where({ id: 1, revision: initialRevision })
							.execute();
						if (update.affected !== 1) throw new DevicesValidationException('Original graph revision changed.');
					} else await manager.insert(VirtualGraphRevisionEntity, { id: 1, revision: 1 });
					advanced = true;
					applied = true;
					publication.expectedRevision = initialRevision + 1;
					return initialRevision + 1;
				};
				if (!deferMutation) {
					await manager.increment(VirtualGraphRevisionEntity, { id: 1 }, 'revision', 1);
					publication.expectedRevision = initialRevision + 1;
				}
				const work = () => operation(manager, deferMutation ? advance : undefined);
				const value = receipt ? await this.climateLedger.inAdmittedManager(manager, receipt, work) : await work();
				if (deferMutation && !advanced) {
					if (!current) throw new DevicesValidationException('Missing unchanged graph identity.');
					const final = await manager.findOneByOrFail(VirtualGraphRevisionEntity, { id: 1 });
					if (final.revision !== initialRevision)
						throw new DevicesValidationException('Original unchanged graph drifted.');
				}
				return value;
			});
			accepted?.();
			if (!applied) {
				await this.closePublication(publication);
				return result;
			}
			try {
				if (settleValidation) await settleValidation(publication);
				else await this.refreshValidation(false, publication);
			} catch (error) {
				await this.closePublication(publication);
				// The owning COMMIT succeeded. Returning its result allows the caller to activate the
				// persisted catalog while validation guards keep live authority unavailable until retry.
				this.logger.error(
					'Virtual structural write committed, but graph validation failed; live authority remains unavailable until validation succeeds.',
					error instanceof Error ? error : new Error('Post-commit graph validation rejected', { cause: error }),
				);
			}
			return result;
		} catch (cause: unknown) {
			const outcome = configurationOutcome?.();
			if ((outcome === 'committed' || outcome === 'unknown') && !publication.resolved) {
				// Native ACK remains real when an original post-ACK callback throws. Settle only
				// the new owned fence; ordinary callbacks keep their original skipped error path.
				this.validationGeneration++;
				this.validationPending = true;
				try {
					if (outcome === 'committed') await this.refreshValidation(false, publication, false);
					else await this.closePublication(publication);
				} catch {
					await this.closePublication(
						publication,
					); /* Original native callback error remains primary, including falsy errors. */
				}
			} else await this.closePublication(publication);
			throw cause;
		}
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

	/** Read-only snapshot of the policy epoch and its direct method/metadata dependencies. */
	captureReadPolicyObservation(): PropertyReadPolicyObservation {
		return observePropertyReadPolicy(this, [
			'validationGeneration',
			'validationPending',
			'quarantineRevision',
			'quarantined',
			'knownProperties',
			'liveValueProperties',
			'valueSources',
			'isValidated',
			'isQuarantined',
			'matchesValueSource',
			'propertyRequiresLiveValue',
			'captureReadPolicyObservation',
		]);
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
		const original = captureCreation(options, ['requiresActivation']);
		const previous = this.validationListeners.get(listener);
		if (previous) previous.active = false;
		const record: GraphLegacyRegistration = {
			listener,
			options,
			optionsCurrent: original.current,
			requiresActivation: original.values.requiresActivation === true,
			active: true,
		};
		this.validationListeners.set(listener, record);
		return () => {
			record.active = false;
			if (this.validationListeners.get(listener) === record) this.validationListeners.delete(listener);
		};
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
	async readPublicationSnapshot() {
		return this.dataSource.transaction(async (manager) => ({
			edges: await this.edges(manager),
			aggregates: await manager.find(VirtualAggregateConfigEntity),
			transforms: await manager.find(VirtualTransformConfigEntity),
			groups: await manager.find(VirtualLightGroupConfigEntity),
			aggregateInputs: await manager.find(VirtualAggregateInputEntity, { order: { id: 'ASC' } }),
			transformSources: await manager.find(VirtualTransformSourceEntity, { order: { id: 'ASC' } }),
			groupMembers: await manager.find(VirtualLightGroupMemberEntity, { order: { id: 'ASC' } }),
			groupBindings: await manager.find(VirtualLightGroupBindingEntity, { order: { id: 'ASC' } }),
			sourceCatalog: await manager
				.createQueryBuilder(ChannelPropertyEntity, 'source')
				.leftJoinAndSelect('source.channel', 'channel')
				.leftJoinAndSelect('channel.device', 'device')
				.callListeners(false)
				.orderBy('source.id', 'ASC')
				.getMany(),
			knownProperties: await this.readProjectionSources(manager),
			properties: await manager
				.createQueryBuilder(VirtualChannelPropertyEntity, 'property')
				.leftJoinAndSelect('property.channel', 'channel')
				.leftJoinAndSelect('channel.device', 'device')
				.callListeners(false)
				.getMany(),
			revision: await this.revision(manager),
		}));
	}
	private async refreshValidation(
		activated: boolean,
		admission = this.capturePublication(),
		invokeOrdinary = true,
	): Promise<void> {
		const generation = ++this.validationGeneration;
		admission.generation = generation;
		this.validationPending = true;
		const read = captureCreation(this, ['readPublicationSnapshot']);
		try {
			const snapshot = ownGraphView(await read.values.readPublicationSnapshot.call(read.receiver));
			const snapshotBytes = JSON.stringify(snapshot);
			const verify = async () => {
				if (!read.current() || !admission.current()) throw new Error('Original graph publication expired');
				const latest = await read.values.readPublicationSnapshot.call(read.receiver);
				if (!read.current() || !admission.current() || JSON.stringify(latest) !== snapshotBytes)
					throw new Error('Original durable graph publication changed');
			};
			const initialEligibilityFailure =
				!admission.current() ||
				(admission.expectedRevision !== undefined && snapshot.revision !== admission.expectedRevision)
					? { cause: new Error('Original graph revision changed') }
					: undefined;
			if (snapshot.revision < this.quarantineRevision)
				throw new Error('Graph validation snapshot is older than the applied revision');
			const quarantined = new Set<string>();
			const neighbors = new Map<string, Set<string>>();
			for (const edge of snapshot.edges) {
				for (const [node, neighbor] of [
					[edge.outputPropertyId, edge.sourcePropertyId],
					[edge.sourcePropertyId, edge.outputPropertyId],
				]) {
					const adjacent = neighbors.get(node) ?? new Set<string>();
					adjacent.add(neighbor);
					neighbors.set(node, adjacent);
				}
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
				const channel = property?.channel as ChannelEntity;
				if (
					!property ||
					!channel?.device ||
					!isEligibleAggregateOutput(property, channel, channel.device as DeviceEntity) ||
					aggregateProfile(property, channel)?.id !== config.profile
				)
					quarantined.add(config.outputPropertyId);
			}
			admission.resolved = true;
			admission.resolve(ownGraphView({ ...snapshot, quarantined: [...quarantined].sort() }));
			const prepared = await Promise.allSettled(admission.tasks);
			const rejected = prepared.find((result) => result.status === 'rejected');
			let eligibilityFailure: { cause: unknown } | undefined =
				initialEligibilityFailure ??
				(rejected?.status === 'rejected' ? { cause: rejected.reason as unknown } : undefined);
			const stages = prepared.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
			try {
				await verify();
				if (!stages.every((stage) => stage.current() && invokeCreation(stage.values.validate, stage.receiver)))
					throw new Error('Original producer state slot changed');
			} catch (cause: unknown) {
				eligibilityFailure ??= { cause };
			}
			if (!eligibilityFailure) {
				this.quarantined = quarantined;
				this.knownProperties = new Set(snapshot.knownProperties.map((property) => property.id));
				this.valueSources = new Map(
					snapshot.properties.map((property) => [
						property.id,
						{ valueOrigin: property.valueOrigin, sourcePropertyId: property.sourcePropertyId ?? null },
					]),
				);
				this.liveValueProperties = new Set(
					snapshot.properties.filter((property) => property.requiresLiveValue).map((property) => property.id),
				);
			}
			// Original ordinary callbacks retain their order and receiver even if observation expires.
			for (const record of admission.listeners)
				if (invokeOrdinary && !record.requiresActivation)
					await Reflect.apply(record.listener, undefined, [snapshot.revision, new Set(quarantined)]);
			if (eligibilityFailure) throw eligibilityFailure.cause;
			await verify();
			for (const stage of stages)
				if (!stage.current() || !invokeCreation(stage.values.validate, stage.receiver))
					throw new Error('Producer state preparation expired');
			for (const stage of stages)
				if (!invokeCreation(stage.values.install, stage.receiver))
					throw new Error('Producer state installation refused');
			let publicationFailure: { cause: unknown } | undefined;
			for (const stage of stages) {
				try {
					await invokeCreation(stage.values.publish, stage.receiver);
				} catch (cause: unknown) {
					publicationFailure ??= { cause };
				}
			}
			if (publicationFailure) throw publicationFailure.cause;
			await verify();
			if (!stages.every((stage) => stage.current() && invokeCreation(stage.values.validate, stage.receiver)))
				throw new Error('Original producer state publication expired');
			this.quarantineRevision = snapshot.revision;
			this.validationPending = false;
			if (activated) {
				for (const record of admission.listeners)
					if (record.requiresActivation)
						await Reflect.apply(record.listener, undefined, [snapshot.revision, new Set(quarantined)]);
				await verify();
			}
		} catch (error) {
			if (generation === this.validationGeneration) this.validationPending = true;
			await this.closePublication(admission);
			throw error;
		}
	}
}
