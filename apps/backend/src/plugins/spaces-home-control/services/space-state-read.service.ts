import {
	DataSource,
	EntitySubscriberInterface,
	InsertEvent,
	QueryRunner,
	RemoveEvent,
	TransactionCommitEvent,
	TransactionRollbackEvent,
	UpdateEvent,
} from 'typeorm';

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { getEnvValue } from '../../../common/utils/config.utils';
import { DeviceZoneEntity } from '../../../modules/devices/entities/device-zone.entity';
import { ChannelEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceCommandGraphService } from '../../../modules/devices/services/device-command-graph.service';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { SpaceRoleEntity } from '../../../modules/spaces/entities/space-role.entity';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { SpaceType } from '../../../modules/spaces/spaces.constants';
import { SpacesNotFoundException } from '../../../modules/spaces/spaces.exceptions';
import { SpaceClimateRoleEntity } from '../entities/space-climate-role.entity';
import { SpaceLightingRoleEntity } from '../entities/space-lighting-role.entity';
import { SpaceSensorRoleEntity } from '../entities/space-sensor-role.entity';

export const spaceStateMetadataCapacity = 256;

type SpaceFacts = Pick<SpaceEntity, 'id' | 'type'>;
type StateConfiguration = {
	space: SpaceFacts;
	deviceIds: string[];
	lighting: SpaceLightingRoleEntity[];
	climate: SpaceClimateRoleEntity[];
	sensor: SpaceSensorRoleEntity[];
};
type PendingConfiguration = { generation: number; promise: Promise<StateConfiguration | null> };

/** Runtime state inputs: retain structural configuration, hydrate detached graphs with current values on every read. */
@Injectable()
export class SpaceStateReadService implements EntitySubscriberInterface, OnModuleDestroy {
	private readonly enabled: boolean;
	private readonly configurations = new Map<string, StateConfiguration>();
	private readonly loading = new Map<string, PendingConfiguration>();
	private readonly dirtyTransactions = new Set<QueryRunner>();
	private generation = 0;
	private catalogGeneration: number;
	private stopped = false;

	constructor(
		private readonly dataSource: DataSource,
		private readonly metadata: PropertyMetadataService,
		private readonly graphs: DeviceCommandGraphService,
		config: ConfigService,
	) {
		this.enabled = !getEnvValue<boolean>(config, 'FB_PROPERTY_VALUE_LOCKS_ENABLED', false);
		this.catalogGeneration = metadata.getGeneration();
		dataSource.subscribers.push(this);
	}

	async findOne(spaceId: string): Promise<SpaceFacts | null> {
		const configuration = await this.readConfiguration(spaceId);
		return configuration ? { ...configuration.space } : null;
	}

	async findDevicesBySpace(spaceId: string): Promise<DeviceEntity[]> {
		while (true) {
			const generation = this.currentGeneration();
			const configuration = await this.requiredConfiguration(spaceId);
			const devices = await Promise.all(configuration.deviceIds.map((id) => this.graphs.findOne(id)));
			// A move/hide/delete during asynchronous hydration must not publish the old membership.
			if (generation !== this.currentGeneration()) continue;
			return devices.filter((device): device is DeviceEntity => device !== null && !device.hidden);
		}
	}

	async getLightingRoleMap(spaceId: string): Promise<Map<string, SpaceLightingRoleEntity>> {
		const configuration = await this.requiredConfiguration(spaceId);
		return new Map(
			configuration.lighting.map((role) => [
				`${role.deviceId}:${role.channelId}`,
				Object.assign(new SpaceLightingRoleEntity(), structuredClone(role)),
			]),
		);
	}

	async getClimateRoleMap(spaceId: string): Promise<Map<string, SpaceClimateRoleEntity>> {
		const configuration = await this.requiredConfiguration(spaceId);
		return new Map(
			configuration.climate.map((role) => [
				role.channelId ? `${role.deviceId}:${role.channelId}` : role.deviceId,
				Object.assign(new SpaceClimateRoleEntity(), structuredClone(role)),
			]),
		);
	}

	async getSensorRoleMap(spaceId: string): Promise<Map<string, SpaceSensorRoleEntity>> {
		const configuration = await this.requiredConfiguration(spaceId);
		return new Map(
			configuration.sensor.map((role) => [
				`${role.deviceId}:${role.channelId}`,
				Object.assign(new SpaceSensorRoleEntity(), structuredClone(role)),
			]),
		);
	}

	private async requiredConfiguration(spaceId: string): Promise<StateConfiguration> {
		const configuration = await this.readConfiguration(spaceId);
		if (!configuration) throw new SpacesNotFoundException('Requested space does not exist');
		return configuration;
	}

	private async readConfiguration(spaceId: string): Promise<StateConfiguration | null> {
		while (true) {
			const generation = this.currentGeneration();
			if (!this.enabled || this.stopped || this.dirtyTransactions.size > 0) return this.query(spaceId);
			const cached = this.configurations.get(spaceId);
			if (cached) {
				this.configurations.delete(spaceId);
				this.configurations.set(spaceId, cached);
				return cached;
			}
			let pending = this.loading.get(spaceId);
			if (!pending || pending.generation !== generation) {
				if (!pending && this.loading.size >= spaceStateMetadataCapacity) return this.query(spaceId);
				pending = { generation, promise: this.query(spaceId) };
				this.loading.set(spaceId, pending);
			}
			try {
				const configuration = await pending.promise;
				if (generation !== this.currentGeneration()) continue;
				if (configuration && !this.stopped && this.dirtyTransactions.size === 0) {
					if (!this.configurations.has(spaceId) && this.configurations.size >= spaceStateMetadataCapacity) {
						const oldest: unknown = this.configurations.keys().next().value;
						if (typeof oldest === 'string') this.configurations.delete(oldest);
					}
					this.configurations.set(spaceId, configuration);
				}
				return configuration;
			} finally {
				if (this.loading.get(spaceId) === pending) this.loading.delete(spaceId);
			}
		}
	}

	private async query(spaceId: string): Promise<StateConfiguration | null> {
		const space = await this.dataSource
			.getRepository(SpaceEntity)
			.createQueryBuilder('space')
			.callListeners(false)
			.where('space.id = :spaceId', { spaceId })
			.getOne();
		if (!space) return null;
		// Match SpacesService membership: direct room assignment, junction membership for other space types.
		const members =
			space.type === SpaceType.ROOM
				? await this.dataSource
						.getRepository(DeviceEntity)
						.createQueryBuilder('device')
						.select('device.id', 'id')
						.where('device.roomId = :spaceId', { spaceId })
						.andWhere('device.hidden = :hidden', { hidden: false })
						.orderBy('device.name', 'ASC')
						.getRawMany<{ id: string }>()
				: await this.dataSource
						.getRepository(DeviceZoneEntity)
						.createQueryBuilder('membership')
						.innerJoin('membership.device', 'device')
						.select('device.id', 'id')
						.where('membership.zoneId = :spaceId', { spaceId })
						.andWhere('device.hidden = :hidden', { hidden: false })
						.getRawMany<{ id: string }>();
		const [lighting, climate, sensor] = await Promise.all([
			this.dataSource
				.getRepository(SpaceLightingRoleEntity)
				.createQueryBuilder('role')
				.callListeners(false)
				.where('role.spaceId = :spaceId', { spaceId })
				.orderBy('role.role', 'ASC')
				.addOrderBy('role.priority', 'ASC')
				.getMany(),
			this.dataSource
				.getRepository(SpaceClimateRoleEntity)
				.createQueryBuilder('role')
				.callListeners(false)
				.where('role.spaceId = :spaceId', { spaceId })
				.orderBy('role.role', 'ASC')
				.addOrderBy('role.priority', 'ASC')
				.getMany(),
			this.dataSource
				.getRepository(SpaceSensorRoleEntity)
				.createQueryBuilder('role')
				.callListeners(false)
				.where('role.spaceId = :spaceId', { spaceId })
				.orderBy('role.role', 'ASC')
				.addOrderBy('role.priority', 'ASC')
				.getMany(),
		]);
		return {
			space: { id: space.id, type: space.type },
			deviceIds: members.map(({ id }) => id),
			lighting,
			climate,
			sensor,
		};
	}

	/** Raw configuration mutations must invalidate both this projection and the shared device catalog. */
	invalidate(): void {
		this.generation++;
		this.configurations.clear();
	}

	private currentGeneration(): number {
		// Settlement callbacks can be skipped after a transaction lifecycle error. Discard only
		// runners known to be finished: SQLite release() alone leaves active transactions usable.
		for (const runner of this.dirtyTransactions) {
			if (runner.isReleased || !runner.isTransactionActive) {
				this.dirtyTransactions.delete(runner);
				this.invalidate();
			}
		}
		// Includes explicit catalog invalidation after factory reset and database-side cascades.
		const generation = this.metadata.getGeneration();
		if (generation !== this.catalogGeneration) {
			this.catalogGeneration = generation;
			this.invalidate();
		}
		return this.generation;
	}

	beforeInsert(event: InsertEvent<unknown>): void {
		this.mutation(event);
	}
	afterInsert(event: InsertEvent<unknown>): void {
		this.mutation(event);
	}
	beforeUpdate(event: UpdateEvent<unknown>): void {
		this.mutation(event);
	}
	afterUpdate(event: UpdateEvent<unknown>): void {
		this.mutation(event);
	}
	beforeRemove(event: RemoveEvent<unknown>): void {
		this.mutation(event);
	}
	afterRemove(event: RemoveEvent<unknown>): void {
		this.mutation(event);
	}
	afterTransactionCommit(event: TransactionCommitEvent): void {
		this.settled(event.queryRunner);
	}
	afterTransactionRollback(event: TransactionRollbackEvent): void {
		this.settled(event.queryRunner);
	}

	private mutation(event: InsertEvent<unknown> | UpdateEvent<unknown> | RemoveEvent<unknown>): void {
		if (
			event.metadata.target !== SpaceRoleEntity &&
			!event.metadata.inheritanceTree.some(
				(type) =>
					type === SpaceEntity ||
					type === SpaceLightingRoleEntity ||
					type === SpaceClimateRoleEntity ||
					type === SpaceSensorRoleEntity ||
					type === DeviceEntity ||
					type === ChannelEntity ||
					type === DeviceZoneEntity,
			)
		)
			return;
		if (event.queryRunner.isTransactionActive) this.dirtyTransactions.add(event.queryRunner);
		this.invalidate();
	}

	private settled(runner: QueryRunner): void {
		if (!this.dirtyTransactions.has(runner)) return;
		this.invalidate();
		if (!runner.isTransactionActive) this.dirtyTransactions.delete(runner);
	}

	onModuleDestroy(): void {
		this.stopped = true;
		const index = this.dataSource.subscribers.indexOf(this);
		if (index >= 0) this.dataSource.subscribers.splice(index, 1);
		this.invalidate();
		this.dirtyTransactions.clear();
	}
}
