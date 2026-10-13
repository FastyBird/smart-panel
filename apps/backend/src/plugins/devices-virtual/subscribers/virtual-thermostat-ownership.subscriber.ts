import {
	AfterQueryEvent,
	BeforeQueryEvent,
	DataSource,
	EntitySubscriberInterface,
	Not,
	RemoveEvent,
	TransactionCommitEvent,
	TransactionRollbackEvent,
	UpdateEvent,
} from 'typeorm';

import { Injectable, OnApplicationBootstrap } from '@nestjs/common';

import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { VirtualThermostatActuatorClaimEntity } from '../entities/virtual-thermostat.entity';
import { VirtualThermostatClaimsService } from '../services/virtual-thermostat-claims.service';
import { THERMOSTAT_OWNERSHIP_TRIGGERS } from '../services/virtual-thermostat-ownership.sql';

/** Runs at the persistence boundary, including adapter metadata/pruning paths outside REST controllers. */
@Injectable()
export class VirtualThermostatOwnershipSubscriber implements EntitySubscriberInterface, OnApplicationBootstrap {
	private installed = false;
	constructor(
		private readonly dataSource: DataSource,
		private readonly claims: VirtualThermostatClaimsService,
	) {
		this.dataSource.subscribers.push(this);
	}
	async onApplicationBootstrap(): Promise<void> {
		if (!(await this.dataSource.createQueryRunner().hasTable('devices_virtual_thermostat_actuator_claims'))) return;
		for (const [name, sql] of Object.entries(THERMOSTAT_OWNERSHIP_TRIGGERS))
			await this.dataSource.query(`CREATE TRIGGER IF NOT EXISTS "${name}" ${sql}`);
		this.installed = true;
	}
	private isCatalogMutation(query: string): boolean {
		return /^\s*(UPDATE|INSERT(?: OR \w+)? INTO|DELETE FROM)\s+["`[]?(devices_module_(devices|channels|channels_properties)|devices_virtual_thermostat_(?:configs|sources|actuator_claims|settings))["`\]]?\b/i.test(
			query,
		);
	}
	beforeQuery(event: BeforeQueryEvent<unknown>): void {
		if (this.installed && this.isCatalogMutation(event.query)) this.claims.invalidate();
	}
	async afterQuery(event: AfterQueryEvent<unknown>): Promise<void> {
		if (this.installed && !event.queryRunner.isTransactionActive && this.isCatalogMutation(event.query))
			await this.claims.refresh();
	}
	async afterTransactionCommit(event: TransactionCommitEvent): Promise<void> {
		if (this.installed && !event.queryRunner.isTransactionActive) await this.claims.refresh();
	}
	async afterTransactionRollback(event: TransactionRollbackEvent): Promise<void> {
		if (this.installed && !event.queryRunner.isTransactionActive) await this.claims.refresh();
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
