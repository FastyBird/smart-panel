import { DataSource, EntityManager, EntitySubscriberInterface, EntityTarget, ObjectLiteral } from 'typeorm';

import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import {
	SqliteCommitGuardReceipt,
	observeSqliteOuterOutcome,
	registerSqliteCommitGuard,
} from '../../../common/database/sqlite-data-source';
import { getEnvValue } from '../../../common/utils/config.utils';
import { EventType } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { CreationCapture, captureCreation, snapshotCreation } from '../../../modules/devices/services/creation-capture';
import {
	ProducerStateBatch,
	ProducerStateOwner,
	ProducerStatePublicationReport,
	PropertyProducerRegistryService,
} from '../../../modules/devices/services/property-producer.registry.service';
import { VirtualChannelPropertyEntity, VirtualValueOrigin } from '../entities/devices-virtual.entity';
import {
	VirtualAggregateConfigEntity,
	VirtualAggregateInputEntity,
	VirtualLightGroupBindingEntity,
	VirtualLightGroupConfigEntity,
	VirtualLightGroupMemberEntity,
} from '../entities/virtual-producer.entity';
import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';

import {
	GraphStatePublicationStage,
	GraphStatePublicationView,
	VirtualDependencyGraphService,
} from './virtual-dependency-graph.service';

interface StateLifetime {
	active: boolean;
	readonly owner: ProducerStateOwner;
	readonly registry: CreationCapture<PropertyProducerRegistryService>;
	readonly graph: CreationCapture<VirtualDependencyGraphService>;
	readonly own: CreationCapture<VirtualProducerStateService>;
	readonly stages: Set<() => void>;
	publicationSequence: number;
	stop?: () => void;
}

export interface ProducerConfigurationHandoff {
	readonly toJSON: () => object;
}
export type ProducerConfigurationPlan =
	| {
			kind: 'aggregate';
			config: VirtualAggregateConfigEntity;
			inputs: VirtualAggregateInputEntity[];
			outputs: VirtualChannelPropertyEntity[];
	  }
	| {
			kind: 'transform';
			config: VirtualTransformConfigEntity;
			source: VirtualTransformSourceEntity;
			outputs: VirtualChannelPropertyEntity[];
	  }
	| {
			kind: 'light-group';
			config: VirtualLightGroupConfigEntity;
			members: VirtualLightGroupMemberEntity[];
			bindings: VirtualLightGroupBindingEntity[];
			outputs: VirtualChannelPropertyEntity[];
	  };
interface ConfigurationImage {
	readonly plan: ProducerConfigurationPlan;
	readonly expected: string;
	readonly before: string;
}
interface ConfigurationHandoffRecord {
	readonly lifetime: StateLifetime;
	readonly batch: ProducerStateBatch;
	readonly images: ConfigurationImage[];
	lifecycle?: { current: () => boolean; ready: () => boolean };
	manager?: EntityManager;
	receipt?: SqliteCommitGuardReceipt;
	managerCurrent?: () => boolean;
	catalogPostimage?: string;
	owner?: () => boolean;
	stop?: () => void;
	started: boolean;
	staged: boolean;
	ready: boolean;
}
function configurationBytes(value: unknown): string {
	const ordered = (item: unknown): unknown => {
		if (item instanceof Date) return { date: item.toISOString() };
		if (Array.isArray(item)) return item.map(ordered);
		if (item && typeof item === 'object')
			return Object.fromEntries(
				Object.keys(item)
					.sort()
					.map((key) => [key, ordered(Reflect.get(item, key) as unknown)]),
			);
		return item;
	};
	return JSON.stringify(ordered(value));
}

/** A fallback owns only its original registry slots; independent runtime leases always remain independent. */
@Injectable()
export class VirtualProducerStateService implements OnModuleInit, OnModuleDestroy {
	private lifetime?: StateLifetime;
	private report?: ProducerStatePublicationReport;
	private readonly configurationHandoffs = new WeakMap<ProducerConfigurationHandoff, ConfigurationHandoffRecord>();
	constructor(
		private readonly dataSource: DataSource,
		private readonly producers: PropertyProducerRegistryService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly events: EventEmitter2,
		@Optional() private readonly configService: NestConfigService = new NestConfigService(),
	) {}

	async onModuleInit(): Promise<void> {
		if (getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on') return;
		this.onModuleDestroy();
		const registry = captureCreation(this.producers, [
			'createStateOwner',
			'beginStateBatch',
			'prepareStateBatch',
			'validateStatePlan',
			'installStatePlan',
			'publishStatePlan',
			'readStatePlan',
			'closeStateBatch',
			'removeOwnedState',
			'disposeStateOwner',
			'register',
			'owns',
			'isCurrent',
			'read',
		]);
		const graph = captureCreation(this.graph, [
			'observeStatePublication',
			'withProducerConfigurationWrite',
			'readPublicationSnapshot',
			'capturePublishGuard',
		]);
		const own = captureCreation(this, [
			'onModuleInit',
			'captureConfigurationHandoff',
			'withConfigurationWrite',
			'recordConfiguration',
			'onModuleDestroy',
			'stageOwned',
			'initializeOutput',
			'installUnavailable',
			'handlePropertyChanged',
			'handlePropertyDeleted',
		]);
		const lifetime: StateLifetime = {
			active: true,
			owner: registry.values.createStateOwner.call(registry.receiver, 'virtual-producer-state'),
			registry,
			graph,
			own,
			stages: new Set(),
			publicationSequence: 0,
		};
		this.lifetime = lifetime;
		const current = () => this.current(lifetime);
		lifetime.stop = graph.values.observeStatePublication.call(graph.receiver, {
			prepare: (view, lifecycle) => own.values.stageOwned.call(own.receiver, view, lifecycle),
		});
		// Issue preparation synchronously before the first database await. Initial unavailable overlays
		// cannot become ready; bootstrap creates a fresh exact generation and replaces only these slots.
		let resolve: (view: GraphStatePublicationView) => void, reject: (cause: unknown) => void;
		const input = new Promise<GraphStatePublicationView>((yes, no) => {
			resolve = yes;
			reject = no;
		});
		const prepared = own.values.stageOwned
			.call(own.receiver, input, { current, ready: () => false, initialize: true })
			.then((stage) => captureCreation(stage, ['validate', 'install', 'publish', 'close']));
		void prepared.catch(() => undefined);
		let stage: CreationCapture<GraphStatePublicationStage> | undefined;
		try {
			const snapshot = await graph.values.readPublicationSnapshot.call(graph.receiver);
			const bytes = JSON.stringify(snapshot);
			resolve({ ...snapshot, quarantined: [] });
			stage = await prepared;
			const latest = await graph.values.readPublicationSnapshot.call(graph.receiver);
			if (
				!current() ||
				bytes !== JSON.stringify(latest) ||
				!stage.current() ||
				!stage.values.validate.call(stage.receiver) ||
				!stage.values.install.call(stage.receiver)
			)
				throw new Error('Original producer initialization changed');
			await stage.values.publish.call(stage.receiver);
		} catch (cause: unknown) {
			reject(cause);
			await prepared.catch(() => undefined);
			stage?.values.close.call(stage.receiver);
			// Initialization remains fail-closed; a new lifecycle can retry without adopting old work.
			if (this.lifetime === lifetime) {
				try {
					own.values.onModuleDestroy.call(own.receiver);
				} catch {
					/* Preserve the original initialization cause. */
				}
			}
			throw cause;
		}
	}
	captureConfigurationHandoff(): ProducerConfigurationHandoff {
		const lifetime = this.lifetime;
		if (!lifetime || !this.current(lifetime)) throw new Error('Producer configuration lifecycle is unavailable');
		const token = Object.freeze({ toJSON: () => ({}) });
		const current = () => this.current(lifetime) && (!record.lifecycle || record.lifecycle.current());
		const batch = lifetime.registry.values.beginStateBatch.call(
			lifetime.registry.receiver,
			lifetime.owner,
			current,
			() => current() && record.lifecycle?.ready() === true,
		);
		const record: ConfigurationHandoffRecord = {
			lifetime,
			batch,
			images: [],
			started: false,
			staged: false,
			ready: false,
		};
		this.configurationHandoffs.set(token, record);
		return token;
	}
	withConfigurationWrite<T>(
		token: ProducerConfigurationHandoff,
		operation: (manager: EntityManager) => Promise<T>,
		expectedGraphRevision: number | undefined,
		owner: () => boolean,
	): Promise<T> {
		const record = this.configurationHandoffs.get(token);
		if (!record || record.started || !this.current(record.lifetime) || !owner())
			throw new Error('Original producer configuration owner is unavailable');
		record.started = true;
		record.owner = owner;
		const { graph } = record.lifetime;
		return graph.values.withProducerConfigurationWrite.call(graph.receiver, operation, expectedGraphRevision, {
			token,
			admit: (manager) => {
				// Observe the actual original outer unit before registering guards or reading authority.
				record.receipt = observeSqliteOuterOutcome(manager);
				record.manager = manager;
				const pin = captureCreation(manager, ['find', 'findOneBy', 'createQueryBuilder', 'query']);
				record.managerCurrent = pin.current;
				const subscriber: EntitySubscriberInterface = {
					beforeQuery: (event) => {
						if (
							event.queryRunner === manager.queryRunner &&
							/^\s*(?:INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|CREATE)\b/i.test(event.query)
						)
							record.ready = false;
					},
				};
				const subscribers = this.dataSource.subscribers;
				subscribers.push(subscriber);
				record.stop = () => {
					const index = subscribers.indexOf(subscriber);
					if (index >= 0) subscribers.splice(index, 1);
				};
				registerSqliteCommitGuard(
					manager,
					() =>
						record.ready &&
						this.dataSource.subscribers === subscribers &&
						owner() &&
						pin.current() &&
						this.current(record.lifetime),
				);
			},
			validate: async (manager) => {
				if (record.manager !== manager || !record.images.length || !record.managerCurrent?.() || !owner())
					throw new Error('Original producer configuration admission changed');
				for (const image of record.images)
					if ((await this.readConfigurationImage(manager, image.plan)) !== image.expected)
						throw new Error('Producer configuration native postimage changed');
				record.catalogPostimage = configurationBytes(
					await manager
						.createQueryBuilder(ChannelPropertyEntity, 'source')
						.leftJoinAndSelect('source.channel', 'channel')
						.leftJoinAndSelect('channel.device', 'device')
						.callListeners(false)
						.orderBy('source.id', 'ASC')
						.getMany(),
				);
				record.ready = true;
			},
			outcome: () => record.receipt?.outcome,
			settled: () => {
				record.stop?.();
				if (record.receipt?.outcome !== 'committed')
					record.lifetime.registry.values.closeStateBatch.call(record.lifetime.registry.receiver, record.batch);
			},
		}) as Promise<T>;
	}
	async recordConfiguration(
		manager: EntityManager,
		token: ProducerConfigurationHandoff,
		plan: ProducerConfigurationPlan,
	): Promise<void> {
		const record = this.configurationHandoffs.get(token);
		if (
			!record ||
			!this.current(record.lifetime) ||
			record.manager !== manager ||
			record.receipt?.outcome !== 'pending' ||
			!record.managerCurrent?.() ||
			!record.owner?.()
		)
			throw new Error('Producer configuration requires its original admitted native manager');
		const owned = snapshotCreation(plan);
		const configTarget =
			owned.kind === 'aggregate'
				? VirtualAggregateConfigEntity
				: owned.kind === 'transform'
					? VirtualTransformConfigEntity
					: VirtualLightGroupConfigEntity;
		const key =
			owned.kind === 'light-group'
				? { groupChannelId: owned.config.groupChannelId }
				: { outputPropertyId: owned.config.outputPropertyId };
		const previous = await manager.findOneBy(
			configTarget as EntityTarget<{ revision: number; outputPropertyId?: string; groupChannelId?: string }>,
			key,
		);
		if (
			!Number.isSafeInteger(owned.config.revision) ||
			owned.config.revision < 1 ||
			owned.config.revision !== (previous?.revision ?? 0) + 1
		)
			throw new Error('Producer configuration original revision changed');
		const before = await this.readConfigurationImage(manager, owned);
		const expected = this.expectedConfigurationImage(manager, owned);
		record.images.push({ plan: owned, before, expected });
	}
	private configurationRow(manager: EntityManager, target: EntityTarget<ObjectLiteral>, row: object): object {
		return Object.fromEntries(
			manager.connection.getMetadata(target).columns.map((column) => {
				const value: unknown = column.getEntityValue(row);
				if (value === undefined) throw new Error(`Incomplete original configuration column: ${column.propertyName}`);
				const stored: unknown = manager.connection.driver.preparePersistentValue(value, column);
				return [column.databaseName, stored];
			}),
		);
	}
	private expectedConfigurationImage(manager: EntityManager, plan: ProducerConfigurationPlan): string {
		const rows = (target: EntityTarget<ObjectLiteral>, values: readonly object[]) =>
			values
				.map((row) => this.configurationRow(manager, target, row))
				.sort((a, b) => configurationBytes(a).localeCompare(configurationBytes(b)));
		if (plan.kind === 'aggregate')
			return configurationBytes({
				config: rows(VirtualAggregateConfigEntity, [plan.config]),
				inputs: rows(VirtualAggregateInputEntity, plan.inputs),
			});
		if (plan.kind === 'transform')
			return configurationBytes({
				config: rows(VirtualTransformConfigEntity, [plan.config]),
				sources: rows(VirtualTransformSourceEntity, [plan.source]),
			});
		return configurationBytes({
			config: rows(VirtualLightGroupConfigEntity, [plan.config]),
			members: rows(VirtualLightGroupMemberEntity, plan.members),
			bindings: rows(VirtualLightGroupBindingEntity, plan.bindings),
		});
	}
	private async readConfigurationImage(manager: EntityManager, plan: ProducerConfigurationPlan): Promise<string> {
		const query = manager.query.bind(manager) as EntityManager['query'];
		const rows = (values: readonly ObjectLiteral[]) =>
			[...values].sort((a, b) => configurationBytes(a).localeCompare(configurationBytes(b)));
		if (plan.kind === 'aggregate')
			return configurationBytes({
				config: rows(
					await query<ObjectLiteral[]>('SELECT * FROM devices_virtual_aggregate_configs WHERE outputPropertyId = ?', [
						plan.config.outputPropertyId,
					]),
				),
				inputs: rows(
					await query<ObjectLiteral[]>('SELECT * FROM devices_virtual_aggregate_inputs WHERE outputPropertyId = ?', [
						plan.config.outputPropertyId,
					]),
				),
			});
		if (plan.kind === 'transform')
			return configurationBytes({
				config: rows(
					await query<ObjectLiteral[]>('SELECT * FROM devices_virtual_transform_configs WHERE outputPropertyId = ?', [
						plan.config.outputPropertyId,
					]),
				),
				sources: rows(
					await query<ObjectLiteral[]>('SELECT * FROM devices_virtual_transform_sources WHERE outputPropertyId = ?', [
						plan.config.outputPropertyId,
					]),
				),
			});
		return configurationBytes({
			config: rows(
				await query<ObjectLiteral[]>('SELECT * FROM devices_virtual_light_group_configs WHERE groupChannelId = ?', [
					plan.config.groupChannelId,
				]),
			),
			members: rows(
				await query<ObjectLiteral[]>('SELECT * FROM devices_virtual_light_group_members WHERE groupChannelId = ?', [
					plan.config.groupChannelId,
				]),
			),
			bindings: rows(
				await query<ObjectLiteral[]>(
					'SELECT binding.* FROM devices_virtual_light_group_bindings binding INNER JOIN devices_virtual_light_group_members member ON member.id = binding.memberId WHERE member.groupChannelId = ?',
					[plan.config.groupChannelId],
				),
			),
		});
	}

	private current(lifetime: StateLifetime): boolean {
		return (
			lifetime.active &&
			this.lifetime === lifetime &&
			lifetime.registry.current() &&
			lifetime.graph.current() &&
			lifetime.own.current()
		);
	}
	async stageOwned(
		input: Promise<GraphStatePublicationView>,
		lifecycle: { current: () => boolean; ready: () => boolean; configuration?: object; initialize?: true },
	): Promise<GraphStatePublicationStage> {
		const lifetime = this.lifetime;
		if (!lifetime || !this.current(lifetime)) throw new Error('Producer state lifecycle is closed');
		const { registry } = lifetime;
		const publicationSequence = ++lifetime.publicationSequence;
		const manager = captureCreation(this.dataSource.manager, ['findOne']);
		const events = captureCreation(this.events, ['emit']);
		const current = () => this.current(lifetime) && lifecycle.current() && manager.current() && events.current();
		const handoff =
			lifecycle.configuration &&
			this.configurationHandoffs.get(lifecycle.configuration as ProducerConfigurationHandoff);
		if (handoff && (handoff.lifetime !== lifetime || handoff.staged))
			throw new Error('Original configuration stage changed');
		if (handoff) {
			handoff.staged = true;
			handoff.lifecycle = lifecycle;
		}
		const batch =
			handoff?.batch ??
			registry.values.beginStateBatch.call(
				registry.receiver,
				lifetime.owner,
				current,
				() => current() && lifecycle.ready(),
			);
		const close = () => {
			registry.values.closeStateBatch.call(registry.receiver, batch);
			lifetime.stages.delete(close);
		};
		lifetime.stages.add(close);
		try {
			const view = await input;
			if (!current()) throw new Error('Original producer stage expired');
			if (
				handoff &&
				(!handoff.ready ||
					handoff.receipt?.outcome !== 'committed' ||
					handoff.catalogPostimage !== configurationBytes(view.sourceCatalog))
			)
				throw new Error('Producer configuration has no exact native committed receipt');
			const configurationSlots = new Set(
				handoff?.images.flatMap((image) => image.plan.outputs.map((output) => output.id)) ?? [],
			);
			const quarantine = new Set(view.quarantined);
			const intents = view.properties
				.filter((property) => quarantine.has(property.id) || property.valueOrigin === VirtualValueOrigin.DERIVED)
				.map((property) => {
					const channel = typeof property.channel === 'string' ? property.channel : property.channel?.id;
					const revision =
						view.transforms.find((row) => row.outputPropertyId === property.id)?.revision ??
						view.aggregates.find((row) => row.outputPropertyId === property.id)?.revision ??
						view.groups.find((row) => row.groupChannelId === channel)?.revision ??
						0;
					return {
						property,
						revision,
						reason: quarantine.has(property.id) ? ('graph_quarantined' as const) : ('runtime_unavailable' as const),
					};
				});
			const plan = registry.values.prepareStateBatch.call(
				registry.receiver,
				batch,
				intents,
				true,
				true,
				async (id) => {
					const restored = await manager.values.findOne.call(manager.receiver, VirtualChannelPropertyEntity, {
						where: { id },
						relations: ['channel', 'channel.device'],
					});
					if (restored) events.values.emit.call(events.receiver, EventType.CHANNEL_PROPERTY_UPDATED, restored);
				},
				configurationSlots,
				lifecycle.initialize ? true : configurationSlots,
			);
			const updateReport = () => {
				if (this.lifetime === lifetime && lifetime.publicationSequence === publicationSequence)
					this.report = registry.values.readStatePlan.call(registry.receiver, plan);
			};
			updateReport();
			return Object.freeze({
				validate: () => current() && registry.values.validateStatePlan.call(registry.receiver, plan),
				install: () => {
					const installed = current() && registry.values.installStatePlan.call(registry.receiver, plan);
					updateReport();
					return installed;
				},
				publish: async () => {
					try {
						await registry.values.publishStatePlan.call(registry.receiver, plan);
					} finally {
						updateReport();
						close();
					}
				},
				close,
			});
		} catch (cause: unknown) {
			close();
			throw cause;
		}
	}
	readPublicationReport(): ProducerStatePublicationReport | undefined {
		return this.report;
	}

	installUnavailable(property: VirtualChannelPropertyEntity, revision: number): void {
		const lifetime = this.lifetime;
		if (!lifetime || !this.current(lifetime)) return;
		if (property.valueOrigin !== VirtualValueOrigin.DERIVED) return;
		const guard = lifetime.graph.values.capturePublishGuard.call(lifetime.graph.receiver);
		const current = () => this.current(lifetime);
		const registry = lifetime.registry;
		const batch = registry.values.beginStateBatch.call(
			registry.receiver,
			lifetime.owner,
			current,
			() => current() && guard(),
		);
		try {
			const plan = registry.values.prepareStateBatch.call(
				registry.receiver,
				batch,
				[{ property, revision, reason: 'runtime_unavailable' }],
				false,
				false,
			);
			if (!registry.values.installStatePlan.call(registry.receiver, plan)) throw new Error('Owned producer superseded');
			// No removal intents: this publication has only synchronous original event callbacks.
			void registry.values.publishStatePlan.call(registry.receiver, plan);
			property.value = registry.values.read.call(registry.receiver, property.id);
			this.report = registry.values.readStatePlan.call(registry.receiver, plan);
		} finally {
			registry.values.closeStateBatch.call(registry.receiver, batch);
		}
	}
	onModuleDestroy(): void {
		const lifetime = this.lifetime;
		if (!lifetime?.active) return;
		lifetime.active = false;
		let failure: { cause: unknown } | undefined;
		for (const cleanup of [
			lifetime.stop,
			...lifetime.stages,
			() => lifetime.registry.values.disposeStateOwner.call(lifetime.registry.receiver, lifetime.owner),
		]) {
			try {
				cleanup?.();
			} catch (cause: unknown) {
				failure ??= { cause };
			}
		}
		lifetime.stages.clear();
		if (failure) throw failure.cause;
	}
	initializeOutput(property: VirtualChannelPropertyEntity): void {
		const lifetime = this.lifetime;
		if (lifetime && this.current(lifetime) && property.valueOrigin === VirtualValueOrigin.DERIVED)
			lifetime.own.values.installUnavailable.call(lifetime.own.receiver, property, 0);
	}
	@OnEvent(EventType.CHANNEL_PROPERTY_CREATED)
	@OnEvent(EventType.CHANNEL_PROPERTY_UPDATED)
	handlePropertyChanged(property: VirtualChannelPropertyEntity): void {
		const lifetime = this.lifetime;
		if (property.type === 'virtual' && lifetime && this.current(lifetime))
			lifetime.own.values.initializeOutput.call(lifetime.own.receiver, property);
	}
	@OnEvent(EventType.CHANNEL_PROPERTY_DELETED)
	handlePropertyDeleted(property: VirtualChannelPropertyEntity): void {
		const lifetime = this.lifetime;
		if (property.type === 'virtual' && lifetime && this.current(lifetime))
			lifetime.registry.values.removeOwnedState.call(lifetime.registry.receiver, lifetime.owner, property.id);
	}
}
