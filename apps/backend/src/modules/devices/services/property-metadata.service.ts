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
import { DEVICES_MODULE_NAME } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { resolvePropertyUnit } from '../utils/property-metadata.utils';

/** Structural catalog for value ingestion. Values and transient connectivity never populate this cache. */
@Injectable()
export class PropertyMetadataService implements EntitySubscriberInterface, OnModuleInit, OnModuleDestroy {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'PropertyMetadataService');
	private readonly enabled: boolean;
	private generation = 0;
	private readonly catalog = new Map<string, ChannelPropertyEntity>();
	private readonly loading = new Map<string, { generation: number; promise: Promise<ChannelPropertyEntity | null> }>();
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
			!event.metadata.inheritanceTree.some(
				(type) => type === ChannelPropertyEntity || type === ChannelEntity || type === DeviceEntity,
			)
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

	/** Bulk clears and database-side cascades bypass entity mutation subscribers. */
	invalidate(): void {
		this.generation += 1;
		this.catalog.clear();
	}

	/** Refresh only the requested row; discovery must not rebuild every property's metadata per report. */
	private async findCached(id: string): Promise<ChannelPropertyEntity | null> {
		while (true) {
			const cached = this.catalog.get(id);
			if (cached) return cached;

			const generation = this.generation;
			if (this.loading.get(id)?.generation !== generation) {
				this.loading.set(id, {
					generation,
					promise: this.query().where('property.id = :id', { id }).getOne(),
				});
			}
			const loading = this.loading.get(id);
			try {
				const property = await loading.promise;
				if (generation === this.generation) {
					// Missing IDs are not retained: invalid commands must not grow this cache.
					if (property) this.catalog.set(id, property);
					return property;
				}
			} finally {
				if (this.loading.get(id) === loading) this.loading.delete(id);
			}
		}
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
