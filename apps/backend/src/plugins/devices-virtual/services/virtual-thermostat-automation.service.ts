import { isUUID } from 'class-validator';
import { DataSource, EntityManager, IsNull } from 'typeorm';

import { Injectable, OnApplicationBootstrap, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';

import {
	SqliteCommitGuardReceipt,
	observeSqliteOuterOutcome,
	registerSqliteCommitGuard,
} from '../../../common/database/sqlite-data-source';
import {
	ClimateAutomationCapturedRegistration,
	ClimateAutomationControllerFacts,
	ClimateAutomationJson,
	ClimateAutomationOwnedRegistration,
	ClimateAutomationProducer,
	ClimateAutomationProvider,
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
import { captureCreation } from '../../../modules/devices/services/creation-capture';
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
interface Installation {
	readonly runtime?: RuntimeRegistration;
	readonly slot: string;
	readonly source: string;
	readonly graphCurrent: () => boolean;
	readonly providerCurrent: () => boolean;
}
const asJson = (value: unknown): ClimateAutomationJson => JSON.parse(JSON.stringify(value)) as ClimateAutomationJson;
const fail = (): never => {
	throw new DevicesValidationException('Thermostat automation provenance or selection is unavailable.');
};

/** Plugin-owned participant. Durable LIVE rows alone never supply a process-local installation. */
@Injectable()
export class VirtualThermostatAutomationService implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy {
	private registration?: ClimateAutomationOwnedRegistration;
	private deletionSchema?: string;
	private readonly installations = new Map<string, Installation>();
	private readonly localAdmissions = new Map<
		string,
		Readonly<{ generationId: string; runtime?: RuntimeRegistration }>
	>();
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
				return this.beginMutation(expected.controllerId);
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
			settleInstalled: (slots, producer) => this.settleInstalled(slots, producer),
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
		this.runtime = undefined;
		this.publication = undefined;
		// Retain original installation records only as finite cleanup selectors after disposal; resolve refuses destroyed providers.
		this.localAdmissions.clear();
		this.registration?.dispose();
		this.registration = undefined;
	}
	revoke(id: string): void {
		this.localAdmissions.delete(id);
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
	private beginSourceMutation(producerKey: string, subjectId: string, generationId: string): Promise<void> {
		const ids = new Set(
			[...this.localAdmissions].filter(([, admission]) => admission.generationId === generationId).map(([id]) => id),
		);
		for (const [id, installation] of this.installations) {
			const source = JSON.parse(installation.source) as {
				producerKey: string;
				subjectId: string;
				generationId: string;
			};
			if (source.producerKey === producerKey && source.subjectId === subjectId && source.generationId === generationId)
				ids.add(id);
		}
		return Promise.all([...ids].map((id) => this.beginMutation(id))).then(() => undefined);
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
	private async retireController(manager: EntityManager, slot: Readonly<ClimateAutomationSlotFacts>): Promise<void> {
		this.revoke(slot.controllerId);
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
	private async settleInstalled(
		slots: readonly ClimateAutomationSlotFacts[],
		producer: ClimateAutomationCapturedRegistration<ClimateAutomationProducer>,
	): Promise<boolean> {
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
			for (const [id, original] of admitted) if (this.installations.get(id) === original) this.revoke(id);
			return false;
		};
		for (const slot of slots) {
			if (!(await this.activateLocal(this.database.manager, slot, producer))) return retireOriginals();
			const original = this.installations.get(slot.controllerId);
			if (!original) return retireOriginals();
			admitted.set(slot.controllerId, original);
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
		return this.database.transaction(async (manager) => {
			const receipt = observeSqliteOuterOutcome(manager);
			await manager.query('UPDATE "devices_module_climate_automation_slots" SET "slotRevision"="slotRevision" WHERE 0');
			return this.ledger.inAdmittedManager(manager, receipt, () => work(manager));
		});
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
		kind: 'intent' | 'watermark',
	): Promise<ClimateAutomationControllerFacts> {
		const installed = JSON.parse(slot.installEvidence) as ClimateAutomationControllerFacts;
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
	): Promise<boolean> {
		const runtime = this.runtime;
		const admission = Object.freeze({ generationId: expected.generationId, runtime });
		const prior = this.installations.get(expected.controllerId);
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
			const sourceCurrent = methods.values.captureCurrent?.call(producer.implementation, source) ?? (() => true);
			if (
				canonical(
					await methods.values.validateInManager.call(
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
				this.localAdmissions.get(expected.controllerId) !== admission ||
				this.installations.get(expected.controllerId) !== prior ||
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
			// A repeated durable installation still owns a fresh local admission. Sharing A's object would let late A failure revoke B.
			this.installations.set(slot.controllerId, {
				runtime,
				slot: canonical({ ...slot }),
				source: canonical({ ...source }),
				graphCurrent: this.graph.capturePublishGuard(),
				providerCurrent: () =>
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
