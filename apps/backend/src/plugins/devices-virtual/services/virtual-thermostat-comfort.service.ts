import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';
import { DataSource, EntityManager } from 'typeorm';

import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
	SqliteCommitGuardReceipt,
	SqliteNoMutationWindow,
	SqliteReadCheckpoint,
	captureSqliteNoMutationWindow,
	observeSqliteOuterOutcome,
	registerSqliteCommitGuard,
} from '../../../common/database/sqlite-data-source';
import { ClimateAutomationSlotFacts } from '../../../modules/devices/contracts/climate-automation.contract';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ControllerPublicationContext } from '../../../modules/devices/services/controller-publication-context';
import { captureCreation, invokeCreation } from '../../../modules/devices/services/creation-capture';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { VirtualDeviceEntity } from '../entities/devices-virtual.entity';
import { VirtualThermostatConfigEntity } from '../entities/virtual-thermostat.entity';

import { thermostatComfortSelection } from './thermostat-comfort-selection';
import {
	ControllerMutationImage,
	assertControllerMutationImage,
	captureControllerBindings,
	readControllerMutationImage,
	writeControllerPartition,
} from './thermostat-controller-mutation';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualThermostatAutomationService } from './virtual-thermostat-automation.service';
import { VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import {
	ThermostatComfortConfiguration,
	ThermostatPreset,
	ThermostatSetpoints,
	effectiveThermostatComfort,
	validateThermostatComfort,
} from './virtual-thermostat-comfort.utils';
import { THERMOSTAT_CONFIG_CHANGED } from './virtual-thermostat-config.service';

export interface ThermostatComfortFence {
	expected_revision: number;
	expected_graph_revision: number;
}

/** Absolute persisted lifetime plus a bounded process-local budget; uncertain recovery inhibits demand. */
@Injectable()
export class VirtualThermostatComfortService {
	private readonly logger = new Logger(VirtualThermostatComfortService.name);
	private readonly leases = new Map<
		string,
		{ id: string; revision: number; deadline: number; watermark: number; status: 'expired' | 'clock_uncertain' | null }
	>();
	private readonly pendingNotifications = new Set<string>();
	constructor(
		private readonly database: DataSource,
		private readonly structure: DeviceStructureLockService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly claims: VirtualThermostatClaimsService,
		private readonly events: EventEmitter2,
		@Optional() private readonly automation?: VirtualThermostatAutomationService,
	) {}

	/** Never registers a lease from a snapshot. Stale snapshots cannot recreate discarded identities. */
	isCurrent(row: Pick<VirtualThermostatConfigEntity, 'controllerId' | 'revision' | 'comfort'>): boolean {
		const override = row.comfort?.temporary_override;
		if (override?.status === 'clock_uncertain') return false;
		if (override?.status !== 'active') return true;
		const lease = this.leases.get(row.controllerId);
		if (!lease || lease.id !== override.id || lease.revision !== row.revision) return false;
		if (!lease.status) {
			const now = Date.now(),
				monotonic = performance.now();
			lease.status =
				!Number.isFinite(now) || !Number.isFinite(monotonic)
					? 'clock_uncertain'
					: now >= Date.parse(override.expires_at) || monotonic >= lease.deadline
						? 'expired'
						: now < lease.watermark
							? 'clock_uncertain'
							: null;
			if (!lease.status) lease.watermark = Math.max(lease.watermark, now);
		}
		return !lease.status;
	}

	/** Only committed settlement makes expiry durable. A sync dispatch refusal cannot promise crash durability. */
	async settle(controllerId: string): Promise<void> {
		return ControllerPublicationContext.complete(async () => {
			const settled = await this.structure.runShared(async () => {
				const row = await this.database.manager.findOneBy(VirtualThermostatConfigEntity, { controllerId });
				if (row?.comfort?.temporary_override?.status === 'active' || this.pendingNotifications.has(controllerId))
					return false;
				this.leases.delete(controllerId);
				return true;
			});
			if (settled) return;
			// Never upgrade a shared lock. Re-read after acquiring exclusive ownership; the override may have changed.
			await this.structure.runExclusive(
				ControllerPublicationContext.captureCallback(async () => {
					const row = await this.database.manager.findOneBy(VirtualThermostatConfigEntity, { controllerId });
					const override = row?.comfort?.temporary_override;
					if (!override || override.status !== 'active') {
						this.leases.delete(controllerId);
						if (this.pendingNotifications.has(controllerId)) await this.changed(controllerId);
						return;
					}
					const now = Date.now(),
						monotonic = performance.now();
					const created = Date.parse(override.created_at),
						expiry = Date.parse(override.expires_at);
					const duration =
						override.original_duration_ms === undefined ? expiry - created : override.original_duration_ms;
					const watermark = override.wall_watermark_ms === undefined ? created : override.wall_watermark_ms;
					let lease = this.leases.get(controllerId);
					if (!lease || lease.id !== override.id) {
						const valid =
							[now, monotonic, created, expiry, duration, watermark].every(Number.isFinite) &&
							duration > 0 &&
							duration <= 7 * 86400000 &&
							expiry - created === duration &&
							watermark >= created &&
							watermark < expiry;
						lease = {
							id: override.id,
							revision: row.revision,
							deadline: monotonic + Math.max(0, Math.min(duration, expiry - now)),
							watermark,
							status:
								Number.isFinite(now) && Number.isFinite(expiry) && now >= expiry
									? 'expired'
									: !valid || now < watermark
										? 'clock_uncertain'
										: null,
						};
						this.leases.set(controllerId, lease);
					}
					lease.revision = row.revision;
					this.isCurrent(row);
					if (lease.status) {
						this.automation?.revoke(controllerId);
						let refreshed: ClimateAutomationSlotFacts | null = null;
						let receipt: SqliteCommitGuardReceipt;
						await this.graph.withControllerMutationWrite(
							async (manager) => {
								const before = await readControllerMutationImage(manager, controllerId);
								const installed = this.automation
									? await this.automation.captureInstalledIntent(manager, controllerId)
									: null;
								const current = await manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
								if (current.revision !== row.revision || current.comfort?.temporary_override?.id !== override.id)
									throw new DevicesValidationException('Thermostat revision changed during expiry settlement.');
								current.comfort.temporary_override.status = lease.status;
								current.comfort.temporary_override.terminated_at = Number.isFinite(now)
									? new Date(now).toISOString()
									: null;
								current.revision++;
								const configuration = await writeControllerPartition(manager, 'configuration', before.configuration, [
									current,
								]);
								await assertControllerMutationImage(manager, controllerId, { ...before, configuration });
								if (installed) refreshed = await this.automation.refreshIntent(manager, installed);
								await this.graph.sealControllerLedger(manager);
							},
							undefined,
							(manager) => {
								receipt = observeSqliteOuterOutcome(manager);
							},
							() => {
								if (receipt.outcome !== 'committed')
									throw new Error('Missing original expiry settlement acknowledgement');
							},
						);
						this.leases.delete(controllerId);
						await this.changed(controllerId);
						if (refreshed) await this.automation.activateLocal(this.database.manager, refreshed);
					} else {
						// Persist every observed watermark: batching would weaken rollback detection after a crash/restart.
						// This is evidence only, not an intent revision, expiry renewal or sample refresh.
						lease.watermark = Math.max(lease.watermark, now);
						if (override.wall_watermark_ms !== lease.watermark) {
							const observedComfort = JSON.stringify(row.comfort);
							override.wall_watermark_ms = lease.watermark;
							if (this.automation) {
								this.automation.revoke(controllerId);
								const refreshed = await this.automation.withEvidenceWrite(async (manager) => {
									const before = await readControllerMutationImage(manager, controllerId);
									const installed = await this.automation.captureInstalledIntent(manager, controllerId);
									const current = await manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
									if (current.revision !== row.revision || JSON.stringify(current.comfort) !== observedComfort)
										throw new DevicesValidationException('Thermostat revision changed during watermark settlement.');
									current.comfort.temporary_override.wall_watermark_ms = lease.watermark;
									const configuration = await writeControllerPartition(manager, 'configuration', before.configuration, [
										current,
									]);
									await assertControllerMutationImage(manager, controllerId, { ...before, configuration });
									return this.automation.refreshIntent(manager, installed, 'watermark');
								});
								if (refreshed) await this.automation.activateLocal(this.database.manager, refreshed);
							} else
								await this.database.transaction(async (manager) => {
									const updated = await manager.update(
										VirtualThermostatConfigEntity,
										{ controllerId, revision: row.revision },
										{ comfort: row.comfort },
									);
									if (updated.affected !== 1)
										throw new DevicesValidationException('Thermostat revision changed during watermark settlement.');
								});
						}
						if (this.pendingNotifications.has(controllerId)) await this.changed(controllerId);
					}
				}),
			);
		});
	}

	async get(controllerId: string, settle = (id: string) => this.settle(id)) {
		await settle(controllerId);
		return this.structure.runShared(async () => {
			const row = await this.database.manager.findOneBy(VirtualThermostatConfigEntity, { controllerId });
			if (!row) throw new NotFoundException('Thermostat configuration does not exist.');
			return {
				controller: controllerId,
				revision: row.revision,
				graph_revision: await this.graph.revision(),
				configuration: row.comfort,
				effective: effectiveThermostatComfort(
					row.policy,
					row.comfort,
					await this.automation?.resolve(this.database.manager, row),
				),
				clock_policy: 'bounded_absolute_recovery_with_uncertainty_inhibit' as const,
			};
		});
	}

	async configure(
		id: string,
		fence: ThermostatComfortFence,
		input: Pick<ThermostatComfortConfiguration, 'heating_range' | 'cooling_range' | 'presets'> & {
			automation_enabled?: boolean;
		},
	) {
		return this.runComfortIntent('definition', id, fence, input);
	}

	async select(
		id: string,
		fence: ThermostatComfortFence,
		preset: ThermostatPreset | null,
		clearUserOff: boolean,
	): Promise<Awaited<ReturnType<VirtualThermostatComfortService['get']>>> {
		return this.runComfortIntent('selection', id, fence, preset, clearUserOff);
	}

	/** Trusted bridge port only: no public DTO or route accepts an automation source/actor. */
	async applyAutomationBaseline(
		id: string,
		fence: ThermostatComfortFence,
		selection: { preset: ThermostatPreset | null; setpoints: ThermostatSetpoints | null } | null,
		actorId: string,
	) {
		return this.mutate(id, fence, (row) => {
			if (!row.comfort?.automation_enabled || !actorId)
				throw new DevicesValidationException(
					'Thermostat automation is not explicitly enabled or its actor is missing.',
				);
			row.comfort.automation_baseline = selection
				? { ...selection, actor_id: actorId, revision: row.revision + 1 }
				: null;
		});
	}

	async override(
		id: string,
		fence: ThermostatComfortFence,
		input: { preset: ThermostatPreset | null; setpoints: ThermostatSetpoints | null; expires_at: string },
		actorId: string,
		source: 'user' | 'panel' = 'user',
	) {
		return this.runComfortIntent('override', id, fence, input, undefined, actorId, source);
	}

	async cancel(id: string, fence: ThermostatComfortFence, overrideId: string) {
		return this.runComfortIntent('cancel', id, fence, overrideId);
	}

	private async runComfortIntent(
		kind: 'selection' | 'definition' | 'override' | 'cancel',
		id: string,
		fence: ThermostatComfortFence,
		value:
			| Parameters<ReturnType<typeof thermostatComfortSelection.pin>['definitionInput']>[2]
			| Parameters<ReturnType<typeof thermostatComfortSelection.pin>['overrideInput']>[2]
			| string
			| null,
		clearUserOff?: boolean,
		actorId?: string,
		source?: 'user' | 'panel',
	): Promise<Awaited<ReturnType<VirtualThermostatComfortService['get']>>> {
		// Service admission starts here; the controller already extracted its fields; nested inputs are still caller-owned.
		return ControllerPublicationContext.complete(async () => {
			const own = captureCreation(this, [
				'runComfortIntent',
				'database',
				'structure',
				'graph',
				'claims',
				'events',
				'leases',
				'pendingNotifications',
				'logger',
				'settle',
				'get',
				'changed',
				'isCurrent',
			] as (keyof this)[]);
			const lock = captureCreation(this.structure, [
				'runExclusive',
				'runShared',
				'hasCurrentStructuralLease',
				'context',
			] as (keyof DeviceStructureLockService)[]);
			const graph = captureCreation(this.graph, [
				'withComfortSelectionWrite',
				'edges',
				'sealControllerLedger',
				'structuralWrite',
				'refreshValidation',
				'dataSource',
				'revision',
			] as (keyof VirtualDependencyGraphService)[]);
			const claims = captureCreation(this.claims, ['invalidate', 'refresh']);
			const events = captureCreation(this.events, ['emit']);
			const helper = captureCreation(thermostatComfortSelection, ['pin']);
			const selection = helper.values.pin(
				this.database,
				kind,
				kind === 'override' || kind === 'cancel'
					? (Reflect.get(own.values, 'leases') as Parameters<typeof helper.values.pin>[2])
					: undefined,
			);
			const pins = [own, lock, graph, claims, events, helper, selection];
			const current = () => pins.every((pin) => pin.current());
			const check = () => {
				if (!current()) throw new DevicesValidationException('Original thermostat selection dispatch expired.');
			};
			const settle = Reflect.get(own.values, 'settle') as VirtualThermostatComfortService['settle'];
			const get = Reflect.get(own.values, 'get') as VirtualThermostatComfortService['get'];
			const changed = Reflect.get(own.values, 'changed') as VirtualThermostatComfortService['changed'];
			const notifications = {
				invalidate: () => claims.values.invalidate.call(claims.receiver),
				refresh: () => claims.values.refresh.call(claims.receiver),
				emit: () => events.values.emit.call(events.receiver, THERMOSTAT_CONFIG_CHANGED, id),
			};
			if (!['selection', 'definition', 'override', 'cancel'].includes(kind))
				throw new DevicesValidationException('Invalid thermostat comfort intent kind.');
			const input =
				kind === 'selection'
					? selection.input(id, fence, value as ThermostatPreset | null, clearUserOff)
					: kind === 'definition'
						? selection.definitionInput(id, fence, value as Parameters<typeof selection.definitionInput>[2])
						: kind === 'override'
							? selection.overrideInput(
									id,
									fence,
									value as Parameters<typeof selection.overrideInput>[2],
									actorId,
									source,
								)
							: selection.cancelInput(id, fence, value as string);
			check();
			let ownerCurrent = () => false;
			const operation = selection.operation(input, () => ownerCurrent(), current, true);
			let refreshedIntent: ClimateAutomationSlotFacts | null = null;
			const semantic = kind === 'definition' || kind === 'selection';
			let nativeWindow: SqliteNoMutationWindow | undefined;
			let checkpoint: SqliteReadCheckpoint | undefined;
			const readWindow = Object.freeze({
				reserveZeroRows: (table: string, column: string) => nativeWindow.reserveZeroRows(table, column),
				beginReads: () => {
					checkpoint = nativeWindow.beginReads();
				},
			});
			let predecessors: Promise<void> | undefined;
			let entryFailure: { cause: unknown } | undefined;
			try {
				predecessors = this.automation?.beginMutation(id);
			} catch (cause: unknown) {
				entryFailure = { cause };
			}
			void predecessors?.catch(() => undefined);
			try {
				// Independent maintenance may commit and make the comfort intent fence stale.
				await invokeCreation(settle, own.receiver, input.id);
			} catch (cause: unknown) {
				operation.settlement.preSettleFailure = Object.freeze({ cause });
				await predecessors?.catch(() => undefined);
				throw cause;
			}
			try {
				if (entryFailure) throw entryFailure.cause;
				if (predecessors !== undefined) await predecessors;
				await lock.values.runExclusive.call(
					lock.receiver,
					ControllerPublicationContext.captureCallback(async () => {
						check();
						// Bind the ORIGINAL async owner for the native callback, never a fresh ambient lookup.
						ownerCurrent = AsyncLocalStorage.bind(() => lock.values.hasCurrentStructuralLease.call(lock.receiver));
						operation.captureSlot();
						const write = async (manager: EntityManager, advanceGraph?: () => Promise<number>) => {
							// This capture follows mandatory original entry settlement, on the admitted native manager.
							const appliedAuthority =
								semantic && this.automation ? captureCreation(this.automation, ['captureAppliedAuthority']) : undefined;
							if (appliedAuthority) registerSqliteCommitGuard(manager, () => appliedAuthority.current());
							const manualSlot = await this.automation?.captureManualSlot(manager, id);
							const installed = this.automation ? await this.automation.captureInstalledIntent(manager, id) : null;
							const previous = this.automation
								? await manager.findOneBy(VirtualThermostatConfigEntity, { controllerId: id })
								: null;
							const before = semantic ? await readControllerMutationImage(manager, id) : undefined;
							const bindings = semantic
								? await captureControllerBindings(manager, id, before, [], (manager) =>
										graph.values.edges.call(graph.receiver, manager),
									)
								: undefined;
							let appliedImage: ControllerMutationImage | undefined;
							const result = await operation.write(
								manager,
								installed ?? undefined,
								semantic
									? {
											advanceGraph,
											canRemainUnchanged: () =>
												!installed &&
												manualSlot?.facts?.state !== 'PROVISIONAL' &&
												(kind !== 'selection' ||
													!manualSlot?.facts ||
													manualSlot.facts.manualHold === (input.kind === 'selection' && input.preset === null)) &&
												!(
													this.automation &&
													input.kind === 'definition' &&
													input.definition.automation === 'enable' &&
													!manualSlot?.facts
												),
											writeAppliedConfiguration: async (row, configuration) => {
												if (before.configuration.length !== 1)
													throw new DevicesValidationException(
														'Original complete comfort configuration image required.',
													);
												const column = manager.connection
													.getMetadata(VirtualThermostatConfigEntity)
													.findColumnWithPropertyName('comfort');
												if (!column) throw new DevicesValidationException('Original comfort column required.');
												const intendedConfiguration = Object.freeze({
													...before.configuration[0],
													comfort: manager.connection.driver.preparePersistentValue(configuration, column) as unknown,
													revision: row.revision + 1,
												});
												const update = manager
													.createQueryBuilder()
													.update(VirtualThermostatConfigEntity)
													.set({ comfort: configuration, revision: row.revision + 1 });
												// Fixed-column raw preimage, like writeControllerPartition; preserve the original refusal.
												for (const [key, value] of Object.entries(before.configuration[0]))
													update.andWhere(`"${key}" IS :old_${key}`, { [`old_${key}`]: value });
												if ((await update.execute()).affected !== 1)
													throw new DevicesValidationException('Thermostat selection lost its conditional update.');
												appliedImage = Object.freeze({
													...before,
													configuration: Object.freeze([intendedConfiguration]),
												});
												if (
													JSON.stringify(await readControllerMutationImage(manager, id)) !==
													JSON.stringify(appliedImage)
												)
													throw new DevicesValidationException(
														'Thermostat selection persisted an unexpected postimage.',
													);
											},
											verifyUnchanged: async () => {
												await assertControllerMutationImage(manager, id, before);
												await bindings();
												await this.automation?.captureUnchangedAuthority(manager, id);
											},
										}
									: undefined,
							);
							const retainInstalled =
								installed &&
								kind !== 'selection' &&
								'automation_enabled' in result.configuration &&
								result.configuration.automation_enabled &&
								result.configuration.automation_baseline != null;
							if (
								operation.changed() &&
								this.automation &&
								(kind === 'selection' || (kind === 'definition' && !retainInstalled))
							) {
								await this.automation.manualFence(
									manager,
									id,
									kind === 'definition' ? undefined : value === null,
									installed ?? manualSlot,
								);
								if (
									kind === 'definition' &&
									(!previous?.comfort?.automation_enabled ||
										(input.kind === 'definition' && input.definition.automation === 'enable' && !manualSlot?.facts))
								)
									await this.automation.explicitOptIn(manager, id);
							}
							if (operation.changed() && retainInstalled)
								refreshedIntent = await this.automation.refreshIntent(manager, installed, 'intent', (intent) =>
									operation.qualifyAutomation(intent),
								);
							if (semantic && operation.changed()) {
								if (!appliedImage) throw new DevicesValidationException('Original applied comfort image required.');
								if (appliedAuthority)
									await invokeCreation(
										appliedAuthority.values.captureAppliedAuthority,
										appliedAuthority.receiver,
										manager,
										id,
										appliedImage,
									);
								else await assertControllerMutationImage(manager, id, appliedImage);
								await bindings(before.properties, manager, result.graph_revision);
							}
							await graph.values.sealControllerLedger.call(graph.receiver, manager);
							if (semantic) {
								if (operation.changed()) nativeWindow.applied();
								else nativeWindow.armUnchanged(checkpoint);
							}
							operation.markReady();
							return result;
						};
						await graph.values.withComfortSelectionWrite.call(
							graph.receiver,
							write,
							input.expected_graph_revision,
							(manager) => {
								operation.admit(manager);
								if (semantic) nativeWindow = captureSqliteNoMutationWindow(manager, () => current() && ownerCurrent());
							},
							operation.accepted,
							undefined,
							semantic ? write : undefined,
							semantic ? readWindow : undefined,
						);
						operation.accepted();
						operation.localAction();
						// New admission proof expiry cannot discard the inherited post-ACK work.
						if (operation.changed()) await invokeCreation(changed, own.receiver, input.id, notifications);
						if (refreshedIntent) await this.automation.activateLocal(this.database.manager, refreshedIntent);
					}),
				);
			} catch (cause: unknown) {
				operation.settlement.transactionFailure = Object.freeze({ cause });
				throw cause;
			}
			try {
				// Keep the old release boundary and exactly one final get for leases, clocks and retries.
				// Its successful latest data is deliberately discarded, including a later writer's intent.
				await invokeCreation(get, own.receiver, input.id, (id) => invokeCreation(settle, own.receiver, id));
			} catch (cause: unknown) {
				operation.settlement.finalGetFailure = Object.freeze({ cause });
				throw cause;
			}
			return operation.copy();
		});
	}

	private async mutate(
		id: string,
		fence: ThermostatComfortFence,
		change: (row: VirtualThermostatConfigEntity) => void,
		afterCommit?: () => void,
	) {
		return ControllerPublicationContext.complete(async () => {
			await this.settle(id);
			await this.structure.runExclusive(
				ControllerPublicationContext.captureCallback(async () => {
					await this.graph.withStructuralWrite(async (manager) => {
						const row = await manager.findOneBy(VirtualThermostatConfigEntity, { controllerId: id });
						if (!row) throw new NotFoundException('Thermostat configuration does not exist.');
						const owner = await manager.findOneBy(VirtualDeviceEntity, { id });
						if (!owner || row.locked || row.revision !== fence.expected_revision)
							throw new DevicesValidationException('Thermostat is missing, locked or its revision changed.');
						change(row);
						const errors = validateThermostatComfort(row.comfort, row.policy);
						if (errors.length) throw new DevicesValidationException(errors.join(', '));
						row.revision++;
						await manager.save(row);
					}, fence.expected_graph_revision);
					afterCommit?.();
					await this.changed(id);
				}),
			);
			return this.get(id);
		});
	}

	private async changed(
		id: string,
		dispatch = {
			invalidate: () => this.claims.invalidate(),
			refresh: () => this.claims.refresh(),
			emit: () => this.events.emit(THERMOSTAT_CONFIG_CHANGED, id),
		},
	): Promise<void> {
		const publication = new ControllerPublicationContext(this.graph.capturePublishGuard());
		return publication.run(async () => {
			// Admission revocation is fail-closed. Publication/refresh after COMMIT cannot undo or replay the mutation.
			dispatch.invalidate();
			let failed = false;
			try {
				await dispatch.refresh();
			} catch (error) {
				failed = true;
				this.logger.error('Comfort committed; claim reconciliation awaits retry.', error);
			}
			try {
				dispatch.emit();
			} catch (error) {
				failed = true;
				this.logger.error('Comfort committed; notification awaits retry.', error);
			}
			if (failed) this.pendingNotifications.add(id);
			else this.pendingNotifications.delete(id);
		});
	}
}
