import { DataSource, EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Inject, Injectable, Optional } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { EventType as ConfigModuleEventType } from '../../config/config.constants';
import { ConfigService } from '../../config/services/config.service';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { BaseManagedExtensionService } from '../../extensions/services/base-managed-extension.service';
import { ConfigChangeResult } from '../../extensions/services/managed-extension-service.interface';
import {
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from '../../notifications/notifications.constants';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { SceneEntity } from '../../scenes/entities/scenes.entity';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import {
	AUTOMATIONS_MODULE_NAME,
	AUTOMATION_ENGINE_SERVICE_ID,
	AUTOMATION_SUSPENDED_NOTIFICATION_KEY_PREFIX,
	AutomationStatus,
	EventType,
} from '../automations.constants';
import { AutomationsNotFoundException, AutomationsNotTriggerableException } from '../automations.exceptions';
import {
	ActionPolicyRequest,
	ActionPolicyVerdict,
	AutomationEngine,
	EngineAutomation,
	EngineAutomationState,
	EngineAutomationStatus,
	TriggerOutcome,
} from '../engine/automation-engine';
import { AutomationEntity } from '../entities/automations.entity';
import { AutomationNodeReference, AutomationNodeReferenceKind, AutomationNodeTypeOwner } from '../graph/node-type';
import { TrackerClock, systemTrackerClock } from '../tracker/clock';

import { AutomationRunService } from './automation-run.service';
import { AutomationNodeTypeRegistryService } from './node-type-registry.service';
import { AutomationStateTrackerService } from './state-tracker.service';

/** Injection token for the clock of the engine; left unbound in the application, bound in tests */
export const AUTOMATION_ENGINE_CLOCK = Symbol('AUTOMATION_ENGINE_CLOCK');

export type AutomationActionPolicy = (
	request: ActionPolicyRequest,
) => ActionPolicyVerdict | PromiseLike<ActionPolicyVerdict>;

const STATUS: Record<EngineAutomationStatus, AutomationStatus> = {
	ok: AutomationStatus.OK,
	invalid: AutomationStatus.INVALID,
	suspended: AutomationStatus.SUSPENDED,
};

const REFERENCE_ENTITIES: Record<AutomationNodeReferenceKind, EntityTarget<ObjectLiteral>> = {
	device: DeviceEntity,
	channel: ChannelEntity,
	property: ChannelPropertyEntity,
	scene: SceneEntity,
	space: SpaceEntity,
	automation: AutomationEntity,
};

const describeError = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

const toEngineAutomation = (automation: AutomationEntity): EngineAutomation => ({
	id: automation.id,
	enabled: automation.enabled,
	mode: automation.mode,
	revision: automation.revision,
	graph: automation.graph,
});

/**
 * The automation engine of the application: a thin adapter (ADR 0003, decision 15) around the
 * framework-free `AutomationEngine`.
 *
 * It loads the stored automations when it starts, follows the automation events of the bus so the
 * subscriptions of an automation are rebuilt when it is created, saved, enabled, disabled or deleted, and
 * writes back what the engine decides on its own: `status` when the overload guard suspends an automation
 * or something it refers to disappears. Writing a status never moves the revision of an automation, which
 * is how an event caused by the engine's own write is told from a save.
 *
 * It is a managed service of the automations module: disabling the module stops the engine, which drops
 * every subscription and ends active runs as `interrupted`.
 */
@Injectable()
export class AutomationEngineService extends BaseManagedExtensionService {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'AutomationEngineService');

	readonly owner = { kind: 'module', type: AUTOMATIONS_MODULE_NAME } as const;
	readonly serviceId = AUTOMATION_ENGINE_SERVICE_ID;

	private readonly engine: AutomationEngine;

	private actionPolicy: AutomationActionPolicy | undefined;
	private writes: Promise<void> = Promise.resolve();

	constructor(
		@InjectRepository(AutomationEntity)
		private readonly repository: Repository<AutomationEntity>,
		private readonly dataSource: DataSource,
		private readonly nodeTypeRegistry: AutomationNodeTypeRegistryService,
		private readonly stateTracker: AutomationStateTrackerService,
		private readonly configService: ConfigService,
		private readonly notifications: NotificationsService,
		private readonly eventEmitter: EventEmitter2,
		private readonly runService: AutomationRunService,
		@Optional() @Inject(AUTOMATION_ENGINE_CLOCK) clock?: TrackerClock,
	) {
		super();

		this.engine = new AutomationEngine({
			lookup: this.nodeTypeRegistry.lookup,
			clock: clock ?? systemTrackerClock,
			generateRunId: () => uuid().toString(),
			isOwnerEnabled: (owner) => this.isOwnerEnabled(owner),
			referenceExists: (reference) => this.referenceExists(reference),
			holdReference: (reference) =>
				reference.kind === 'property' ? this.stateTracker.reference(reference.id) : undefined,
			actionPolicy: (request) => this.actionPolicy?.(request) ?? { allow: true },
			hooks: {
				statusChanged: (state, previous) => this.handleStatusChanged(state, previous),
				runStarted: (record) => this.runService.runStarted(record),
				runParked: (record) => this.runService.runParked(record),
				runEnded: (record) => this.runService.runEnded(record),
				runSettled: (record) => this.runService.runSettled(record),
				error: (error, what) => this.logger.warn(`[ENGINE] Failed while ${what}: ${describeError(error)}`),
			},
		});
	}

	// ---- managed service -------------------------------------------------------------------------------

	async start(): Promise<void> {
		await this.withLock(async () => {
			if (this.state === 'started') {
				return;
			}

			this.state = 'starting';

			try {
				const stored = new Map<string, AutomationStatus>();

				const states = await this.engine.loadAll(async () => {
					const automations = await this.repository.find();

					return automations.map((automation) => {
						stored.set(automation.id, automation.status);

						return {
							automation: toEngineAutomation(automation),
							// What the overload guard stopped stays stopped across a restart
							options: { suspended: automation.status === AutomationStatus.SUSPENDED },
						};
					});
				});

				for (const state of states) {
					if (STATUS[state.status] !== stored.get(state.id)) {
						this.persistStatus(state);
					}

					if (state.status === 'suspended') {
						// Issues are resolved when the backend starts; this one still holds
						this.raiseSuspended(state);
					}
				}

				this.state = 'started';

				this.logger.log(
					`[ENGINE] Started with ${states.length} automation(s), ${states.filter((state) => state.armed).length} armed`,
				);
			} catch (error) {
				await this.engine.clear('engine_stopped');

				this.state = 'error';

				throw error;
			}
		});
	}

	async stop(): Promise<void> {
		await this.withLock(async () => {
			if (this.state === 'stopped') {
				return;
			}

			this.state = 'stopping';

			await this.engine.clear('engine_stopped');
			await this.runService.settled();
			await this.writes;

			this.state = 'stopped';

			this.logger.log('[ENGINE] Stopped');
		});
	}

	isHealthy(): Promise<boolean> {
		return Promise.resolve(this.state === 'started');
	}

	onConfigChanged(): Promise<ConfigChangeResult> {
		// The module has no setting the engine reads at start
		return Promise.resolve({ restartRequired: false });
	}

	// ---- what other services use -----------------------------------------------------------------------

	/**
	 * Starts a run by hand, at `nodeId` or at the first trigger of the graph. The answer says whether a
	 * run started and, when it did not, why.
	 */
	async trigger(id: string, nodeId?: string): Promise<TriggerOutcome> {
		if (!this.accepting()) {
			return { outcome: 'refused', code: 'not_running', reason: 'The automation engine is not running.' };
		}

		return this.engine.trigger(id, nodeId);
	}

	/**
	 * Starts a run by hand for a caller that wants the refusal as an exception.
	 *
	 * @throws AutomationsNotFoundException when the automation does not exist
	 * @throws AutomationsNotTriggerableException when the run is refused
	 */
	async triggerOrThrow(id: string, nodeId?: string): Promise<Exclude<TriggerOutcome, { outcome: 'refused' }>> {
		if (!(await this.repository.existsBy({ id }))) {
			throw new AutomationsNotFoundException(`Automation with id=${id} was not found.`);
		}

		// A save is followed in the background, but it is queued in the engine before the run asked for here
		const outcome = await this.trigger(id, nodeId);

		if (outcome.outcome === 'refused') {
			throw new AutomationsNotTriggerableException(outcome.reason, outcome.code);
		}

		return outcome;
	}

	/** What the engine holds for an automation right now, or undefined when the engine does not know it */
	runtime(id: string): EngineAutomationState | undefined {
		return this.accepting() ? this.engine.state(id) : undefined;
	}

	/**
	 * Marks every automation with a node referring to something that `matches` as `invalid` and stops it.
	 */
	async invalidateReferences(matches: (reference: AutomationNodeReference) => boolean): Promise<string[]> {
		if (!this.accepting()) return [];

		const hit = await this.engine.invalidate(matches);

		return hit.map((state) => state.id);
	}

	/**
	 * Sets the policy asked before every action. A refusal takes the `error` output of the action and is
	 * traced, and so does a policy that fails. There is one policy; setting another replaces it. The module
	 * sets the safety policy (`AutomationSafetyService`) when it starts.
	 */
	setActionPolicy(policy: AutomationActionPolicy | undefined): void {
		this.actionPolicy = policy;
	}

	/** Resolves once every change asked for so far is applied and written */
	async settled(): Promise<void> {
		await this.engine.idle();
		await this.runService.settled();
		await this.writes;
	}

	// ---- bus -------------------------------------------------------------------------------------------

	@OnEvent(EventType.AUTOMATION_CREATED)
	handleAutomationCreated(automation: AutomationEntity | null): void {
		this.handleAutomationSaved(automation);
	}

	@OnEvent(EventType.AUTOMATION_UPDATED)
	handleAutomationUpdated(automation: AutomationEntity | null): void {
		this.handleAutomationSaved(automation);
	}

	@OnEvent(EventType.AUTOMATION_DELETED)
	handleAutomationDeleted(payload: { id?: string } | null): void {
		const id = payload?.id;

		if (!this.accepting() || typeof id !== 'string') return;

		const wasSuspended = this.engine.state(id)?.status === 'suspended';

		this.background(async () => {
			await this.engine.remove(id);
			// Automations that refer to the deleted one cannot run any more
			await this.engine.invalidate((reference) => reference.kind === 'automation' && reference.id === id);

			if (wasSuspended) {
				await this.notifications.resolve(AUTOMATIONS_MODULE_NAME, this.suspendedKey(id));
			}
		}, `removing automation id=${id}`);
	}

	@OnEvent(EventType.MODULE_RESET)
	handleModuleReset(): void {
		if (!this.accepting()) return;

		const suspended = this.engine
			.states()
			.filter((state) => state.status === 'suspended')
			.map((state) => state.id);

		this.background(async () => {
			await this.engine.clear('automations_removed');

			for (const id of suspended) {
				await this.notifications.resolve(AUTOMATIONS_MODULE_NAME, this.suspendedKey(id));
			}
		}, 'removing all automations');
	}

	/** A plugin may have been enabled or disabled: the triggers its node types own are armed or dropped */
	@OnEvent(ConfigModuleEventType.CONFIG_UPDATED)
	handleConfigUpdated(): void {
		if (!this.accepting()) return;

		this.background(async () => {
			await this.engine.refreshOwners();
		}, 'following a configuration change');
	}

	private handleAutomationSaved(automation: AutomationEntity | null): void {
		if (!this.accepting() || !automation || typeof automation.id !== 'string') return;

		const before = this.engine.state(automation.id);

		// The revision moves with every save and never with a write of the engine itself
		if (before && before.revision >= automation.revision) return;

		this.background(async () => {
			const state = await this.engine.load(toEngineAutomation(automation));

			if (state.revision !== automation.revision) return;

			if (STATUS[state.status] !== automation.status) {
				this.persistStatus(state);
			}

			if (before?.status === 'suspended' && state.status !== 'suspended') {
				await this.notifications.resolve(AUTOMATIONS_MODULE_NAME, this.suspendedKey(state.id));
			}
		}, `loading automation id=${automation.id}`);
	}

	// ---- what the engine decided -----------------------------------------------------------------------

	private handleStatusChanged(state: EngineAutomationState, previous: EngineAutomationStatus): void {
		this.logger.warn(
			`[ENGINE] Automation id=${state.id} is now ${state.status}` +
				(state.suspendedReason !== undefined ? `: ${state.suspendedReason}` : ''),
		);

		this.persistStatus(state);

		if (state.status === 'suspended') {
			this.raiseSuspended(state);
		} else if (previous === 'suspended') {
			// Left `suspended` without a save, e.g. something it refers to was removed: the issue no longer holds
			this.background(async () => {
				await this.notifications.resolve(AUTOMATIONS_MODULE_NAME, this.suspendedKey(state.id));
			}, `resolving the suspension of automation id=${state.id}`);
		}
	}

	/**
	 * Queues the write of a status the engine decided. The status belongs to the revision it was decided
	 * for: a save that committed while the write was waiting has set the status of the newer revision, and
	 * the write must not land on it.
	 */
	private persistStatus(state: EngineAutomationState): void {
		const { id, status, revision } = state;

		this.writes = this.writes
			.then(async () => {
				const result = await this.repository.update({ id, revision }, { status: STATUS[status] });

				if (result.affected !== 1) return;

				const automation = await this.repository.findOneBy({ id });

				if (automation) {
					this.eventEmitter.emit(EventType.AUTOMATION_UPDATED, automation);
				}
			})
			.catch((error: unknown) => {
				this.logger.warn(`[ENGINE] Failed to store the status of automation id=${id}: ${describeError(error)}`);
			});
	}

	private raiseSuspended(state: EngineAutomationState): void {
		const { id } = state;

		this.background(async () => {
			const automation = await this.repository.findOne({ where: { id }, select: { id: true, name: true } });

			await this.notifications.notify({
				source: AUTOMATIONS_MODULE_NAME,
				kind: NotificationKind.ISSUE,
				key: this.suspendedKey(id),
				severity: NotificationSeverity.WARNING,
				title: `Automation "${automation?.name ?? id}" was suspended`,
				message:
					`${state.suspendedReason ?? 'The automation started too often.'} ` +
					'It was stopped to protect the system, most likely because it triggers itself. Change it and save it, or enable it again, to resume it.',
				actions: [
					{ type: NotificationActionType.LINK, label: 'Open automation', url: `/automations/${id}`, primary: true },
				],
				data: { automation_id: id },
			});
		}, `raising the suspension of automation id=${id}`);
	}

	private suspendedKey(id: string): string {
		return `${AUTOMATION_SUSPENDED_NOTIFICATION_KEY_PREFIX}${id}`;
	}

	// ---- what the engine asks --------------------------------------------------------------------------

	private isOwnerEnabled(owner: AutomationNodeTypeOwner): boolean {
		try {
			const config =
				owner.kind === 'module'
					? this.configService.getModuleConfig(owner.type)
					: this.configService.getPluginConfig(owner.type);

			return config?.enabled === true;
		} catch {
			// An owner without a configuration is treated as the service manager treats it: not enabled
			return false;
		}
	}

	private async referenceExists(reference: AutomationNodeReference): Promise<boolean> {
		const entity = REFERENCE_ENTITIES[reference.kind];

		if (entity === undefined) return true;

		return this.dataSource.getRepository(entity).existsBy({ id: reference.id });
	}

	// ---- helpers ---------------------------------------------------------------------------------------

	/** Changes are followed from the moment the stored automations are being read */
	private accepting(): boolean {
		return this.state === 'started' || this.state === 'starting';
	}

	/** Runs something the bus must not wait for; the bus is synchronous and nothing may be thrown into it */
	private background(work: () => Promise<void>, what: string): void {
		work().catch((error: unknown) => {
			this.logger.warn(`[ENGINE] Failed while ${what}: ${describeError(error)}`);
		});
	}
}
