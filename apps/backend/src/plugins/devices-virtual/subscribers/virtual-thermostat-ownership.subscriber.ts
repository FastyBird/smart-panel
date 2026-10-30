import {
	AfterQueryEvent,
	BeforeQueryEvent,
	DataSource,
	EntityManager,
	EntitySubscriberInterface,
	Not,
	QueryRunner,
	RemoveEvent,
	TransactionCommitEvent,
	TransactionRollbackEvent,
	UpdateEvent,
} from 'typeorm';

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

import {
	SqliteNoMutationWindow,
	SqliteReadCheckpoint,
	captureSqliteNoMutationWindow,
	registerSqliteCommitGuard,
} from '../../../common/database/sqlite-data-source';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { captureCreation } from '../../../modules/devices/services/creation-capture';
import { VirtualThermostatActuatorClaimEntity } from '../entities/virtual-thermostat.entity';
import { initializeThermostatCreationCatalog } from '../services/thermostat-creation-catalog';
import { VirtualThermostatClaimsService } from '../services/virtual-thermostat-claims.service';
import {
	THERMOSTAT_BRANCH_MEMBER_TRIGGERS,
	THERMOSTAT_OWNERSHIP_TRIGGERS,
} from '../services/virtual-thermostat-ownership.sql';

/** Runs at the persistence boundary, including adapter metadata/pruning paths outside REST controllers. */
@Injectable()
export class VirtualThermostatOwnershipSubscriber implements EntitySubscriberInterface, OnApplicationBootstrap {
	private readonly logger = new Logger(VirtualThermostatOwnershipSubscriber.name);
	private installed = false;
	private readonly dirtyRunners = new WeakSet<QueryRunner>();
	constructor(
		private readonly dataSource: DataSource,
		private readonly claims: VirtualThermostatClaimsService,
	) {
		this.dataSource.subscribers.push(this);
	}
	/** Metadata adapter only. Attempt history belongs to the original core native scope. */
	static captureNoopFence(database: DataSource, ownerCurrent: () => boolean) {
		const source = captureCreation(database, ['driver', 'subscribers', 'isInitialized']);
		const subscribers = [...database.subscribers];
		const originals = subscribers.filter((subscriber) => subscriber instanceof VirtualThermostatOwnershipSubscriber);
		const dispatch = subscribers.map((subscriber) => ({
			prototype: Object.getPrototypeOf(subscriber) as object,
			pin: captureCreation(subscriber, [
				'beforeQuery',
				'afterQuery',
				'beforeTransactionCommit',
				'afterTransactionCommit',
				'afterTransactionRollback',
				'listenTo',
			]),
		}));
		const list = captureCreation(database.subscribers, ['forEach', 'filter', Symbol.iterator]);
		let window: SqliteNoMutationWindow | undefined;
		let checkpoint: SqliteReadCheckpoint | undefined;
		let applied = false;
		let closed = false;
		const current = () =>
			!closed &&
			originals.length === 1 &&
			source.current() &&
			list.current() &&
			database.subscribers.length === subscribers.length &&
			subscribers.every(
				(subscriber, index) =>
					database.subscribers[index] === subscriber &&
					dispatch[index].pin.current() &&
					Object.getPrototypeOf(subscriber) === dispatch[index].prototype,
			) &&
			ownerCurrent();
		return Object.freeze({
			admit(manager: EntityManager): void {
				if (window || closed) throw new DevicesValidationException('Original no-op admission already used.');
				window = captureSqliteNoMutationWindow(manager, ownerCurrent);
				registerSqliteCommitGuard(manager, () => applied || current());
			},
			async reserveZeroRows(table: string, column: string): Promise<void> {
				await window.reserveZeroRows(table, column);
			},
			beginReads(): void {
				checkpoint = window.beginReads();
			},
			arm(): void {
				window.armUnchanged(checkpoint);
			},
			applied(): void {
				window.applied();
				applied = true;
			},
			close(): void {
				if (window?.outcome === 'pending') return;
				closed = true;
			},
		});
	}

	async onApplicationBootstrap(): Promise<void> {
		if (process.env.FB_CLI !== 'on') {
			await this.dataSource.transaction((manager) =>
				initializeThermostatCreationCatalog(
					manager,
					this.dataSource.options.synchronize === true,
					false,
					this.dataSource.subscribers.some(
						(observer) =>
							observer !== this && observer instanceof VirtualThermostatOwnershipSubscriber && observer.installed,
					),
				),
			);
		}
		if (!(await this.dataSource.createQueryRunner().hasTable('devices_virtual_thermostat_actuator_claims'))) return;
		for (const [name, sql] of Object.entries({
			...THERMOSTAT_OWNERSHIP_TRIGGERS,
			...THERMOSTAT_BRANCH_MEMBER_TRIGGERS,
		}))
			await this.dataSource.query(`CREATE TRIGGER IF NOT EXISTS "${name}" ${sql}`);
		this.installed = true;
	}
	private isCatalogMutation(query: string): boolean {
		return /^\s*(UPDATE|INSERT(?: OR \w+)? INTO|DELETE FROM)\s+["`[]?(devices_module_(devices|channels|channels_properties|climate_automation_slots)|devices_virtual_thermostat_(?:configs|sources|actuator_claims|settings|member_protection)|devices_virtual_transform_[a-z_]+|devices_shelly_ng_sample_sources)["`\]]?\b/i.test(
			query,
		);
	}
	beforeQuery(event: BeforeQueryEvent<unknown>): void {
		if (!this.installed || !this.isCatalogMutation(event.query)) return;
		this.dirtyRunners.add(event.queryRunner);
		if (this.claims.isQualifiedReleaseWrite(event.queryRunner, event.query, event.parameters)) return;
		this.claims.invalidate();
		if (
			/devices_virtual_(?:thermostat_(?:configs|sources|actuator_claims|member_protection)|transform_)|devices_shelly_ng_sample_sources/i.test(
				event.query,
			)
		)
			this.claims.revokeAllQualifications();
	}
	async afterQuery(event: AfterQueryEvent<unknown>): Promise<void> {
		if (this.installed && !event.queryRunner.isTransactionActive && this.isCatalogMutation(event.query))
			await this.reconcileRunner(event.queryRunner, 'catalog write');
	}
	async afterTransactionCommit(event: TransactionCommitEvent): Promise<void> {
		await this.reconcileRunner(event.queryRunner, 'transaction commit');
	}
	async afterTransactionRollback(event: TransactionRollbackEvent): Promise<void> {
		await this.reconcileRunner(event.queryRunner, 'transaction rollback');
	}
	private async reconcileRunner(runner: QueryRunner, boundary: string): Promise<void> {
		// Read-only snapshots must release SQLite without acquiring the structure lock: a structural
		// writer can already hold that lock while waiting for this connection. Inner savepoint
		// boundaries retain dirtiness until the owning transaction commits or rolls back.
		if (!this.installed || runner.isTransactionActive || !this.dirtyRunners.delete(runner)) return;
		await this.refreshAfterWrite(boundary);
	}
	private async refreshAfterWrite(boundary: string): Promise<void> {
		try {
			await this.claims.refresh();
		} catch (error) {
			// SQL has already committed or rolled back. Claims manages fail-closed retry without changing that outcome.
			this.logger.error(`Thermostat claim reconciliation failed after ${boundary}`, error);
		}
	}

	async beforeRemove(event: RemoveEvent<DeviceEntity | ChannelEntity | ChannelPropertyEntity>): Promise<void> {
		const entity = event.entity ?? event.databaseEntity;
		if (!entity) return;
		const manager = event.manager;
		let properties: ChannelPropertyEntity[] = [];
		if (entity instanceof ChannelPropertyEntity) properties = [entity];
		else if (entity instanceof ChannelEntity)
			properties = await manager.find(ChannelPropertyEntity, { where: { channel: { id: entity.id } } });
		else if (entity instanceof DeviceEntity)
			properties = await manager.find(ChannelPropertyEntity, { where: { channel: { device: { id: entity.id } } } });
		else return;
		const rows = await manager.findBy(VirtualThermostatActuatorClaimEntity, { state: Not('released') });
		if (
			rows.some(
				(claim) =>
					properties.some((property) => property.id === claim.sourcePropertyId) ||
					(entity instanceof DeviceEntity && claim.controllerId === entity.id),
			)
		)
			throw new DevicesValidationException(
				'Thermostat actuator is reserved: request release and establish qualified OFF plus pending ON drainage before deleting or detaching equipment.',
			);
	}
	async beforeUpdate(event: UpdateEvent<DeviceEntity | ChannelEntity | ChannelPropertyEntity>): Promise<void> {
		const entity = event.entity;
		if (!entity || !event.databaseEntity) return;
		const manager = event.manager;
		const rows = await manager.findBy(VirtualThermostatActuatorClaimEntity, { state: Not('released') });
		if (entity instanceof DeviceEntity) {
			const owned = rows.filter((claim) => claim.sourceDeviceId === entity.id || claim.controllerId === entity.id);
			if (!owned.length) return;
			if (
				[...event.updatedColumns, ...event.updatedRelations].some((column) =>
					['identifier', 'canonicalMac', 'category', 'type'].includes(column.propertyName),
				)
			)
				throw new DevicesValidationException(
					'Reserved thermostat hardware identity cannot be changed before release and explicit repair.',
				);
		} else if (entity instanceof ChannelEntity) {
			const properties = await manager.find(ChannelPropertyEntity, { where: { channel: { id: entity.id } } });
			if (
				rows.some((claim) => properties.some((property) => property.id === claim.sourcePropertyId)) &&
				[...event.updatedColumns, ...event.updatedRelations].some((column) =>
					['identifier', 'category', 'device', 'type'].includes(column.propertyName),
				)
			)
				throw new DevicesValidationException(
					'Reserved thermostat actuator channel cannot be remapped before qualified release.',
				);
		} else if (
			entity instanceof ChannelPropertyEntity &&
			rows.some((claim) => claim.sourcePropertyId === entity.id) &&
			[...event.updatedColumns, ...event.updatedRelations].some((column) =>
				['identifier', 'category', 'dataType', 'permissions', 'format', 'channel', 'type'].includes(
					column.propertyName,
				),
			)
		)
			throw new DevicesValidationException(
				'Reserved thermostat actuator property contract cannot be changed before qualified release.',
			);
	}
}
