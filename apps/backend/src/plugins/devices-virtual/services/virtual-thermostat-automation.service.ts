import { isUUID } from 'class-validator';
import { DataSource, EntityManager, IsNull } from 'typeorm';

import { Injectable, OnApplicationBootstrap, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';

import {
	SqliteCommitGuardReceipt,
	captureSqliteNoMutationWindow,
	hasCurrentSqliteConnectionLease,
	observeSqliteOuterOutcome,
	registerSqliteCommitGuard,
} from '../../../common/database/sqlite-data-source';
import {
	ClimateAutomationCapturedRegistration,
	ClimateAutomationControllerFacts,
	ClimateAutomationJson,
	ClimateAutomationMutationCompletion,
	ClimateAutomationMutationOutcome,
	ClimateAutomationOwnedRegistration,
	ClimateAutomationOwnedSettlement,
	ClimateAutomationProducer,
	ClimateAutomationProvider,
	ClimateAutomationRetirementPermit,
	ClimateAutomationSlotFacts,
	ClimateAutomationSlotSnapshot,
} from '../../../modules/devices/contracts/climate-automation.contract';
import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import {
	ClimateAutomationDeletionEntity,
	ClimateAutomationSlotEntity,
	ClimateAutomationSourceEntity,
} from '../../../modules/devices/entities/climate-automation.entity';
import { ClimateAutomationLedgerService } from '../../../modules/devices/services/climate-automation-ledger.service';
import { canonical, increment } from '../../../modules/devices/services/climate-automation-ledger.utils';
import { ClimateAutomationRegistryService } from '../../../modules/devices/services/climate-automation.registry.service';
import { ControllerPublicationContext } from '../../../modules/devices/services/controller-publication-context';
import { captureCreation, invokeCreation } from '../../../modules/devices/services/creation-capture';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { VirtualDeviceEntity, VirtualDeviceMode } from '../entities/devices-virtual.entity';
import { VirtualThermostatConfigEntity } from '../entities/virtual-thermostat.entity';

import {
	ControllerMutationImage,
	assertControllerMutationImage,
	readControllerMutationImage,
	writeControllerPartition,
} from './thermostat-controller-mutation';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import {
	ThermostatComfortConfiguration,
	ThermostatPreset,
	ThermostatSetpoints,
	validateThermostatSetpoints,
} from './virtual-thermostat-comfort.utils';
import { climateDeletionCaptureSql } from './virtual-thermostat-ownership.sql';
import {
	ThermostatRecreationHistory,
	assertThermostatRecreationHistory,
	readThermostatRecreationHistory,
	resetThermostatRecreationRuntime,
} from './virtual-thermostat-runtime-ownership';

export interface ThermostatCreationAdmission {
	readonly expectedRevision?: number;
	readonly beforePersist?: () => Promise<ControllerMutationImage>;
	readonly finish: () => Promise<void>;
}
interface RecreationPreparation {
	readonly revision: number;
	readonly image: ControllerMutationImage;
	readonly history: ThermostatRecreationHistory;
}

export const THERMOSTAT_AUTOMATION_PROVIDER = 'virtual-thermostat:v1';
interface Selection {
	preset: ThermostatPreset | null;
	setpoints: ThermostatSetpoints | null;
}
export interface ThermostatResolvedAutomation {
	readonly baseline: ThermostatComfortConfiguration['automation_baseline'];
	readonly manualHold: boolean;
	readonly isCurrent: () => boolean;
}
interface RuntimeRegistration {
	readonly capture: (id: string) => Promise<void>;
	readonly request?: (id: string) => Promise<void>;
}
interface OwnedSettlement {
	readonly settled: () => boolean;
	readonly generation: string;
	readonly current: () => boolean;
}
interface Installation {
	readonly admission: object;
	settled: boolean;
	readonly custodyCurrent: () => boolean;
	readonly sourceCurrent: () => boolean;
	readonly captureSourceCurrent: () => () => boolean;
	readonly attempt?: OwnedSettlement;
	readonly runtime?: RuntimeRegistration;
	readonly slot: string;
	readonly source: string;
	readonly graphCurrent: () => boolean;
	readonly providerCurrent: () => boolean;
}
interface MutationCohort {
	readonly producerKey: string;
	readonly subjectId: string;
	readonly generationId: string;
	readonly admission?: object;
	readonly group: ReadonlyMap<string, Installation>;
	readonly owners: Set<object>;
	readonly token: object;
	valid: boolean;
	closing: boolean;
}
interface LocalAdmission {
	readonly generationId: string;
	readonly runtime?: RuntimeRegistration;
	readonly attempt?: OwnedSettlement;
	readonly prior?: Installation;
}
const asJson = (value: unknown): ClimateAutomationJson => JSON.parse(JSON.stringify(value)) as ClimateAutomationJson;
const fail = (): never => {
	throw new DevicesValidationException('Thermostat automation provenance or selection is unavailable.');
};

/** Plugin-owned participant. Durable LIVE rows alone never supply a process-local installation. */
@Injectable()
export class VirtualThermostatAutomationService implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy {
	private readonly graphRenewals = new WeakMap<
		EntityManager,
		{
			revision: number;
			current: () => boolean;
			slots: ReadonlyMap<string, string>;
		}
	>();
	private readonly mutationVacancies = new Map<string, { original: Installation; token: object }>();
	private readonly mutationCohorts = new Map<string, MutationCohort>();
	private removeCompletion?: () => void;
	private registration?: ClimateAutomationOwnedRegistration;
	private deletionSchema?: string;
	private readonly installations = new Map<string, Installation>();
	private readonly localAdmissions = new Map<string, LocalAdmission>();
	private readonly removedPredecessors = new WeakMap<LocalAdmission, Installation>();
	private readonly generationAdmissions = new Map<string, object>();
	private readonly retiringGenerations = new Map<string, OwnedSettlement>();
	private destroyed = false;
	private runtime?: RuntimeRegistration;
	private readonly provider: ClimateAutomationProvider;
	private restoredRuntime?: object;
	private publication?: Readonly<{ run: (id: string) => Promise<unknown> }>;
	constructor(
		private readonly database: DataSource,
		private readonly registry: ClimateAutomationRegistryService,
		private readonly ledger: ClimateAutomationLedgerService,
		private readonly graph: VirtualDependencyGraphService,
		@Optional() private readonly structure?: DeviceStructureLockService,
	) {
		this.provider = {
			beginControllerDeletion: (expected) => {
				const installed = this.installations.get(expected.controllerId);
				if (installed && installed.slot !== canonical(expected)) fail();
				const original = installed ?? this.mutationCohorts.get(expected.generationId)?.group.get(expected.controllerId);
				if (!original) return this.beginMutation(expected.controllerId);
				if (original.slot !== canonical(expected)) fail();
				const source = JSON.parse(original.source) as { producerKey: string; subjectId: string; generationId: string };
				return this.beginSourceMutation(source.producerKey, source.subjectId, source.generationId);
			},
			readDeletionConfigurationInManager: async (manager, id) => {
				await this.assertDeletionSchema(manager);
				const rows = await manager.query<Record<string, ClimateAutomationJson>[]>(
					'SELECT * FROM "devices_virtual_thermostat_configs" WHERE "controllerId" = ?',
					[id],
				);
				if (rows.length !== 1) fail();
				return { ...rows[0] };
			},
			readDeletedControllerInManager: async (manager, id, before) => {
				await this.assertDeletionSchema(manager);
				const original = (before.evidence as unknown as { image: ControllerMutationImage }).image;
				const retained = {
					...original,
					configuration: original.configuration.map((row) => ({ ...row, ownerDeviceId: null })),
					settings: [],
					properties: [],
				};
				await this.validateDeletedController(manager, id, asJson(retained));
				return asJson(retained);
			},
			validateDeletedControllerInManager: (manager, id, retained) =>
				this.validateDeletedController(manager, id, retained),
			captureControllerRecreationArchiveInManager: async (manager, id, retained) => {
				await this.validateDeletedController(manager, id, retained);
				return asJson({ controller: retained, history: await readThermostatRecreationHistory(manager, id) });
			},
			prepareControllerRecreationInManager: async (manager, id, retained, archive) => {
				await this.validateDeletedController(manager, id, retained);
				const original = await readControllerMutationImage(manager, id);
				if (canonical(original) !== canonical(retained)) fail();
				const captured = archive as unknown as {
					controller: ControllerMutationImage;
					history: ThermostatRecreationHistory;
				};
				if (canonical(captured.controller) !== canonical(original)) fail();
				const row = await manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
				const nextRevision = increment(row.revision);
				row.revision = nextRevision;
				const history = await resetThermostatRecreationRuntime(
					manager,
					id,
					captured.history,
					original.claims,
					nextRevision,
				);
				// Keep storage containers, released claim/branch IDs, recovery records and every journal row.
				// Only the new controller's current configuration/authority starts fresh.
				row.comfort = null;
				row.locked = false;
				row.releaseRequestedAt = null;
				const configuration = await writeControllerPartition(manager, 'configuration', original.configuration, [row]);
				const sources = await writeControllerPartition(manager, 'sources', original.sources, []);
				const image = { ...original, configuration, sources };
				if (canonical(await readControllerMutationImage(manager, id)) !== canonical(image)) fail();
				return asJson({ revision: row.revision, image, history });
			},
			validateControllerRecreationInManager: (manager, id, preparation) =>
				assertThermostatRecreationHistory(manager, id, (preparation as unknown as RecreationPreparation).history),
			withAutomationWrite: (work) => this.withAutomationWrite(work),
			resolveActionInManager: (manager, id, action) => this.resolveAction(manager, id, action),
			retireControllerInManager: (manager, slot) => this.retireController(manager, slot),
			beginSourceMutation: (producerKey, subjectId, generationId) =>
				this.beginSourceMutation(producerKey, subjectId, generationId),
			graphRefreshVersion: 1,
			ownedSettlementVersion: 1,
			settleInstalled: (slots, producer, owned) => this.settleInstalled(slots, producer, owned),
			readControllerInManager: (manager, id) => this.readController(manager, id),
			validateSelectionInManager: async (manager, id, _facts, value) => {
				const row = await manager.findOneBy(VirtualThermostatConfigEntity, { controllerId: id });
				const owner = await manager.findOneBy(VirtualDeviceEntity, { id });
				return owner?.enabled === true && !!row && this.selection(row, value) !== null;
			},
			installControllerInManager: (manager, slot) => this.installController(manager, slot),
			refreshControllerInManager: (manager, slot, before, kind) => this.refreshController(manager, slot, before, kind),
		};
	}
	onModuleInit(): void {
		if (process.env.FB_CLI === 'on') return;
		if (this.destroyed || this.registration) fail();
		this.registration = this.registry.registerProviderOwned(THERMOSTAT_AUTOMATION_PROVIDER, this.provider) ?? undefined;
		if (!this.registration) fail();
		this.removeCompletion = this.graph.observeCompletion((revision, current) =>
			this.renewCompletedGraph(revision, current),
		);
	}
	async onApplicationBootstrap(): Promise<void> {
		if (process.env.FB_CLI === 'on') return;
		const provider = this.registry.captureProvider(THERMOSTAT_AUTOMATION_PROVIDER);
		if (!this.structure || this.destroyed || provider?.implementation !== this.provider) fail();
		await this.structure.runExclusive(async () => {
			const owner = this.structure.captureExclusiveOwner();
			let receipt: SqliteCommitGuardReceipt;
			const sql = await this.database.transaction(async (manager) => {
				receipt = observeSqliteOuterOutcome(manager);
				registerSqliteCommitGuard(manager, () => owner() && !this.destroyed && provider.isCurrent());
				// Independent application instances must reserve the writer before inspecting or
				// installing the same trigger. Schema readiness never advances the graph.
				await manager.query('UPDATE "devices_virtual_graph_revision" SET "revision"="revision" WHERE 0');
				const expected = await climateDeletionCaptureSql(manager);
				const read = () =>
					manager.query<{ sql: string }[]>('SELECT "sql" FROM sqlite_master WHERE "name" = ?', [
						'virtual_thermostat_capture_admitted_deletion',
					]);
				const before = await read();
				if (!before.length && this.database.options.synchronize === true) await manager.query(expected);
				const after = await read();
				if (after.length !== 1 || after[0].sql !== expected) fail();
				return expected;
			});
			if (receipt?.outcome !== 'committed' || !owner() || this.destroyed || !provider.isCurrent()) fail();
			this.deletionSchema = sql;
		});
	}
	private async assertDeletionSchema(manager: EntityManager): Promise<void> {
		if (this.destroyed || !this.deletionSchema) fail();
		const rows = await manager.query<{ sql: string }[]>('SELECT "sql" FROM sqlite_master WHERE "name" = ?', [
			'virtual_thermostat_capture_admitted_deletion',
		]);
		if (rows.length !== 1 || rows[0].sql !== this.deletionSchema) fail();
	}
	private async validateDeletedController(
		manager: EntityManager,
		id: string,
		retained: ClimateAutomationJson,
	): Promise<void> {
		await this.assertDeletionSchema(manager);
		if ((await manager.query<object[]>('SELECT "id" FROM "devices_module_devices" WHERE "id" = ?', [id])).length)
			fail();
		// Ledger JSON owns and sorts object keys. Compare every stored value without
		// interpreting JSON-text columns or requiring the original object insertion order.
		if (canonical(await readControllerMutationImage(manager, id)) !== canonical(retained)) fail();
	}
	/** Join exact already-issued predecessors before the author's structural/native owners. */
	async captureCreationPredecessor(id?: string): Promise<(manager: EntityManager) => Promise<void>> {
		const provider = this.registry.captureProvider(THERMOSTAT_AUTOMATION_PROVIDER);
		const runtime = this.runtime;
		const current = () =>
			!this.destroyed &&
			!!provider &&
			provider.isCurrent() &&
			provider.implementation === this.provider &&
			this.runtime === runtime;
		if (!current()) fail();
		const slot = id ? await this.database.manager.findOneBy(ClimateAutomationSlotEntity, { controllerId: id }) : null;
		const proof = slot
			? await this.database.manager.findOneBy(ClimateAutomationDeletionEntity, {
					controllerId: id,
					controllerIncarnation: slot.controllerIncarnation,
					consumedByIncarnation: IsNull(),
				})
			: null;
		const expectedSlot = slot && canonical({ ...slot });
		const expectedProof = proof && canonical({ ...proof });
		if (!current()) fail();
		if (proof) {
			// Hints are rechecked under reservation. Neither a public ID nor a terminal row grants creation.
			this.revoke(id);
			await (runtime?.capture(id) ?? Promise.resolve());
			if (!current()) fail();
		}
		return async (manager) => {
			if (!current()) fail();
			registerSqliteCommitGuard(manager, current);
			if (proof) {
				const actualSlot = await manager.findOneBy(ClimateAutomationSlotEntity, { controllerId: id });
				const actualProof = await manager.findOneBy(ClimateAutomationDeletionEntity, { deletionId: proof.deletionId });
				if (
					!actualSlot ||
					!actualProof ||
					canonical({ ...actualSlot }) !== expectedSlot ||
					canonical({ ...actualProof }) !== expectedProof
				)
					fail();
			}
		};
	}
	async captureCreation(
		manager: EntityManager,
		id: string,
		predecessor?: (manager: EntityManager) => Promise<void>,
	): Promise<ThermostatCreationAdmission> {
		if (predecessor) await predecessor(manager);
		const provider = this.registry.captureProvider(THERMOSTAT_AUTOMATION_PROVIDER);
		if (!provider || provider.implementation !== this.provider || this.destroyed) fail();
		const current = () => !this.destroyed && provider.isCurrent() && provider.implementation === this.provider;
		registerSqliteCommitGuard(manager, current);
		const scope = this.ledger.currentScope(manager);
		const recreate = await this.ledger.captureControllerRecreation(manager, scope, id);
		if (!current()) fail();
		const finish = async () => {
			if (!current()) fail();
			if (!recreate) return this.initializeCreated(manager, id);
			const slot = await this.ledger.readSlot(manager, scope, id, true, THERMOSTAT_AUTOMATION_PROVIDER);
			await recreate.consume(slot);
		};
		if (!recreate) return Object.freeze({ finish });
		const prepared = recreate.preparation as unknown as RecreationPreparation;
		return Object.freeze({
			expectedRevision: prepared.revision,
			finish,
			beforePersist: async () => {
				if (!current()) fail();
				const image = await readControllerMutationImage(manager, id);
				if (canonical({ ...image, properties: [] }) !== canonical(prepared.image)) fail();
				await assertThermostatRecreationHistory(manager, id, prepared.history);
				return image;
			},
		});
	}

	onModuleDestroy(): void {
		this.destroyed = true;
		this.removeCompletion?.();
		this.removeCompletion = undefined;
		this.runtime = undefined;
		this.publication = undefined;
		// Retain original installation records only as finite cleanup selectors after disposal; resolve refuses destroyed providers.
		this.localAdmissions.clear();
		this.mutationVacancies.clear();
		for (const cohort of this.mutationCohorts.values()) cohort.valid = false;
		this.mutationCohorts.clear();
		this.registration?.dispose();
		this.registration = undefined;
	}
	revoke(id: string): void {
		this.mutationVacancies.delete(id);
		this.localAdmissions.delete(id);
		this.installations.delete(id);
	}
	private removeOriginalInstallation(id: string, original: Installation): void {
		if (this.installations.get(id) !== original) return;
		const pending = this.localAdmissions.get(id);
		// Only this exact owned predecessor removal may explain a still-pending successor's vacancy.
		// Manual revocation and replacement admissions retain their separate refusal paths.
		if (original.attempt && pending?.attempt && pending.attempt !== original.attempt && pending.prior === original)
			this.removedPredecessors.set(pending, original);
		this.installations.delete(id);
	}
	registerRuntime(capture: (id: string) => Promise<void>, request?: (id: string) => Promise<void>): () => void {
		if (this.destroyed || this.runtime) fail();
		const registration = Object.freeze({ capture, request });
		this.runtime = registration;
		return () => {
			if (this.runtime === registration) {
				this.runtime = undefined;
				// A replacement runtime must join the original registration's predecessors before replacing its local records.
				this.localAdmissions.clear();
			}
		};
	}
	/** Startup reconstructs current durable intent only; no historical delta, publication or command is replayed. */
	async restoreCurrentInstallations(): Promise<void> {
		const runtime = this.runtime,
			provider = this.registry.captureProvider(THERMOSTAT_AUTOMATION_PROVIDER);
		if (
			!runtime ||
			this.restoredRuntime === runtime ||
			this.destroyed ||
			provider?.implementation !== this.provider ||
			!this.structure
		)
			return;
		this.restoredRuntime = runtime;
		const rows = await this.database.manager.findBy(ClimateAutomationSlotEntity, {
			providerKey: THERMOSTAT_AUTOMATION_PROVIDER,
			state: 'LIVE',
		});
		const groups = new Map<string, ClimateAutomationSlotFacts[]>();
		for (const row of rows) groups.set(row.generationId, [...(groups.get(row.generationId) ?? []), { ...row }]);
		for (const slots of groups.values()) {
			// These exact old runtimes may still own detached commands. Join before taking structure or SQLite.
			await Promise.all(slots.map((slot) => this.beginMutation(slot.controllerId)));
			const admitted = new Map<string, Installation>();
			let complete = false;
			try {
				complete = await this.structure.runShared(() =>
					this.database.transaction(async (manager) => {
						if (this.runtime !== runtime || !provider.isCurrent()) return false;
						const source = await manager.findOneBy(ClimateAutomationSourceEntity, {
							generationId: slots[0].generationId,
						});
						const producer = source && this.registry.captureProducer(source.producerKey);
						if (!source?.isCurrent || source.state !== 'FINALIZED_LIVE' || !producer) return false;
						for (const slot of slots.sort((a, b) => a.controllerId.localeCompare(b.controllerId))) {
							if (!(await this.activateLocal(manager, slot, producer, true))) return false;
							const original = this.installations.get(slot.controllerId);
							if (!original) return false;
							admitted.set(slot.controllerId, original);
						}
						return (
							this.runtime === runtime &&
							provider.isCurrent() &&
							producer.isCurrent() &&
							[...admitted].every(
								([id, original]) =>
									this.installations.get(id) === original && original.providerCurrent() && original.graphCurrent(),
							)
						);
					}),
				);
				complete = complete && [...admitted].every(([id, original]) => this.installations.get(id) === original);
				if (complete) {
					const admission = {};
					this.generationAdmissions.set(slots[0].generationId, admission);
					for (const [id, original] of admitted) this.installations.set(id, { ...original, settled: true, admission });
				}
			} finally {
				if (!complete)
					for (const [id, original] of admitted) if (this.installations.get(id) === original) this.revoke(id);
			}
		}
	}
	/** Only entry paths outside structure/native ownership may await this finite predecessor set. */
	beginMutation(id: string): Promise<void> {
		const runtime = this.installations.get(id)?.runtime ?? this.localAdmissions.get(id)?.runtime ?? this.runtime;
		this.revoke(id);
		return runtime?.capture(id) ?? Promise.resolve();
	}
	registerPublication(run: (id: string) => Promise<unknown>): () => void {
		if (this.destroyed || this.publication) fail();
		const publication = Object.freeze({ run });
		this.publication = publication;
		return () => {
			if (this.publication === publication) this.publication = undefined;
		};
	}
	private async beginSourceMutation(
		producerKey: string,
		subjectId: string,
		generationId: string,
	): Promise<ClimateAutomationMutationCompletion> {
		let cohort = this.mutationCohorts.get(generationId);
		if (cohort?.closing) {
			cohort.valid = false;
			cohort = undefined;
		}
		if (!cohort) {
			const group = new Map<string, Installation>();
			for (const [id, original] of this.installations) {
				const source = JSON.parse(original.source) as { producerKey: string; subjectId: string; generationId: string };
				if (
					source.producerKey === producerKey &&
					source.subjectId === subjectId &&
					source.generationId === generationId
				)
					group.set(id, original);
			}
			cohort = {
				producerKey,
				subjectId,
				generationId,
				group,
				admission: this.generationAdmissions.get(generationId),
				owners: new Set(),
				token: {},
				valid: true,
				closing: false,
			};
			this.mutationCohorts.set(generationId, cohort);
		}
		if (cohort.producerKey !== producerKey || cohort.subjectId !== subjectId) fail();
		const originalCohort = cohort;
		const token = {};
		cohort.owners.add(token);
		const ids = new Set([
			...cohort.group.keys(),
			...[...this.localAdmissions].filter(([, pending]) => pending.generationId === generationId).map(([id]) => id),
		]);
		const jobs = [...ids].map(async (id) => {
			const original = originalCohort.group.get(id);
			const runtime = original?.runtime ?? this.localAdmissions.get(id)?.runtime ?? this.runtime;
			if (original) {
				if (this.installations.get(id) === original) {
					this.revoke(id);
					this.mutationVacancies.set(id, { original, token: originalCohort.token });
				} else if (
					this.installations.has(id) ||
					this.localAdmissions.has(id) ||
					this.mutationVacancies.get(id)?.token !== originalCohort.token
				) {
					originalCohort.valid = false;
					return;
				}
			} else this.revoke(id);
			await runtime?.capture(id);
		});
		const results = await Promise.allSettled(jobs);
		const failure = results.find((result) => result.status === 'rejected');
		let consumed = false;
		const completion = Object.freeze({
			finish: async (outcome: ClimateAutomationMutationOutcome = 'unknown') => {
				if (consumed) return;
				consumed = true;
				if (outcome !== 'rolled_back' && outcome !== 'not_started') originalCohort.valid = false;
				originalCohort.owners.delete(token);
				if (originalCohort.owners.size) return;
				originalCohort.closing = true;
				const current = () =>
					!this.destroyed &&
					originalCohort.valid &&
					this.mutationCohorts.get(generationId) === originalCohort &&
					this.generationAdmissions.get(generationId) === originalCohort.admission &&
					[...originalCohort.group].every(
						([id, original]) =>
							this.mutationVacancies.get(id)?.token === originalCohort.token &&
							this.mutationVacancies.get(id)?.original === original &&
							original.custodyCurrent(),
					);
				try {
					if (!current()) return;
					const graphCurrent = this.graph.capturePublishGuard();
					const sourceGuards = new Map(
						[...originalCohort.group].map(([id, original]) => [id, original.captureSourceCurrent()]),
					);
					const revision = await this.graph.revision();
					if (current()) await this.renewGroup(originalCohort.group, revision, graphCurrent, { current, sourceGuards });
				} finally {
					for (const id of originalCohort.group.keys())
						if (this.mutationVacancies.get(id)?.token === originalCohort.token) this.mutationVacancies.delete(id);
					if (this.mutationCohorts.get(generationId) === originalCohort) this.mutationCohorts.delete(generationId);
				}
			},
		});
		if (failure?.status === 'rejected') {
			await completion.finish('unknown');
			throw failure.reason;
		}
		return completion;
	}

	private async withAutomationWrite<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
		const provider = this.registry.captureProvider(THERMOSTAT_AUTOMATION_PROVIDER);
		if (!this.structure || this.destroyed || provider?.implementation !== this.provider) fail();
		return this.structure.runExclusive(async () => {
			const owner = this.structure.captureExclusiveOwner();
			let receipt: SqliteCommitGuardReceipt;
			return this.graph.withControllerMutationWrite(
				work,
				undefined,
				(manager) => {
					receipt = observeSqliteOuterOutcome(manager);
					registerSqliteCommitGuard(manager, () => owner() && provider.isCurrent());
				},
				() => {
					if (receipt?.outcome !== 'committed') fail();
				},
			);
		});
	}
	private async resolveAction(
		manager: EntityManager,
		id: string,
		action: ClimateAutomationJson,
	): Promise<ClimateAutomationJson | null> {
		if (!action || typeof action !== 'object' || Array.isArray(action)) return null;
		const input = action as {
			thermostat_preset?: ThermostatPreset;
			mode?: string;
			setpoint?: number;
			setpoint_delta?: number;
		};
		const row = await manager.findOneBy(VirtualThermostatConfigEntity, { controllerId: id });
		const owner = await manager.findOneBy(VirtualDeviceEntity, { id });
		if (
			!owner?.enabled ||
			owner.category !== DeviceCategory.THERMOSTAT ||
			owner.mode !== VirtualDeviceMode.CLIMATE_CONTROLLER ||
			!row?.comfort?.automation_enabled ||
			row.locked
		)
			return null;
		// Automation never changes the explicit operator OFF/mode latch or manufactures temperatures.
		if (input.thermostat_preset === undefined && input.mode !== 'heat' && input.mode !== 'cool') return null;
		let selection: Selection;
		if (input.thermostat_preset !== undefined) selection = { preset: input.thermostat_preset, setpoints: null };
		else {
			if ((input.setpoint === undefined) === (input.setpoint_delta === undefined)) return null;
			const manual = row.comfort.presets.find((preset) => preset.preset === row.comfort.selected_preset)?.setpoints;
			const values: ThermostatSetpoints = {
				heating_setpoint: manual ? manual.heating_setpoint : row.policy.heatingSetpoint,
				cooling_setpoint: manual ? manual.cooling_setpoint : row.policy.coolingSetpoint,
			};
			for (const key of [input.mode === 'heat' ? 'heating_setpoint' : 'cooling_setpoint'] as const) {
				const range = key === 'heating_setpoint' ? row.comfort.heating_range : row.comfort.cooling_range;
				if (!range) return null;
				if (input.setpoint !== undefined) values[key] = input.setpoint;
				else if (typeof values[key] === 'number') values[key] += input.setpoint_delta;
				else return null;
			}
			selection = { preset: null, setpoints: values };
		}
		return this.selection(row, asJson(selection)) ? asJson(selection) : null;
	}
	private async retireController(
		manager: EntityManager,
		slot: Readonly<ClimateAutomationSlotFacts>,
		attempt?: OwnedSettlement,
	): Promise<void> {
		if (attempt) {
			if (
				this.retiringGenerations.get(attempt.generation) !== attempt ||
				this.generationAdmissions.get(attempt.generation) !== attempt
			)
				fail();
		} else {
			const vacancy = this.mutationVacancies.get(slot.controllerId);
			if (
				!vacancy ||
				vacancy.original.slot !== canonical(slot) ||
				this.installations.has(slot.controllerId) ||
				this.localAdmissions.has(slot.controllerId)
			)
				this.revoke(slot.controllerId);
		}
		if (!['LIVE', 'PROVISIONAL'].includes(slot.state) || !slot.baselineId || !slot.selection) fail();
		const actual = await manager.findOneBy(ClimateAutomationSlotEntity, { controllerId: slot.controllerId });
		const source = await manager.findOneBy(ClimateAutomationSourceEntity, { generationId: slot.generationId });
		if (
			!actual ||
			canonical({ ...actual }) !== canonical(slot) ||
			!source ||
			source.ownerId !== slot.ownerId ||
			!source.isCurrent
		)
			fail();
		const row = await manager.findOneBy(VirtualThermostatConfigEntity, { controllerId: slot.controllerId });
		if (!row?.comfort?.automation_baseline) return;
		const mirror = row.comfort.automation_baseline;
		const selection = JSON.parse(slot.selection) as Selection;
		if (
			mirror.actor_id !== slot.baselineId ||
			canonical({ preset: mirror.preset, setpoints: mirror.setpoints }) !== canonical(selection)
		)
			return;
		const before = await readControllerMutationImage(manager, slot.controllerId);
		if (!Number.isSafeInteger(row.revision) || row.revision >= Number.MAX_SAFE_INTEGER) fail();
		row.revision++;
		row.comfort.automation_baseline = null;
		const configuration = await writeControllerPartition(manager, 'configuration', before.configuration, [row]);
		await assertControllerMutationImage(manager, slot.controllerId, { ...before, configuration });
	}
	private ownSettlement(
		slots: readonly ClimateAutomationSlotFacts[],
		owned: ClimateAutomationOwnedSettlement,
	): OwnedSettlement {
		const originals = slots.map((slot) => Object.freeze({ ...slot }));
		const generation = originals[0]?.generationId;
		if (!generation || originals.some((slot) => slot.generationId !== generation)) fail();
		const runtime = this.runtime,
			publication = this.publication;
		const retire = this.retireController.bind(this) as VirtualThermostatAutomationService['retireController'];
		const read = this.readController.bind(this) as VirtualThermostatAutomationService['readController'];
		let active = true,
			finished = false;
		let permit: ClimateAutomationRetirementPermit | undefined;
		const isSettled = owned.isSettled;
		const attempt: OwnedSettlement = Object.freeze({
			generation,
			current: () => active && owned.isCurrent(),
			settled: () => isSettled?.call(owned) === true,
		});
		const eligible = !this.retiringGenerations.has(generation);
		if (eligible) this.generationAdmissions.set(generation, attempt);
		const same = () =>
			eligible &&
			!this.destroyed &&
			this.runtime === runtime &&
			this.publication === publication &&
			this.generationAdmissions.get(generation) === attempt &&
			owned.isCurrent();
		const invalidateOriginal = () => {
			active = false;
			for (const slot of originals) {
				const original = this.installations.get(slot.controllerId);
				if (original?.attempt === attempt) this.removeOriginalInstallation(slot.controllerId, original);
				if (this.localAdmissions.get(slot.controllerId)?.attempt === attempt)
					this.localAdmissions.delete(slot.controllerId);
			}
		};
		owned.accept(
			Object.freeze({
				isCurrent: () => active && same(),
				invalidateOriginal,
				beginRetirement: () => {
					invalidateOriginal();
					if (permit) return permit;
					if (!same() || this.retiringGenerations.has(generation)) return null;
					// Closing admission and original predecessor capture are synchronous, before any await.
					this.retiringGenerations.set(generation, attempt);
					const jobs = originals.map((slot) => {
						try {
							return runtime?.capture(slot.controllerId) ?? Promise.resolve();
						} catch (cause: unknown) {
							// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Keep the original falsy predecessor cause.
							return Promise.reject(cause);
						}
					});
					const predecessors = Promise.allSettled(jobs).then((results) => {
						const failure = results.find((result) => result.status === 'rejected');
						if (failure?.status === 'rejected') throw failure.reason;
					});
					void predecessors.catch(() => undefined);
					permit = Object.freeze({
						predecessors,
						isCurrent: () => !finished && same() && this.retiringGenerations.get(generation) === attempt,
						finish: () => {
							finished = true;
							if (this.generationAdmissions.get(generation) === attempt) this.generationAdmissions.delete(generation);
							if (this.retiringGenerations.get(generation) === attempt) this.retiringGenerations.delete(generation);
						},
					});
					return permit;
				},
				retireInManager: async (manager: EntityManager) => {
					if (!permit?.isCurrent()) fail();
					for (const slot of originals) {
						if (canonical(await read(manager, slot.controllerId)) !== slot.installEvidence) fail();
						await retire(manager, slot, attempt);
					}
				},
			}),
		);
		return attempt;
	}
	private async settleInstalled(
		slots: readonly ClimateAutomationSlotFacts[],
		producer: ClimateAutomationCapturedRegistration<ClimateAutomationProducer>,
		owned?: ClimateAutomationOwnedSettlement,
	): Promise<boolean> {
		const attempt = owned ? this.ownSettlement(slots, owned) : undefined;
		const publication = this.publication,
			runtime = this.runtime;
		if (!publication || this.destroyed) return false;
		await ControllerPublicationContext.complete(async () => {
			// Original callbacks run even if a later observation or registration loses eligibility.
			for (const slot of slots) await publication.run(slot.controllerId);
		});
		if (this.publication !== publication || this.runtime !== runtime || this.destroyed) return false;
		const admitted = new Map<string, Installation>();
		const retireOriginals = () => {
			for (const [id, original] of admitted) this.removeOriginalInstallation(id, original);
			return false;
		};
		try {
			for (const slot of slots) {
				if (!(await this.activateLocal(this.database.manager, slot, producer, false, attempt)))
					return retireOriginals();
				const original = this.installations.get(slot.controllerId);
				if (!original) return retireOriginals();
				admitted.set(slot.controllerId, original);
			}
		} catch (cause: unknown) {
			retireOriginals();
			throw cause;
		}
		// These originals run after native/structural owners have returned. Joining them cannot adopt a successor runtime.
		if (runtime?.request) {
			const results = await Promise.allSettled(
				[...admitted.keys()].map((id) => Promise.resolve().then(() => runtime.request(id))),
			);
			if (results.some((result) => result.status === 'rejected')) return retireOriginals();
		}
		if (
			this.runtime !== runtime ||
			this.publication !== publication ||
			this.destroyed ||
			[...admitted].some(
				([id, original]) =>
					this.installations.get(id) !== original || !original.providerCurrent() || !original.graphCurrent(),
			)
		)
			return retireOriginals();
		for (const original of admitted.values()) original.settled = true;
		return true;
	}

	private selection(row: VirtualThermostatConfigEntity, value: ClimateAutomationJson): Selection | null {
		if (!value || typeof value !== 'object' || Array.isArray(value) || !row.comfort?.automation_enabled || row.locked)
			return null;
		const selection = value as unknown as Selection;
		if ((selection.preset === null) === (selection.setpoints === null)) return null;
		const setpoints = selection.preset
			? row.comfort.presets.find((entry) => entry.preset === selection.preset)?.setpoints
			: selection.setpoints;
		if (!setpoints || validateThermostatSetpoints(setpoints, row.comfort, row.policy).length) return null;
		return { preset: selection.preset, setpoints: selection.setpoints };
	}
	async readController(manager: EntityManager, id: string): Promise<ClimateAutomationControllerFacts | null> {
		const owner = await manager.findOneBy(VirtualDeviceEntity, { id });
		const row = await manager.findOneBy(VirtualThermostatConfigEntity, { controllerId: id });
		if (
			!owner ||
			owner.category !== DeviceCategory.THERMOSTAT ||
			owner.mode !== VirtualDeviceMode.CLIMATE_CONTROLLER ||
			row?.ownerDeviceId !== id
		)
			return null;
		return {
			controllerRevision: row.revision,
			graphRevision: await this.graph.revision(manager),
			evidence: asJson({
				owner: { id: owner.id, type: owner.type, enabled: owner.enabled, mode: owner.mode },
				image: await readControllerMutationImage(manager, id),
			}),
			legacyBaseline: asJson(row.comfort?.automation_baseline ?? null),
		};
	}
	private async installController(
		manager: EntityManager,
		slot: ClimateAutomationSlotFacts,
	): Promise<ClimateAutomationControllerFacts> {
		const before = await readControllerMutationImage(manager, slot.controllerId);
		const row = await manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: slot.controllerId });
		const current = await this.readController(manager, slot.controllerId);
		const owner = await manager.findOneBy(VirtualDeviceEntity, { id: slot.controllerId });
		if (
			!owner?.enabled ||
			!current ||
			canonical(current) !== slot.installEvidence ||
			slot.manualHold ||
			slot.state !== 'PROVISIONAL'
		)
			fail();
		const selection = this.selection(row, JSON.parse(slot.selection) as ClimateAutomationJson);
		if (!selection || (row.comfort.automation_baseline !== null && row.comfort.automation_baseline !== undefined))
			fail();
		if (!Number.isSafeInteger(row.revision) || row.revision >= Number.MAX_SAFE_INTEGER) fail();
		row.revision++;
		row.comfort.automation_baseline = { ...selection, actor_id: slot.baselineId, revision: row.revision };
		const configuration = await writeControllerPartition(manager, 'configuration', before.configuration, [row]);
		await assertControllerMutationImage(manager, slot.controllerId, { ...before, configuration });
		return this.readController(manager, slot.controllerId);
	}

	/** The caller already owns structure; observe and reserve the original clock-maintenance unit. */
	async withEvidenceWrite<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
		const owner = this.structure.captureExclusiveOwner();
		return this.database.transaction(async (manager) => {
			const receipt = observeSqliteOuterOutcome(manager);
			const window = captureSqliteNoMutationWindow(manager, owner);
			await window.reserveZeroRows('devices_module_climate_automation_slots', 'slotRevision');
			const result = await this.ledger.inAdmittedManager(manager, receipt, async () => {
				const value = await work(manager);
				// Close writes before the borrowed ledger rereads its final source/controller/slot images.
				window.beginFinalValidation();
				return value;
			});
			window.applied();
			return result;
		});
	}

	/** A skipped renewal proves zero managed mutations across membership reads and ledger completion. */
	private async withRenewalWrite(work: (manager: EntityManager) => Promise<boolean>): Promise<boolean> {
		const owner = this.structure.captureExclusiveOwner();
		return this.database.transaction(async (manager) => {
			const receipt = observeSqliteOuterOutcome(manager);
			const window = captureSqliteNoMutationWindow(manager, owner);
			await window.reserveZeroRows('devices_module_climate_automation_slots', 'slotRevision');
			const checkpoint = window.beginReads();
			const renewed = await this.ledger.inAdmittedManager(manager, receipt, async () => {
				const result = await work(manager);
				if (result === true) window.beginFinalValidation();
				else if (result !== false) fail();
				return result;
			});
			if (renewed) window.applied();
			else window.armUnchanged(checkpoint);
			return renewed;
		});
	}

	/** Completion owns no runtime work: only fully settled original groups renew their sidecar evidence. */
	private async renewCompletedGraph(revision: number, current: () => boolean): Promise<void> {
		const groups = new Map<string, Map<string, Installation>>();
		for (const [id, original] of this.installations) {
			const slot = JSON.parse(original.slot) as ClimateAutomationSlotFacts;
			const group = groups.get(slot.generationId) ?? new Map<string, Installation>();
			group.set(id, original);
			groups.set(slot.generationId, group);
		}
		for (const group of groups.values()) await this.renewGroup(group, revision, current);
	}

	private async renewGroup(
		group: ReadonlyMap<string, Installation>,
		revision: number,
		graphCurrent: () => boolean,
		recovery?: { current: () => boolean; sourceGuards: ReadonlyMap<string, () => boolean> },
	): Promise<void> {
		const first = group.values().next().value as Installation | undefined;
		if (!first || !this.structure) return;
		const generation = (JSON.parse(first.slot) as ClimateAutomationSlotFacts).generationId;
		const originalAdmission = this.generationAdmissions.get(generation);
		const sourceGuard = (id: string, original: Installation) =>
			recovery?.sourceGuards.get(id) ?? original.sourceCurrent;
		const eligible = () =>
			!this.destroyed &&
			graphCurrent() &&
			this.graph.isRevisionCurrent(revision) &&
			this.generationAdmissions.get(generation) === originalAdmission &&
			!this.retiringGenerations.has(generation) &&
			(!recovery || recovery.current()) &&
			[...group].every(
				([id, original]) =>
					original.settled &&
					original.admission === originalAdmission &&
					(!original.attempt || original.attempt.settled()) &&
					original.custodyCurrent() &&
					sourceGuard(id, original)() &&
					(recovery ? !this.installations.has(id) : this.installations.get(id) === original) &&
					!this.localAdmissions.has(id),
			);
		if (!eligible()) return;
		// Startup/deletion refresh has no structural owner; structural writers already hold the exclusive owner.
		// Never upgrade an existing native lease into this independent maintenance writer.
		if (hasCurrentSqliteConnectionLease(this.database)) fail();
		const renew = async () => {
			const owner = this.structure.captureExclusiveOwner();
			const current = () => owner() && eligible();
			if (!current()) return;
			let receipt: SqliteCommitGuardReceipt;
			const next = new Map<string, ClimateAutomationSlotFacts>();
			const renewed = await this.withRenewalWrite(async (manager) => {
				receipt = observeSqliteOuterOutcome(manager);
				const scope = this.ledger.currentScope(manager);
				const members = await manager.findBy(ClimateAutomationSlotEntity, { generationId: generation, state: 'LIVE' });
				if (!current() || members.length !== group.size || members.some((slot) => !group.has(slot.controllerId)))
					return false;
				registerSqliteCommitGuard(manager, current);
				this.graphRenewals.set(manager, {
					revision,
					current,
					slots: new Map([...group].map(([id, original]) => [id, original.slot])),
				});
				try {
					for (const [id, original] of group) {
						if (!current()) fail();
						const slot = await this.ledger.readSlot(manager, scope, id, true, THERMOSTAT_AUTOMATION_PROVIDER);
						const source =
							slot.facts && (await manager.findOneBy(ClimateAutomationSourceEntity, { generationId: generation }));
						if (
							!current() ||
							!slot.facts ||
							canonical(slot.facts) !== original.slot ||
							!source?.isCurrent ||
							source.state !== 'FINALIZED_LIVE' ||
							canonical({ ...source }) !== original.source ||
							slot.controller?.graphRevision !== revision
						)
							fail();
						const refreshed = await this.ledger.refreshInstalledSlot(manager, scope, slot, 'graph', !!recovery);
						if (!current()) fail();
						next.set(id, refreshed.facts);
					}
				} finally {
					this.graphRenewals.delete(manager);
				}
				return true;
			});
			if (!renewed) return;
			if (receipt?.outcome !== 'committed' || next.size !== group.size) fail();
			if (!owner() || !graphCurrent() || !this.graph.isRevisionCurrent(revision)) fail();
			// A local revocation after ACK cannot revive originals or poison unrelated published groups.
			if (!eligible()) return;
			const admission = {};
			this.generationAdmissions.set(generation, admission);
			for (const [id, original] of group) {
				const sourceCurrent = sourceGuard(id, original);
				this.installations.set(id, {
					...original,
					admission,
					attempt: undefined,
					slot: canonical(next.get(id)),
					graphCurrent,
					sourceCurrent,
					providerCurrent: () =>
						original.custodyCurrent() && sourceCurrent() && this.generationAdmissions.get(generation) === admission,
				});
			}
		};
		if (this.structure.hasCurrentStructuralLease()) await renew();
		else await this.structure.runExclusive(renew);
	}

	async captureInstalledIntent(manager: EntityManager, id: string): Promise<ClimateAutomationSlotSnapshot | null> {
		const scope = this.ledger.currentScope(manager);
		const slot = await this.ledger.readSlot(manager, scope, id, false);
		return slot.facts?.state === 'LIVE' && !slot.facts.manualHold
			? this.ledger.readSlot(manager, scope, id, true, THERMOSTAT_AUTOMATION_PROVIDER)
			: null;
	}
	/** A manual writer advances the graph once, then consumes the exact installed preimage. */
	async captureManualBaseline(
		manager: EntityManager,
		id: string,
		graphDelta = 1,
	): Promise<ClimateAutomationSlotSnapshot | null> {
		const owned = await this.captureInstalledIntent(manager, id);
		if (!owned) return null;
		const slot = owned.facts,
			controller = owned.controller;
		if (!slot?.installEvidence || !controller) fail();
		const installed = JSON.parse(slot.installEvidence) as ClimateAutomationControllerFacts;
		if (
			controller.graphRevision !== installed.graphRevision + graphDelta ||
			canonical({ ...controller, graphRevision: installed.graphRevision }) !== slot.installEvidence
		)
			fail();
		return owned;
	}
	/** Capture even absence before controller DML; late row birth must fail the original native unit. */
	captureManualSlot(manager: EntityManager, id: string): Promise<ClimateAutomationSlotSnapshot> {
		return this.ledger.readSlot(manager, this.ledger.currentScope(manager), id, false);
	}

	/** Enroll the applied image after sidecar writes; its exact controller remains a final ledger validator. */
	async captureAppliedAuthority(manager: EntityManager, id: string, expected: ControllerMutationImage): Promise<void> {
		const scope = this.ledger.currentScope(manager);
		await this.ledger.readSlot(manager, scope, id, true, THERMOSTAT_AUTOMATION_PROVIDER);
		await assertControllerMutationImage(manager, id, expected);
	}

	/** Enroll the complete unchanged controller image in the original ledger's final validation. */
	async captureUnchangedAuthority(manager: EntityManager, id: string): Promise<void> {
		const scope = this.ledger.currentScope(manager);
		const slot = await this.ledger.readSlot(manager, scope, id, true, THERMOSTAT_AUTOMATION_PROVIDER);
		if (
			slot.facts &&
			(![slot.facts.slotRevision, slot.facts.manualCounter].every(
				(value) => Number.isSafeInteger(value) && value >= 1,
			) ||
				![slot.facts.controllerIncarnation, slot.facts.manualGeneration].every((value) => isUUID(value)))
		)
			fail();
		if (slot.facts?.generationId) {
			const source = await manager.findOneByOrFail(ClimateAutomationSourceEntity, {
				generationId: slot.facts.generationId,
			});
			await this.ledger.readSource(manager, scope, source.producerKey, source.subjectId);
		}
	}

	async refreshIntent(
		manager: EntityManager,
		before: ClimateAutomationSlotSnapshot | null,
		kind: 'intent' | 'watermark' = 'intent',
		qualifyResult?: (intent: ThermostatResolvedAutomation) => void,
	): Promise<ClimateAutomationSlotFacts | null> {
		if (!before) return null;
		const scope = this.ledger.currentScope(manager);
		const refreshed = await this.ledger.refreshInstalledSlot(manager, scope, before, kind);
		// This synchronous view exists only for the original pending native result. The ledger
		// validates the exact producer/controller/slot again before its parent can become READY.
		let open = true;
		try {
			qualifyResult?.(
				this.selectionView(
					refreshed.facts,
					refreshed.controller.controllerRevision,
					() => open && this.ledger.currentScope(manager) === scope,
				),
			);
		} finally {
			open = false;
		}
		return refreshed.facts;
	}

	private selectionView(
		slot: ClimateAutomationSlotFacts,
		revision: number,
		isCurrent: () => boolean,
	): ThermostatResolvedAutomation {
		if (slot.state !== 'LIVE' || slot.manualHold || !slot.baselineId || !slot.selection) fail();
		const selection = JSON.parse(slot.selection) as Selection;
		return {
			baseline: { ...selection, actor_id: slot.baselineId, revision },
			manualHold: false,
			isCurrent,
		};
	}

	private async refreshController(
		manager: EntityManager,
		slot: ClimateAutomationSlotFacts,
		before: ClimateAutomationControllerFacts,
		kind: 'intent' | 'watermark' | 'graph',
	): Promise<ClimateAutomationControllerFacts> {
		const installed = JSON.parse(slot.installEvidence) as ClimateAutomationControllerFacts;
		if (kind === 'graph') {
			const original = this.graphRenewals.get(manager);
			if (
				!original?.current() ||
				original.slots.get(slot.controllerId) !== canonical(slot) ||
				before.graphRevision !== original.revision
			)
				fail();
			const after = await this.readController(manager, slot.controllerId);
			if (
				!after ||
				!Number.isSafeInteger(after.graphRevision) ||
				after.graphRevision < installed.graphRevision ||
				!original.current() ||
				canonical(after) !== canonical(before) ||
				canonical({ ...after, graphRevision: installed.graphRevision }) !== slot.installEvidence
			)
				fail();
			return after;
		}
		if (kind !== 'intent' && kind !== 'watermark') fail();
		// Ordinary intents capture after the single graph advance; deferred comfort intents capture
		// the exact installed preimage first. Both must end at exactly installed G + one intent delta.
		if (
			(before.graphRevision !== installed.graphRevision &&
				!(kind === 'intent' && before.graphRevision === installed.graphRevision + 1)) ||
			canonical({ ...before, graphRevision: installed.graphRevision }) !== canonical(installed)
		)
			fail();
		const after = await this.readController(manager, slot.controllerId);
		const row = await manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: slot.controllerId });
		if (
			!after ||
			after.controllerRevision !== before.controllerRevision + (kind === 'intent' ? 1 : 0) ||
			after.graphRevision !== installed.graphRevision + (kind === 'intent' ? 1 : 0) ||
			canonical(after.legacyBaseline) !== canonical(before.legacyBaseline) ||
			!this.selection(row, JSON.parse(slot.selection) as ClimateAutomationJson)
		)
			fail();
		const beforeEvidence = before.evidence as {
			owner: ClimateAutomationJson;
			image: Record<string, readonly Record<string, unknown>[]>;
		};
		const afterEvidence = after.evidence as {
			owner: ClimateAutomationJson;
			image: Record<string, readonly Record<string, unknown>[]>;
		};
		const oldConfig = beforeEvidence.image.configuration[0];
		const newConfig = afterEvidence.image.configuration[0];
		if (kind === 'watermark') {
			const oldComfort = JSON.parse(oldConfig.comfort as string) as ThermostatComfortConfiguration;
			const newComfort = JSON.parse(newConfig.comfort as string) as ThermostatComfortConfiguration;
			const oldOverride = oldComfort.temporary_override;
			const newOverride = newComfort.temporary_override;
			if (
				!oldOverride ||
				!newOverride ||
				newOverride.id !== oldOverride.id ||
				!Number.isFinite(newOverride.wall_watermark_ms) ||
				newOverride.wall_watermark_ms < oldOverride.wall_watermark_ms ||
				canonical({
					...newComfort,
					temporary_override: { ...newOverride, wall_watermark_ms: oldOverride.wall_watermark_ms },
				}) !== canonical(oldComfort)
			)
				fail();
		}
		if (
			canonical({
				...afterEvidence,
				image: {
					...afterEvidence.image,
					configuration: [{ ...newConfig, comfort: oldConfig.comfort, revision: oldConfig.revision }],
				},
			}) !== canonical(beforeEvidence)
		)
			fail();
		return after;
	}

	/** Called inside the already admitted controller mutation, never a second transaction. */
	async manualFence(
		manager: EntityManager,
		id: string,
		hold?: boolean,
		expected?: ClimateAutomationSlotSnapshot,
		takeover = true,
	): Promise<void> {
		this.revoke(id);
		const scope = this.ledger.currentScope(manager);
		const slot = expected ?? (await this.ledger.readSlot(manager, scope, id, false));
		if (slot.facts && slot.facts.controllerId !== id) fail();
		if (slot.facts) await this.ledger.fenceManual(manager, scope, slot, hold ?? slot.facts.manualHold, takeover);
	}

	/** Atomic metadata birth only; no process-local installation or implicit opt-in. */
	async initializeCreated(manager: EntityManager, id: string): Promise<void> {
		const scope = this.ledger.currentScope(manager);
		const expected = await this.ledger.readSlot(manager, scope, id, true, THERMOSTAT_AUTOMATION_PROVIDER);
		// A row-birth operation can never reinitialize an older incarnation, even an EMPTY one.
		if (expected.facts) fail();
		await this.ledger.initializeSlot(manager, scope, { expected, releaseManualHold: true });
	}

	/** Explicit operator opt-in only; nonnull legacy JSON is diagnostic and cannot be adopted. */
	async explicitOptIn(manager: EntityManager, id: string): Promise<void> {
		this.revoke(id);
		const scope = this.ledger.currentScope(manager);
		const row = await manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
		if (!row.comfort?.automation_enabled || row.comfort.automation_baseline != null) return;
		const slot = await this.ledger.readSlot(manager, scope, id, true, THERMOSTAT_AUTOMATION_PROVIDER);
		await this.ledger.initializeSlot(manager, scope, { expected: slot, releaseManualHold: true, explicitOptIn: true });
	}

	/** Post-ACK local admission still rechecks exact durable installation and the original registration. */
	async activateLocal(
		manager: EntityManager,
		expected: ClimateAutomationSlotFacts,
		expectedProducer?: ClimateAutomationCapturedRegistration<ClimateAutomationProducer>,
		restoring = false,
		attempt?: OwnedSettlement,
	): Promise<boolean> {
		const runtime = this.runtime;
		if (
			this.retiringGenerations.has(expected.generationId) ||
			(attempt && (!attempt.current() || this.generationAdmissions.get(expected.generationId) !== attempt))
		)
			return false;
		const prior = this.installations.get(expected.controllerId);
		const admission = Object.freeze({ generationId: expected.generationId, runtime, attempt, prior });
		if (!attempt) this.generationAdmissions.set(expected.generationId, admission);
		this.localAdmissions.set(expected.controllerId, admission);
		try {
			const provider = this.registry.captureProvider(THERMOSTAT_AUTOMATION_PROVIDER);
			if (this.destroyed || !provider || provider.implementation !== this.provider) return false;
			const slot = await manager.findOneBy(ClimateAutomationSlotEntity, { controllerId: expected.controllerId });
			const source = slot?.generationId
				? await manager.findOneBy(ClimateAutomationSourceEntity, { generationId: slot.generationId })
				: null;
			if (
				!slot ||
				canonical({ ...slot }) !== canonical(expected) ||
				slot.state !== 'LIVE' ||
				slot.manualHold ||
				!source?.isCurrent ||
				source.state !== 'FINALIZED_LIVE'
			)
				return false;
			const producer = this.registry.captureProducer(source.producerKey);
			if (
				!producer ||
				(expectedProducer &&
					(!expectedProducer.isCurrent() || producer.implementation !== expectedProducer.implementation))
			)
				return false;
			const methods = captureCreation(producer.implementation, ['validateInManager', 'captureCurrent']);
			const sourceCurrent =
				(methods.values.captureCurrent == null
					? undefined
					: invokeCreation(methods.values.captureCurrent, producer.implementation, source)) ?? (() => true);
			if (
				canonical(
					await invokeCreation(
						methods.values.validateInManager,
						producer.implementation,
						manager,
						source,
						restoring ? 'restore' : 'prepare',
						provider,
					),
				) !== source.evidence
			)
				return false;
			const controller = await this.readController(manager, slot.controllerId);
			if (
				this.runtime !== runtime ||
				this.retiringGenerations.has(expected.generationId) ||
				(attempt && (!attempt.current() || this.generationAdmissions.get(expected.generationId) !== attempt)) ||
				this.localAdmissions.get(expected.controllerId) !== admission ||
				(this.installations.get(expected.controllerId) !== prior &&
					!(
						prior &&
						this.installations.get(expected.controllerId) === undefined &&
						this.removedPredecessors.get(admission) === prior
					)) ||
				!controller ||
				canonical(controller) !== slot.installEvidence ||
				!provider.isCurrent() ||
				!producer.isCurrent() ||
				!sourceCurrent() ||
				!methods.current() ||
				(expectedProducer && !expectedProducer.isCurrent()) ||
				!this.graph.isRevisionCurrent(controller.graphRevision)
			)
				return false;
			const custodyCurrent = () =>
				!this.destroyed &&
				this.runtime === runtime &&
				provider.isCurrent() &&
				producer.isCurrent() &&
				methods.current() &&
				(!expectedProducer || expectedProducer.isCurrent());
			// A repeated durable installation still owns a fresh local admission. Sharing A's object would let late A failure revoke B.
			this.installations.set(slot.controllerId, {
				settled: !attempt && !restoring,
				admission: attempt ?? admission,
				custodyCurrent,
				sourceCurrent,
				captureSourceCurrent: () =>
					(methods.values.captureCurrent == null
						? undefined
						: invokeCreation(methods.values.captureCurrent, producer.implementation, source)) ?? (() => true),
				attempt,
				runtime,
				slot: canonical({ ...slot }),
				source: canonical({ ...source }),
				graphCurrent: this.graph.capturePublishGuard(),
				providerCurrent: () =>
					(!attempt || (attempt.current() && this.generationAdmissions.get(attempt.generation) === attempt)) &&
					this.runtime === runtime &&
					provider.isCurrent() &&
					producer.isCurrent() &&
					sourceCurrent() &&
					methods.current() &&
					(!expectedProducer || expectedProducer.isCurrent()),
			});
			return true;
		} finally {
			if (this.localAdmissions.get(expected.controllerId) === admission)
				this.localAdmissions.delete(expected.controllerId);
		}
	}

	/** The only private view for comfort GET and both runtime effective-comfort calls. */
	async resolve(manager: EntityManager, row: VirtualThermostatConfigEntity): Promise<ThermostatResolvedAutomation> {
		const slot = await manager.findOneBy(ClimateAutomationSlotEntity, { controllerId: row.controllerId });
		const installation = this.installations.get(row.controllerId);
		const absent = (manualHold = slot?.manualHold ?? false): ThermostatResolvedAutomation => ({
			baseline: null,
			manualHold,
			isCurrent: () => false,
		});
		if (
			!slot ||
			!installation ||
			slot.state !== 'LIVE' ||
			slot.manualHold ||
			canonical({ ...slot }) !== installation.slot
		)
			return absent();
		const source = await manager.findOneBy(ClimateAutomationSourceEntity, { generationId: slot.generationId });
		const controller = await this.readController(manager, row.controllerId);
		if (
			!source?.isCurrent ||
			source.state !== 'FINALIZED_LIVE' ||
			canonical({ ...source }) !== installation.source ||
			!controller ||
			canonical(controller) !== slot.installEvidence ||
			controller.controllerRevision !== row.revision
		)
			return absent();
		const isCurrent = () =>
			!this.destroyed &&
			this.installations.get(row.controllerId) === installation &&
			installation.graphCurrent() &&
			installation.providerCurrent();
		if (!isCurrent()) return absent();
		return this.selectionView(slot, row.revision, isCurrent);
	}
}
