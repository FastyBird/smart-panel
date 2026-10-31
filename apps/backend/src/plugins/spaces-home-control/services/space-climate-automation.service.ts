import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';

import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';

import {
	SqliteCommitGuardReceipt,
	observeSqliteOuterOutcome,
	registerSqliteCommitGuard,
} from '../../../common/database/sqlite-data-source';
import {
	ClimateAutomationCapturedRegistration,
	ClimateAutomationJson,
	ClimateAutomationMutationOutcome,
	ClimateAutomationOwnedRegistration,
	ClimateAutomationProducer,
	ClimateAutomationProvider,
	ClimateAutomationSettlementReceipt,
	ClimateAutomationSlotFacts,
	ClimateAutomationSourceFacts,
} from '../../../modules/devices/contracts/climate-automation.contract';
import {
	ClimateAutomationSlotEntity,
	ClimateAutomationSourceEntity,
} from '../../../modules/devices/entities/climate-automation.entity';
import { ClimateAutomationLedgerService } from '../../../modules/devices/services/climate-automation-ledger.service';
import { canonical } from '../../../modules/devices/services/climate-automation-ledger.utils';
import { ClimateAutomationRegistryService } from '../../../modules/devices/services/climate-automation.registry.service';
import { CreationCapture, captureCreation, invokeCreation } from '../../../modules/devices/services/creation-capture';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { SpaceLifecycleRegistryService } from '../../../modules/spaces/services/space-lifecycle-registry.service';
import { SpaceType } from '../../../modules/spaces/spaces.constants';
import { domainResult, intentDomainResult } from '../activity/activity-result.utils';
import { ActivityActivationStatus, ActivityDomain, ActivityDomainStatus } from '../activity/space-activity.constants';
import { ClimateIntentDto } from '../dto/climate-intent.dto';
import { SpaceActivityConfigEntity } from '../entities/space-activity-config.entity';
import { SpaceActivityStateEntity } from '../entities/space-activity-state.entity';
import { ActivityClimateModel } from '../models/activity-configuration.model';
import { ActivityDomainResultModel } from '../models/activity-result.model';
import { ClimateIntentType, ClimateMode, SetpointDelta } from '../spaces-home-control.constants';

import { ClimateIntentService } from './climate-intent.service';
import {
	SpaceActivationIdentity,
	SpaceClimateAutomationPort,
	SpaceClimateCompletion,
} from './space-climate-automation.port';
import { PrimaryClimateDevice } from './space-climate-state.service';

interface ProviderParticipant extends ClimateAutomationCapturedRegistration<ClimateAutomationProvider> {
	readonly methods: CreationCapture<ClimateAutomationProvider>['values'];
}

interface SourceMutationCohort {
	readonly owners: Set<object>;
	readonly results: {
		outcome: ClimateAutomationMutationOutcome;
		finish?: (outcome: ClimateAutomationMutationOutcome) => Promise<void>;
	}[];
}

interface ActivityLifetime {
	readonly subjectId: string;
	readonly configurationKey: string;
	readonly activationKey: string;
	readonly evidence: string;
	readonly subjectEpoch: object;
	readonly configurationEpoch: object;
}

/** Expected selection refusal; the original native bundle still rolls back before it is reported. */
class UnsupportedThermostatSelection extends Error {}
class SupersededCompletion extends Error {}
interface ActivityAttempt {
	completed?: boolean;
	receipt?: ClimateAutomationSettlementReceipt;
	source?: ClimateAutomationSourceFacts;
	slots?: readonly ClimateAutomationSlotFacts[];
	provider?: ProviderParticipant;
	failure?: { cause: unknown };
	cleanupFailure?: { cause: unknown };
}

export const SPACE_ACTIVITY_CLIMATE_PRODUCER = 'space-activity:v1';
interface ActivityEvidence {
	readonly spaceId: string;
	readonly spaceType: SpaceType;
	readonly activationId: string;
	readonly configId: string;
	readonly configurationRevision: number;
	readonly mode: string;
	/** Exact stored authoring bytes, not a normalized copy or activity-name inference. */
	readonly configuration: string;
	readonly targets: readonly { id: string; role: string | null }[];
}

/** Private activity participant. Registration occurs only in the application lifecycle, never in a constructor. */
@Injectable()
export class SpaceClimateAutomationService implements OnModuleInit, OnModuleDestroy, SpaceClimateAutomationPort {
	private readonly completions = new WeakMap<SpaceActivationIdentity, { attempt?: ActivityAttempt }>();
	private readonly participants = new Map<ClimateAutomationProvider, ProviderParticipant>();
	private registration?: ClimateAutomationOwnedRegistration;
	private removeLifecycle?: () => void;
	private destroyed = false;
	private readonly epochs = new Map<string, object>();
	private readonly mutations = new Map<string, Set<object>>();
	private readonly completionCohorts = new Map<string, SourceMutationCohort>();
	private readonly activeLifetimes = new Map<string, ActivityLifetime>();
	private admissionEpoch: object = {};
	private readonly producer: ClimateAutomationProducer = {
		captureCurrent: (source) => {
			const evidence = JSON.parse(source.evidence) as ActivityEvidence;
			const configurationKey = `${source.subjectId}/${evidence.configId}`;
			const activationKey = `${source.subjectId}/activation/${evidence.activationId}`;
			const blocked = () =>
				this.destroyed ||
				this.mutations.has(source.subjectId) ||
				this.mutations.has(configurationKey) ||
				this.mutations.has(activationKey);
			if (blocked()) return () => false;
			let lifetime = this.activeLifetimes.get(source.subjectId);
			if (lifetime && lifetime.evidence !== source.evidence) return () => false;
			const admissionEpoch = this.admissionEpoch;
			return () => {
				if (!lifetime) {
					// No map entry or authority is allocated before independent native source validation.
					if (this.admissionEpoch !== admissionEpoch || blocked()) return false;
					const qualified = this.activeLifetimes.get(source.subjectId);
					if (!qualified) return true;
					if (qualified.evidence !== source.evidence) return false;
					lifetime = qualified;
				}
				return this.lifetimeCurrent(lifetime);
			};
		},
		validateInManager: (manager, source, purpose, provider) => this.validateSource(manager, source, purpose, provider),
	};
	constructor(
		private readonly database: DataSource,
		private readonly registry: ClimateAutomationRegistryService,
		private readonly ledger: ClimateAutomationLedgerService,
		private readonly structure: DeviceStructureLockService,
		private readonly lifecycle: SpaceLifecycleRegistryService,
		@Optional() private readonly intents?: ClimateIntentService,
	) {}
	onModuleInit(): void {
		if (process.env.FB_CLI === 'on') return;
		if (this.destroyed || this.registration) throw new Error('Activity climate participant unavailable');
		this.registration =
			this.registry.registerProducerOwned(SPACE_ACTIVITY_CLIMATE_PRODUCER, this.producer) ?? undefined;
		if (!this.registration) throw new Error('Activity climate producer already registered');
		this.removeLifecycle = this.lifecycle.register({
			reconcile: async () => {},
			beforeAdmission: async (id) => {
				const release = this.blockAdmission(id, id);
				try {
					const finish = await this.capturePredecessors(id);
					return async (outcome) => {
						await release(outcome ?? 'unknown', finish);
					};
				} catch (cause) {
					await release('unknown');
					throw cause;
				}
			},
			beforeMutation: (id, kind, manager) => this.retireInManager(manager, id, undefined, kind === 'delete'),
		});
	}
	onModuleDestroy(): void {
		this.destroyed = true;
		this.removeLifecycle?.();
		this.removeLifecycle = undefined;
		this.registration?.dispose();
		this.registration = undefined;
		this.epochs.clear();
		this.activeLifetimes.clear();
		this.mutations.clear();
		this.completionCohorts.clear();
	}

	/** Admission and installed currentness share immutable evidence, but deliberately differ in status policy. */
	async readEvidence(
		manager: EntityManager,
		spaceId: string,
		activationId: string,
		installed: boolean,
		restoring = false,
	): Promise<ActivityEvidence | null> {
		if (manager === this.database.manager)
			return this.database.transaction((original) =>
				this.readEvidence(original, spaceId, activationId, installed, restoring),
			);
		if (!manager.queryRunner?.isTransactionActive || manager.connection !== this.database)
			throw new Error('Original activity read manager unavailable');
		const space = await manager.findOneBy(SpaceEntity, { id: spaceId });
		if (!space || ![SpaceType.ROOM, SpaceType.ZONE].includes(space.type)) return null;
		const state = await manager.findOneBy(SpaceActivityStateEntity, { spaceId, activationId });
		if (!state?.selectedActivityMode) return null;
		const activating = !restoring && state.activityStatus === ActivityActivationStatus.ACTIVATING;
		const completed =
			installed &&
			[ActivityActivationStatus.ACTIVE, ActivityActivationStatus.PARTIAL].includes(state.activityStatus) &&
			state.activityResults?.some(
				(result) => result.domain === ActivityDomain.CLIMATE && result.status === ActivityDomainStatus.SUCCEEDED,
			);
		if (!activating && !completed) return null;
		const config = await manager.findOneBy(SpaceActivityConfigEntity, {
			spaceId,
			activityMode: state.selectedActivityMode,
			activityRevision: state.selectedActivityRevision,
			activityEnabled: true,
		});
		if (!config?.activityConfiguration.climate.enabled) return null;
		const rows = await manager.query<{ activityConfiguration: string }[]>(
			'SELECT "activityConfiguration" FROM "spaces_module_space_roles" WHERE "id"=? AND "type"=\'activity_config\'',
			[config.id],
		);
		if (rows.length !== 1 || typeof rows[0].activityConfiguration !== 'string') return null;
		return {
			spaceId,
			spaceType: space.type,
			activationId,
			configId: config.id,
			configurationRevision: config.activityRevision,
			mode: config.activityMode,
			configuration: rows[0].activityConfiguration,
			targets: this.intents
				? (await this.intents.planAutomationTargets(spaceId, manager))
						.map(({ device, role }) => ({ id: device.id, role }))
						.sort((a, b) => a.id.localeCompare(b.id))
				: [],
		};
	}
	private async validateSource(
		manager: EntityManager,
		source: Readonly<ClimateAutomationSourceFacts>,
		purpose: 'prepare' | 'retire' | 'restore',
		restoredProvider?: ClimateAutomationCapturedRegistration<ClimateAutomationProvider>,
	): Promise<ClimateAutomationJson | null> {
		if (
			this.destroyed ||
			source.producerKey !== SPACE_ACTIVITY_CLIMATE_PRODUCER ||
			purpose === 'retire' ||
			(purpose === 'restore' && source.state !== 'FINALIZED_LIVE')
		)
			return null;
		// Fresh startup explicitly binds the original restoring participant. Cleanup never discovers a successor after await.
		if (purpose === 'restore' && (!restoredProvider || !restoredProvider.isCurrent())) return null;
		const originalProvider = purpose === 'restore' ? this.provider(restoredProvider) : undefined;
		let expected: ActivityEvidence;
		try {
			expected = JSON.parse(source.evidence) as ActivityEvidence;
		} catch {
			return null;
		}
		if (!expected || expected.spaceId !== source.subjectId || typeof expected.activationId !== 'string') return null;
		const actual = await this.readEvidence(
			manager,
			source.subjectId,
			expected.activationId,
			source.state === 'FINALIZED_LIVE',
			purpose === 'restore',
		);
		if (!actual || canonical(actual) !== source.evidence || (originalProvider && !originalProvider.isCurrent()))
			return null;
		this.qualifyLifetime(actual);
		return actual as unknown as ClimateAutomationJson;
	}

	private lifetimeCurrent(lifetime: ActivityLifetime): boolean {
		return (
			!this.destroyed &&
			this.activeLifetimes.get(lifetime.subjectId) === lifetime &&
			this.epochs.get(lifetime.subjectId) === lifetime.subjectEpoch &&
			this.epochs.get(lifetime.configurationKey) === lifetime.configurationEpoch &&
			!this.mutations.has(lifetime.subjectId) &&
			!this.mutations.has(lifetime.configurationKey) &&
			!this.mutations.has(lifetime.activationKey)
		);
	}
	private qualifyLifetime(evidence: ActivityEvidence): ActivityLifetime {
		const configurationKey = `${evidence.spaceId}/${evidence.configId}`;
		const activationKey = `${evidence.spaceId}/activation/${evidence.activationId}`;
		if (
			this.destroyed ||
			this.mutations.has(evidence.spaceId) ||
			this.mutations.has(configurationKey) ||
			this.mutations.has(activationKey)
		)
			throw new SupersededCompletion();
		const value = canonical(evidence);
		const existing = this.activeLifetimes.get(evidence.spaceId);
		if (existing?.evidence === value && this.lifetimeCurrent(existing)) return existing;
		const lifetime = Object.freeze({
			subjectId: evidence.spaceId,
			configurationKey,
			activationKey,
			evidence: value,
			subjectEpoch: this.captureEpoch(evidence.spaceId),
			configurationEpoch: this.captureEpoch(configurationKey),
		});
		this.activeLifetimes.set(evidence.spaceId, lifetime);
		return lifetime;
	}

	private captureEpoch(key: string): object {
		let epoch = this.epochs.get(key);
		if (!epoch) {
			epoch = {};
			this.epochs.set(key, epoch);
		}
		return epoch;
	}
	private blockAdmission(
		key: string,
		subject: string,
	): (
		outcome: ClimateAutomationMutationOutcome,
		finish?: (outcome: ClimateAutomationMutationOutcome) => Promise<void>,
	) => Promise<void> {
		this.admissionEpoch = {};
		const lifetime = this.activeLifetimes.get(subject);
		if (lifetime && (key === subject || key === lifetime.configurationKey || key === lifetime.activationKey))
			this.activeLifetimes.delete(subject);
		this.epochs.set(key, {});
		const token = {};
		const owners = this.mutations.get(key) ?? new Set<object>();
		owners.add(token);
		this.mutations.set(key, owners);
		const cohort: SourceMutationCohort = this.completionCohorts.get(subject) ?? {
			owners: new Set<object>(),
			results: [],
		};
		cohort.owners.add(token);
		this.completionCohorts.set(subject, cohort);
		let consumed = false;
		return async (outcome, finish) => {
			if (consumed) return;
			consumed = true;
			owners.delete(token);
			if (!owners.size && this.mutations.get(key) === owners) {
				this.mutations.delete(key);
				this.epochs.delete(key);
			}
			cohort.results.push({ outcome, finish });
			cohort.owners.delete(token);
			if (cohort.owners.size) return;
			if (this.completionCohorts.get(subject) === cohort) this.completionCohorts.delete(subject);
			if (!this.activeLifetimes.has(subject))
				for (const key of this.epochs.keys())
					if ((key === subject || key.startsWith(subject + '/')) && !this.mutations.has(key)) this.epochs.delete(key);
			const eligible =
				!this.destroyed &&
				cohort.results.every(({ outcome }) => outcome === 'rolled_back' || outcome === 'not_started');
			const results = await Promise.allSettled(
				cohort.results.map(({ outcome, finish }) =>
					Promise.resolve().then(() => finish?.(eligible ? outcome : 'unknown')),
				),
			);
			const failure = results.find((result) => result.status === 'rejected');
			if (failure?.status === 'rejected') throw failure.reason;
		};
	}

	private async capturePredecessors(
		spaceId: string,
		activationId?: string,
		configId?: string,
	): Promise<(outcome: ClimateAutomationMutationOutcome) => Promise<void>> {
		// This preliminary read is only a finite cleanup selector. Native mutation rechecks the exact current generation.
		const source = await this.database.manager.findOneBy(ClimateAutomationSourceEntity, {
			producerKey: SPACE_ACTIVITY_CLIMATE_PRODUCER,
			subjectId: spaceId,
			isCurrent: true,
		});
		if (!source) return () => Promise.resolve();
		const evidence = JSON.parse(source.evidence) as ActivityEvidence;
		if (
			(activationId !== undefined && evidence.activationId !== activationId) ||
			(configId !== undefined && evidence.configId !== configId)
		)
			return () => Promise.resolve();
		const jobs = [...this.participants.values()].map(({ implementation, methods }) => {
			try {
				return methods.beginSourceMutation === undefined || methods.beginSourceMutation === null
					? undefined
					: invokeCreation(
							methods.beginSourceMutation,
							implementation,
							SPACE_ACTIVITY_CLIMATE_PRODUCER,
							spaceId,
							source.generationId,
						);
			} catch (cause: unknown) {
				// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Preserve the exact original participant refusal, including falsy causes.
				return Promise.reject(cause);
			}
		});
		const results = await Promise.allSettled(jobs);
		const failure = results.find((result) => result.status === 'rejected');
		let completed = false;
		const finish = async (outcome: ClimateAutomationMutationOutcome) => {
			if (completed) return;
			completed = true;
			for (const result of results)
				if (result.status === 'fulfilled' && result.value) {
					try {
						await result.value.finish(outcome);
					} catch {
						/* Recovery never replaces the original native result. */
					}
				}
		};
		if (failure?.status === 'rejected') {
			await finish('unknown');
			throw failure.reason;
		}
		return finish;
	}
	private virtual(target: PrimaryClimateDevice): boolean {
		return target.device.type === 'virtual' && Reflect.get(target.device, 'mode') === 'climate_controller';
	}
	private provider(original?: ClimateAutomationCapturedRegistration<ClimateAutomationProvider>): ProviderParticipant {
		const provider = original ?? this.registry.captureProvider('virtual-thermostat:v1');
		if (
			!provider?.isCurrent() ||
			!provider.implementation.withAutomationWrite ||
			!provider.implementation.resolveActionInManager ||
			!provider.implementation.settleInstalled
		)
			throw new Error('Trusted thermostat provider unavailable');
		let participant = this.participants.get(provider.implementation);
		if (!participant) {
			const capture = captureCreation(provider.implementation, [
				'withAutomationWrite',
				'resolveActionInManager',
				'settleInstalled',
				'ownedSettlementVersion',
				'beginSourceMutation',
				'retireControllerInManager',
			]);
			participant = {
				implementation: provider.implementation,
				methods: capture.values,
				isCurrent: () => provider.isCurrent() && capture.current(),
			};
			this.participants.set(provider.implementation, participant);
		}
		if (!participant.isCurrent()) throw new Error('Original thermostat participant changed');
		return participant;
	}
	async preview(spaceId: string, selection: ActivityClimateModel): Promise<ActivityDomainResultModel> {
		if (!this.intents)
			return domainResult(ActivityDomain.CLIMATE, ActivityDomainStatus.UNSUPPORTED, 'climate_intent_unavailable');
		const targets = await this.database.transaction((manager) => this.intents.planAutomationTargets(spaceId, manager));
		if (!targets.length)
			return domainResult(ActivityDomain.CLIMATE, ActivityDomainStatus.NO_TARGETS, 'no_compatible_climate_targets');
		const virtual = targets.filter((target) => this.virtual(target));
		let provider: ProviderParticipant | null = null;
		if (virtual.length) {
			try {
				provider = this.provider();
			} catch {
				return domainResult(
					ActivityDomain.CLIMATE,
					ActivityDomainStatus.UNSUPPORTED,
					'thermostat_provider_unavailable',
				);
			}
		}
		for (const target of virtual)
			if (
				!(await invokeCreation(
					provider.methods.resolveActionInManager,
					provider.implementation,
					this.database.manager,
					target.device.id,
					selection as unknown as ClimateAutomationJson,
				))
			)
				return domainResult(
					ActivityDomain.CLIMATE,
					ActivityDomainStatus.UNSUPPORTED,
					'thermostat_selection_or_opt_in_unavailable',
				);
		if (selection.thermostat_preset && virtual.length !== targets.length)
			return domainResult(
				ActivityDomain.CLIMATE,
				ActivityDomainStatus.UNSUPPORTED,
				'physical_target_preset_unsupported',
			);
		if (provider && !provider.isCurrent())
			return domainResult(ActivityDomain.CLIMATE, ActivityDomainStatus.UNSUPPORTED, 'thermostat_provider_expired');
		return domainResult(ActivityDomain.CLIMATE, ActivityDomainStatus.READY, 'explicit_operator_climate_selection');
	}
	async apply(identity: SpaceActivationIdentity, selection: ActivityClimateModel): Promise<ActivityDomainResultModel> {
		const attempt: ActivityAttempt = {};
		const completion = this.completions.get(identity);
		if (completion && !completion.attempt) completion.attempt = attempt;
		if (!this.intents) throw new Error('Climate intent unavailable');
		const initial = await this.database.transaction(async (manager) => ({
			evidence: await this.readEvidence(manager, identity.spaceId, identity.activationId, false),
			targets: await this.intents.planAutomationTargets(identity.spaceId, manager),
		}));
		if (
			!initial.evidence ||
			initial.evidence.configurationRevision !== identity.configurationRevision ||
			canonical((JSON.parse(initial.evidence.configuration) as { climate: ActivityClimateModel }).climate) !==
				canonical(selection)
		)
			throw new Error('Activity source changed');
		const lifetime = this.qualifyLifetime(initial.evidence);
		const targets = initial.targets;
		const physicalIds = new Set(targets.filter((target) => !this.virtual(target)).map((target) => target.device.id));
		// A climate UNSUPPORTED result cannot authorize a finalized virtual source. Refuse before installing any bundle.
		if (selection.thermostat_preset && physicalIds.size)
			return domainResult(
				ActivityDomain.CLIMATE,
				ActivityDomainStatus.UNSUPPORTED,
				'physical_target_preset_unsupported',
			);
		if (physicalIds.size) {
			const physical = (await this.intents.planAutomationTargets(identity.spaceId)).filter((target) =>
				physicalIds.has(target.device.id),
			);
			if (physical.length !== physicalIds.size) throw new Error('Activity physical target plan changed');
			for (const target of physical)
				targets[targets.findIndex((candidate) => candidate.device.id === target.device.id)] = target;
		}
		const virtual = targets.filter((target) => this.virtual(target));
		if (!targets.length)
			return domainResult(ActivityDomain.CLIMATE, ActivityDomainStatus.NO_TARGETS, 'no_compatible_climate_targets');
		const provider = virtual.length ? this.provider() : null;
		if (provider && provider.methods.ownedSettlementVersion !== 1)
			throw new Error('Owned thermostat settlement unavailable');
		attempt.provider = provider;
		const originalProducer = this.registry.captureProducer(SPACE_ACTIVITY_CLIMATE_PRODUCER);
		if (originalProducer?.implementation !== this.producer) throw new Error('Original activity producer unavailable');
		let admitted = true;
		const authorityCurrent = () =>
			originalProducer.isCurrent() && this.lifetimeCurrent(lifetime) && (!provider || provider.isCurrent());
		const current = () => admitted && authorityCurrent();
		const owned = {
			isSettled: () => attempt.completed === true,
			isCurrent: authorityCurrent,
			accept: (receipt: ClimateAutomationSettlementReceipt) => {
				if (attempt.receipt) throw new Error('Original settlement already captured');
				attempt.receipt = receipt;
			},
		};
		const install = async () => {
			if (!current() || !(await identity.isCurrent())) throw new Error('Activity superseded');
			const repeated = await this.database.transaction(async (manager) => {
				const source = await manager.findOneBy(ClimateAutomationSourceEntity, {
					producerKey: SPACE_ACTIVITY_CLIMATE_PRODUCER,
					subjectId: identity.spaceId,
					isCurrent: true,
				});
				if (!source || (JSON.parse(source.evidence) as ActivityEvidence).activationId !== identity.activationId)
					return null;
				const evidence = await this.readEvidence(manager, identity.spaceId, identity.activationId, true);
				if (source.state !== 'FINALIZED_LIVE' || canonical(evidence) !== source.evidence)
					throw new Error('Original activity installation cannot be replayed');
				const slots = await manager.findBy(ClimateAutomationSlotEntity, {
					generationId: source.generationId,
					ownerId: source.ownerId,
				});
				if (
					slots.some((slot) => slot.state !== 'LIVE' || slot.manualHold) ||
					canonical(slots.map((slot) => slot.controllerId).sort()) !==
						canonical(virtual.map((target) => target.device.id).sort())
				)
					throw new Error('Original activity candidate retired or changed');
				attempt.source = { ...source };
				return slots.map((slot) => ({ ...slot }));
			});
			if (repeated) {
				attempt.slots = repeated;
				if (
					!(await invokeCreation(
						provider.methods.settleInstalled,
						provider.implementation,
						repeated,
						originalProducer,
						owned,
					)) ||
					!current() ||
					!attempt.receipt
				)
					throw new Error('Original installation is no longer eligible');
				return repeated.length;
			}
			let installed: readonly ClimateAutomationSlotFacts[] = [];
			await invokeCreation(provider.methods.withAutomationWrite, provider.implementation, async (manager) => {
				const evidence = await this.readEvidence(manager, identity.spaceId, identity.activationId, false);
				if (
					!current() ||
					!evidence ||
					evidence.configurationRevision !== identity.configurationRevision ||
					canonical((JSON.parse(evidence.configuration) as { climate: ActivityClimateModel }).climate) !==
						canonical(selection)
				)
					throw new Error('Activity source changed');
				const actualTargets = await this.intents.planAutomationTargets(identity.spaceId, manager);
				if (
					canonical(actualTargets.map((target) => target.device.id).sort()) !==
					canonical(targets.map((target) => target.device.id).sort())
				)
					throw new Error('Activity target plan changed');
				const scope = this.ledger.currentScope(manager);
				const prior = await this.ledger.readSource(manager, scope, SPACE_ACTIVITY_CLIMATE_PRODUCER, identity.spaceId);
				if (prior.facts && ['PENDING', 'FINALIZED_LIVE'].includes(prior.facts.state))
					await this.retireInManager(manager, identity.spaceId);
				const expected = await this.ledger.readSource(
					manager,
					scope,
					SPACE_ACTIVITY_CLIMATE_PRODUCER,
					identity.spaceId,
				);
				const source = await this.ledger.stageSource(manager, scope, {
					producerKey: SPACE_ACTIVITY_CLIMATE_PRODUCER,
					subjectId: identity.spaceId,
					expected,
					evidence: evidence as unknown as ClimateAutomationJson,
				});
				const candidates = [];
				const bundleId = randomUUID();
				for (const target of virtual.sort((a, b) => a.device.id.localeCompare(b.device.id))) {
					const action = await invokeCreation(
						provider.methods.resolveActionInManager,
						provider.implementation,
						manager,
						target.device.id,
						selection as unknown as ClimateAutomationJson,
					);
					if (action === null) throw new UnsupportedThermostatSelection('Unsupported thermostat selection');
					let slot = await this.ledger.readSlot(manager, scope, target.device.id, true, 'virtual-thermostat:v1');
					if (!slot.facts)
						slot = await this.ledger.initializeSlot(manager, scope, { expected: slot, releaseManualHold: true });
					candidates.push(
						await this.ledger.stageSlot(manager, scope, {
							expectedSlot: slot,
							expectedSource: source,
							selection: action,
							bundleId,
						}),
					);
				}
				installed = (await this.ledger.installBundle(manager, scope, source, candidates)).map((slot) => slot.facts);
				attempt.source = (
					await this.ledger.readSource(manager, scope, SPACE_ACTIVITY_CLIMATE_PRODUCER, identity.spaceId)
				).facts;
				registerSqliteCommitGuard(manager, current);
			});
			attempt.slots = installed;
			if (
				!(await invokeCreation(
					provider.methods.settleInstalled,
					provider.implementation,
					installed,
					originalProducer,
					owned,
				)) ||
				!current() ||
				!attempt.receipt
			)
				throw new Error('Committed climate installation remains inhibited');
			return installed.length;
		};
		const intent: ClimateIntentDto =
			selection.setpoint_delta !== undefined
				? {
						type: ClimateIntentType.SETPOINT_DELTA,
						delta: SetpointDelta.SMALL,
						increase: selection.setpoint_delta >= 0,
					}
				: selection.setpoint !== undefined
					? {
							type: ClimateIntentType.CLIMATE_SET,
							mode: selection.mode,
							...(selection.mode === ClimateMode.COOL
								? { coolingSetpoint: selection.setpoint }
								: { heatingSetpoint: selection.setpoint }),
						}
					: { type: ClimateIntentType.SET_MODE, mode: selection.mode };
		try {
			if (!(await identity.isCurrent())) throw new Error('Activity superseded');
			const result = await this.intents.executeClimateIntent(identity.spaceId, intent, {
				targets,
				virtualTargetIds: virtual.map((target) => target.device.id),
				installVirtual: provider ? install : undefined,
				isCurrent: current,
				numericDelta: selection.setpoint_delta === undefined ? undefined : Math.abs(selection.setpoint_delta),
				numericDeltaMode:
					selection.setpoint_delta === undefined
						? undefined
						: selection.mode === ClimateMode.HEAT
							? ClimateMode.HEAT
							: selection.mode === ClimateMode.COOL
								? ClimateMode.COOL
								: undefined,
			});
			const outcome = intentDomainResult(ActivityDomain.CLIMATE, result);
			if (outcome.status !== ActivityDomainStatus.SUCCEEDED) attempt.receipt?.invalidateOriginal();
			return outcome;
		} catch (cause: unknown) {
			attempt.failure = { cause };
			attempt.receipt?.invalidateOriginal();
			if (cause instanceof UnsupportedThermostatSelection && current())
				return domainResult(
					ActivityDomain.CLIMATE,
					ActivityDomainStatus.UNSUPPORTED,
					'thermostat_selection_or_opt_in_unavailable',
				);
			throw cause;
		} finally {
			admitted = false;
		}
	}
	/** Bind once before domain dispatch; a repeated apply cannot replace this original completion. */
	captureCompletion(identity: SpaceActivationIdentity): SpaceClimateCompletion {
		if (this.completions.has(identity)) throw new Error('Activity completion already captured');
		const original: { attempt?: ActivityAttempt } = {};
		this.completions.set(identity, original);
		return async (results, write) => {
			const attempt = original.attempt;
			if (!attempt?.source) return write(this.database.manager);
			const receipt = attempt.receipt,
				provider = attempt.provider;
			if (!receipt || !provider) throw new Error('Original installed completion unavailable');
			const failed =
				results.find((result) => result.domain === ActivityDomain.CLIMATE)?.status !== ActivityDomainStatus.SUCCEEDED;
			const permit = failed ? receipt.beginRetirement() : undefined;
			if (failed ? !permit : !receipt.isCurrent()) return false;
			const current = () =>
				!this.destroyed && provider.isCurrent() && (permit ? permit.isCurrent() : receipt.isCurrent());
			try {
				await permit?.predecessors;
				return await this.structure.runExclusive(async () => {
					const owner = this.structure.captureExclusiveOwner();
					let native: ReturnType<typeof observeSqliteOuterOutcome>;
					const result = await this.database.transaction(async (manager) => {
						native = observeSqliteOuterOutcome(manager);
						registerSqliteCommitGuard(manager, () => owner() && current());
						await manager.query('UPDATE "spaces_module_space_roles" SET "id"="id" WHERE 0');
						return this.ledger.inAdmittedManager(manager, native, async (scope) => {
							if (!current()) throw new SupersededCompletion();
							const source = await this.ledger.readSource(
								manager,
								scope,
								SPACE_ACTIVITY_CLIMATE_PRODUCER,
								identity.spaceId,
							);
							if (canonical(source.facts) !== canonical(attempt.source)) throw new SupersededCompletion();
							const slots = [];
							for (const expected of attempt.slots) {
								const slot = await this.ledger.readSlot(manager, scope, expected.controllerId, false);
								if (canonical(slot.facts) !== canonical(expected)) throw new SupersededCompletion();
								slots.push(slot);
							}
							if (failed) {
								await receipt.retireInManager(manager);
								await this.ledger.revokeSource(manager, scope, source, slots);
							}
							if (!(await write(manager))) throw new SupersededCompletion();
							return true;
						});
					});
					if (native?.outcome !== 'committed') throw new Error('Activity completion acknowledgement unavailable');
					if (!failed && current() && result) attempt.completed = true;
					return result;
				});
			} catch (cause: unknown) {
				if (cause instanceof SupersededCompletion) return false;
				attempt.cleanupFailure = { cause };
				if (attempt.failure) throw attempt.failure.cause;
				throw cause;
			} finally {
				permit?.finish();
			}
		};
	}
	withdraw(identity: SpaceActivationIdentity): Promise<void> {
		return this.mutate(identity.spaceId, identity.activationId, async () => {});
	}

	/** Exact original generation cleanup needs neither a live provider nor adoption of its replacement. */
	async retireInManager(
		manager: EntityManager,
		spaceId: string,
		activationId?: string,
		deleted = false,
		configId?: string,
	): Promise<void> {
		const scope = this.ledger.currentScope(manager);
		const source = await this.ledger.readSource(manager, scope, SPACE_ACTIVITY_CLIMATE_PRODUCER, spaceId);
		if (!source.facts) return;
		if (activationId !== undefined || configId !== undefined) {
			const evidence = JSON.parse(source.facts.evidence) as ActivityEvidence;
			if (activationId !== undefined && evidence.activationId !== activationId) return;
			if (configId !== undefined && evidence.configId !== configId) return;
		}
		const rows = await manager.findBy(ClimateAutomationSlotEntity, {
			generationId: source.facts.generationId,
			ownerId: source.facts.ownerId,
		});
		const slots = [];

		for (const row of rows.sort((a, b) => a.controllerId.localeCompare(b.controllerId)))
			if (row.state === 'LIVE' || row.state === 'PROVISIONAL') {
				const slot = await this.ledger.readSlot(manager, scope, row.controllerId, false);
				// Only a participant captured by this process may clear its exact owned mirror. Otherwise retire metadata only.
				const captured = this.registry.captureProvider(row.providerKey);
				const original = captured ? this.participants.get(captured.implementation) : undefined;
				if (
					original?.isCurrent() &&
					original.methods.retireControllerInManager !== undefined &&
					original.methods.retireControllerInManager !== null
				)
					await invokeCreation(
						original.methods.retireControllerInManager,
						original.implementation,
						manager,
						slot.facts,
					);
				slots.push(slot);
			}
		await this.ledger.revokeSource(manager, scope, source, slots, deleted);
	}

	/** Caller supplies its original state/config DML; retirement and that DML share one native receipt. */
	async mutate<T>(
		spaceId: string,
		activationId: string | undefined,
		work: (manager: EntityManager) => Promise<T>,
		configId?: string,
		prepareFinalValidation?: (manager: EntityManager) => () => Promise<void>,
	): Promise<T> {
		const release = this.blockAdmission(
			configId !== undefined
				? `${spaceId}/${configId}`
				: activationId !== undefined
					? `${spaceId}/activation/${activationId}`
					: spaceId,
			spaceId,
		);
		let native: SqliteCommitGuardReceipt;
		let finish: ((outcome: ClimateAutomationMutationOutcome) => Promise<void>) | undefined;
		let callbackEntered = false;
		let result: T;
		let failure: { cause: unknown } | undefined;
		try {
			const producer = this.registry.captureProducer(SPACE_ACTIVITY_CLIMATE_PRODUCER);
			if (this.destroyed || producer?.implementation !== this.producer)
				throw new Error('Activity climate producer unavailable');
			finish = await this.capturePredecessors(spaceId, activationId, configId);
			result = await this.structure.runExclusive(async () => {
				const owner = this.structure.captureExclusiveOwner();
				return this.database.transaction(async (manager) => {
					callbackEntered = true;
					const receipt = (native = observeSqliteOuterOutcome(manager));
					registerSqliteCommitGuard(manager, () => owner() && producer.isCurrent());
					// Capture before any query; close the caller image only after all borrowed ledger work settles.
					const validate = prepareFinalValidation?.(manager);
					await manager.query('UPDATE "spaces_module_space_roles" SET "id"="id" WHERE 0');
					const value = await this.ledger.inAdmittedManager(manager, receipt, async () => {
						await this.retireInManager(manager, spaceId, activationId, false, configId);
						return work(manager);
					});
					await validate?.();
					return value;
				});
			});
		} catch (cause: unknown) {
			failure = { cause };
		}
		try {
			await release(
				native?.outcome === 'rolled_back' || native?.outcome === 'committed'
					? native.outcome
					: callbackEntered
						? 'unknown'
						: 'not_started',
				finish,
			);
		} catch (cause: unknown) {
			failure ??= { cause };
		}
		if (failure) throw failure.cause;
		return result;
	}
}
