import {
	DataSource,
	EntityMetadata,
	EntitySubscriberInterface,
	InsertEvent,
	RemoveEvent,
	TransactionCommitEvent,
	TransactionRollbackEvent,
	UpdateEvent,
} from 'typeorm';

import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { createExtensionLogger } from '../../../common/logger';
import { getEnvValue } from '../../../common/utils/config.utils';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import { DeviceZoneEntity } from '../entities/device-zone.entity';
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from '../entities/devices.entity';
import { buildDeviceGraphQuery } from '../utils/device-graph-query.utils';
import { resolvePropertyUnit } from '../utils/property-metadata.utils';

type PendingMetadata<T> = { generation: number; promise: Promise<T | null> };

/** Shared structural catalog for value ingestion and commands; excludes live values and connectivity. */
@Injectable()
export class PropertyMetadataService implements EntitySubscriberInterface, OnModuleInit, OnModuleDestroy {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'PropertyMetadataService');
	private readonly enabled: boolean;
	private generation = 0;
	private readonly catalog = new Map<string, ChannelPropertyEntity>();
	private readonly loading = new Map<string, PendingMetadata<ChannelPropertyEntity>>();
	private readonly deviceGraphs = new Map<string, DeviceEntity>();
	private readonly loadingGraphs = new Map<string, PendingMetadata<DeviceEntity>>();
	private readonly dirtyTransactions = new WeakSet<object>();

	constructor(
		private readonly dataSource: DataSource,
		@Optional() configService: NestConfigService = new NestConfigService(),
	) {
		// Other processes cannot invalidate this catalog; optional shared-writer mode keeps fresh reads.
		this.enabled = !getEnvValue<boolean>(configService, 'FB_PROPERTY_VALUE_LOCKS_ENABLED', false);
		this.dataSource.subscribers.push(this);
	}

	async onModuleInit(): Promise<void> {
		if (!this.enabled) return;
		try {
			const generation = this.generation;
			const properties = await this.query().getMany();
			if (generation === this.generation) {
				for (const property of properties) this.catalog.set(property.id, property);
			}
		} catch (error) {
			// OpenAPI generation can bootstrap before schema creation. A later value read retries;
			// never turn a failed catalog load into an authoritative empty catalog.
			this.logger.warn(
				`Could not preload property metadata: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	onModuleDestroy(): void {
		const index = this.dataSource.subscribers.indexOf(this);
		if (index >= 0) this.dataSource.subscribers.splice(index, 1);
		this.invalidate();
	}

	async findOne(id: string): Promise<ChannelPropertyEntity | null> {
		const property = this.enabled
			? await this.findCached(id)
			: await this.query().where('property.id = :id', { id }).getOne();
		if (!property) return null;

		// Callers attach live values and publish entities to listeners. Never expose cached objects.
		const result = this.copy(property);
		result.permissions = [...property.permissions];
		if (Array.isArray(property.format)) result.format = property.format.slice();
		if (typeof property.channel !== 'string') {
			result.channel = this.copy(property.channel);
			if (typeof property.channel.device !== 'string') result.channel.device = this.copy(property.channel.device);
		}
		result.unit = resolvePropertyUnit(result);
		return result;
	}

	/** Lazily retain one structural graph per commanded device; live state is attached only to detached copies. */
	async findDevice(id: string): Promise<DeviceEntity | null> {
		const query = () =>
			buildDeviceGraphQuery(this.dataSource.getRepository(DeviceEntity))
				.callListeners(false)
				.where('device.id = :id', { id })
				.getOne();
		const device = this.enabled
			? await this.loadCached(id, this.deviceGraphs, this.loadingGraphs, query)
			: await query();
		return device ? this.copyGraph(device) : null;
	}

	beforeInsert(event: InsertEvent<unknown>): void {
		this.structuralMutation(event);
	}
	afterInsert(event: InsertEvent<unknown>): void {
		this.structuralMutation(event);
	}
	beforeUpdate(event: UpdateEvent<unknown>): void {
		this.structuralMutation(event);
	}
	afterUpdate(event: UpdateEvent<unknown>): void {
		this.structuralMutation(event);
	}
	beforeRemove(event: RemoveEvent<unknown>): void {
		this.structuralMutation(event);
	}
	afterRemove(event: RemoveEvent<unknown>): void {
		this.structuralMutation(event);
	}

	afterTransactionCommit(event: TransactionCommitEvent): void {
		this.transactionSettled(event);
	}
	afterTransactionRollback(event: TransactionRollbackEvent): void {
		this.transactionSettled(event);
	}

	private structuralMutation(event: {
		metadata: EntityMetadata;
		queryRunner: object & { isTransactionActive: boolean };
	}): void {
		if (
			!event.metadata.inheritanceTree.some((type) =>
				[
					ChannelPropertyEntity,
					ChannelEntity,
					DeviceEntity,
					ChannelControlEntity,
					DeviceControlEntity,
					DeviceZoneEntity,
					SpaceEntity,
				].includes(type as typeof DeviceEntity),
			) &&
			!this.isEagerGraphDependency(event.metadata)
		)
			return;
		if (event.queryRunner.isTransactionActive) this.dirtyTransactions.add(event.queryRunner);
		this.invalidate();
	}

	private transactionSettled(event: { queryRunner: object & { isTransactionActive: boolean } }): void {
		if (!this.dirtyTransactions.has(event.queryRunner)) return;
		this.invalidate();
		// Savepoint settlement leaves the outer transaction active. Reads can refill the cache
		// with uncommitted metadata, so retain its dirty marker until the outermost settlement.
		if (!event.queryRunner.isTransactionActive) this.dirtyTransactions.delete(event.queryRunner);
	}

	/** Revision for dependent structural projections, including explicit reset/cascade invalidation. */
	getGeneration(): number {
		return this.generation;
	}

	/** Bulk clears and database-side cascades bypass entity mutation subscribers. */
	invalidate(): void {
		this.generation += 1;
		this.catalog.clear();
		this.deviceGraphs.clear();
	}

	/** Refresh only the requested row; discovery must not rebuild every property's metadata per report. */
	private findCached(id: string): Promise<ChannelPropertyEntity | null> {
		return this.loadCached(id, this.catalog, this.loading, () =>
			this.query().where('property.id = :id', { id }).getOne(),
		);
	}

	private async loadCached<T extends { id: string }>(
		id: string,
		catalog: Map<string, T>,
		pending: Map<string, PendingMetadata<T>>,
		query: () => Promise<T | null>,
	): Promise<T | null> {
		while (true) {
			const cached = catalog.get(id);
			if (cached) return cached;
			const generation = this.generation;
			if (pending.get(id)?.generation !== generation) {
				pending.set(id, { generation, promise: query() });
			}
			const loading = pending.get(id);
			try {
				const entity = await loading.promise;
				if (generation === this.generation) {
					// Missing IDs are not retained: invalid commands must not grow either catalog.
					if (entity) catalog.set(id, entity);
					return entity;
				}
			} finally {
				if (pending.get(id) === loading) pending.delete(id);
			}
		}
	}

	private isEagerGraphDependency(metadata: EntityMetadata): boolean {
		// Discover plugin-owned relation tables (e.g. Shelly addresses) without importing plugins into core.
		return (this.dataSource.entityMetadatas ?? []).some(
			(entity) =>
				entity.inheritanceTree.includes(DeviceEntity) &&
				entity.relations.some(
					(relation) =>
						relation.isEager &&
						relation.inverseEntityMetadata.inheritanceTree.some((type) => metadata.inheritanceTree.includes(type)),
				),
		);
	}

	/** Keep entity prototypes, dates and relation identity while isolating every mutable provider input. */
	private copyGraph<T>(value: T, seen = new Map<object, unknown>()): T {
		if (value === null || typeof value !== 'object') return value;
		if (value instanceof Date) return new Date(value.getTime()) as T;
		if (seen.has(value)) return seen.get(value) as T;
		const prototype = Object.getPrototypeOf(value) as object | null;
		const result = (Array.isArray(value) ? [] : Object.create(prototype)) as Record<string, unknown>;
		seen.set(value, result);
		for (const [key, child] of Object.entries(value)) result[key] = this.copyGraph(child, seen);
		return result as T;
	}

	private query() {
		return this.dataSource
			.getRepository(ChannelPropertyEntity)
			.createQueryBuilder('property')
			.innerJoinAndSelect('property.channel', 'channel')
			.innerJoinAndSelect('channel.device', 'device')
			.callListeners(false);
	}

	private copy<T extends object>(entity: T): T {
		const prototype = Object.getPrototypeOf(entity) as object | null;
		return Object.assign(Object.create(prototype) as T, entity);
	}
}
