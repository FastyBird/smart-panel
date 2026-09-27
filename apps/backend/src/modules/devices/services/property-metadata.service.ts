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
	private catalog: Map<string, ChannelPropertyEntity> | null = null;
	private loading: { generation: number; promise: Promise<Map<string, ChannelPropertyEntity>> } | null = null;
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
			await this.snapshot();
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
			? (await this.snapshot()).get(id)
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

	private transactionSettled(event: { queryRunner: object }): void {
		if (this.dirtyTransactions.delete(event.queryRunner)) this.invalidate();
	}

	private invalidate(): void {
		this.generation += 1;
		this.catalog = null;
	}

	private async snapshot(): Promise<Map<string, ChannelPropertyEntity>> {
		while (this.catalog === null) {
			const generation = this.generation;
			if (this.loading?.generation !== generation) {
				this.loading = {
					generation,
					promise: this.query()
						.getMany()
						.then((properties) => new Map(properties.map((p) => [p.id, p]))),
				};
			}
			const loading = this.loading;
			try {
				const catalog = await loading.promise;
				if (generation === this.generation) this.catalog = catalog;
			} finally {
				if (this.loading === loading) this.loading = null;
			}
		}
		return this.catalog;
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
