import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { AddVirtualProducerBindings1000000000027 } from '../../../migrations/1000000000027-AddVirtualProducerBindings';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { ConfigureVirtualAggregateDto, ConfigureVirtualLightGroupDto } from '../dto/producer-config.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import {
	VirtualAggregateInputEntity,
	VirtualAggregateOperator,
	VirtualLightGroupBindingEntity,
	VirtualLightGroupMemberEntity,
	VirtualLightGroupProfile,
} from '../entities/virtual-producer.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualProducerConfigService } from './virtual-producer-config.service';
import { VirtualPropertyIndexService } from './virtual-property-index.service';

jest.setTimeout(30_000);

describe('virtual producer bindings with coordinated SQLite', () => {
	let directory: string;
	let database: SqliteDataSource;
	let second: SqliteDataSource;
	let graph: VirtualDependencyGraphService;
	let configs: VirtualProducerConfigService;

	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'vd2-bindings-'));
		const options = {
			type: 'sqlite' as const,
			database: join(directory, 'test.sqlite'),
			entities: [__dirname + '/../../../**/*.entity.ts'],
		};
		database = await new SqliteDataSource({ ...options, synchronize: true }).initialize();
		second = await new SqliteDataSource(options).initialize();
		await database.query('PRAGMA busy_timeout = 5000');
		await second.query('PRAGMA busy_timeout = 5000');
		graph = new VirtualDependencyGraphService(database);
		configs = new VirtualProducerConfigService(database, new DeviceStructureLockService(), graph, new EventEmitter2());
	});

	afterEach(async () => {
		if (second?.isInitialized) await second.destroy();
		if (database?.isInitialized) await database.destroy();
		await rm(directory, { recursive: true, force: true });
	});

	const measurement = async (
		mode?: VirtualDeviceMode,
	): Promise<{ deviceId: string; channelId: string; propertyId: string }> => {
		const deviceId = uuid();
		const channelId = uuid();
		const propertyId = uuid();
		await database.getRepository(mode ? VirtualDeviceEntity : DeviceEntity).insert({
			id: deviceId,
			name: 'Temperature',
			category: DeviceCategory.SENSOR,
			...(mode ? { mode } : {}),
		} as never);
		await database
			.getRepository(mode ? VirtualChannelEntity : ChannelEntity)
			.insert({ id: channelId, device: deviceId, category: ChannelCategory.TEMPERATURE, name: 'Temperature' } as never);
		await database.getRepository(mode ? VirtualChannelPropertyEntity : ChannelPropertyEntity).insert({
			id: propertyId,
			channel: channelId,
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			permissions: [PermissionType.READ_ONLY],
			...(mode ? { valueOrigin: VirtualValueOrigin.DERIVED } : {}),
		} as never);
		return { deviceId, channelId, propertyId };
	};

	const aggregateDto = (ids: string[], expectedRevision = 0): ConfigureVirtualAggregateDto =>
		Object.assign(new ConfigureVirtualAggregateDto(), {
			expectedRevision,
			operator: VirtualAggregateOperator.MEDIAN,
			minimumValidInputs: 2,
			maximumAgeSeconds: 300,
			inputs: ids.map((sourcePropertyId) => ({ sourcePropertyId })),
		});

	it('persists typed policy, retains missing input/quorum, repairs the same binding and cascades owner deletion', async () => {
		const a = await measurement();
		const b = await measurement();
		const c = await measurement();
		const output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		const initial = await configs.configureAggregate(output.propertyId, aggregateDto([a.propertyId, b.propertyId]));
		expect(initial.runtime_readiness).toBe('unavailable');
		expect(initial.graph_revision).toBe(1);
		const removed = initial.inputs.find((input) => input.source_property === a.propertyId)!;
		await database.getRepository(ChannelPropertyEntity).delete(a.propertyId);
		const missing = await configs.getAggregate(output.propertyId);
		expect(missing.inputs).toHaveLength(2);
		expect(missing.minimum_valid_inputs).toBe(2);
		expect(missing.inputs.find((input) => input.id === removed.id)).toMatchObject({
			source_property: null,
			source_identity: a.propertyId,
			quantity: 'temperature',
		});
		const keepMissing = aggregateDto([b.propertyId], 1);
		keepMissing.inputs.push({ id: removed.id, sourcePropertyId: null });
		const retained = await configs.configureAggregate(output.propertyId, keepMissing);
		expect(retained.inputs.find((input) => input.id === removed.id)?.source_property).toBeNull();
		const repaired = aggregateDto([b.propertyId], 2);
		repaired.inputs.push({ id: removed.id, sourcePropertyId: c.propertyId });
		expect(
			(await configs.configureAggregate(output.propertyId, repaired)).inputs.find((input) => input.id === removed.id)
				?.source_property,
		).toBe(c.propertyId);
		await database.getRepository(ChannelPropertyEntity).delete(output.propertyId);
		expect(await database.getRepository(VirtualAggregateInputEntity).count()).toBe(0);
	});

	it('shares preview/persistence validation and preserves the revision on rollback', async () => {
		const a = await measurement();
		const b = await measurement();
		const output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		const dto = aggregateDto([a.propertyId, b.propertyId]);
		const preview = await configs.previewAggregate(output.propertyId, dto);
		expect(preview.revision).toBe(1);
		expect(await graph.revision()).toBe(0);
		const invalid = aggregateDto([a.propertyId, a.propertyId]);
		await expect(configs.previewAggregate(output.propertyId, invalid)).rejects.toThrow(/distinct/);
		await expect(configs.configureAggregate(output.propertyId, invalid)).rejects.toThrow(/distinct/);
		expect(await graph.revision()).toBe(0);
		await expect(
			graph.withStructuralWrite(async (manager) => {
				await manager.update(VirtualChannelPropertyEntity, output.propertyId, { name: 'must roll back' });
				throw new Error('late binding failure');
			}),
		).rejects.toThrow('late binding failure');
		expect(
			(await database.getRepository(ChannelPropertyEntity).findOneByOrFail({ id: output.propertyId })).name,
		).not.toBe('must roll back');
		expect(await graph.revision()).toBe(0);
	});

	it('reserves the writer slot before validating reciprocal edges through two independent SQLite connections', async () => {
		const a = await measurement(VirtualDeviceMode.PROJECTION);
		const b = await measurement(VirtualDeviceMode.PROJECTION);
		const other = new VirtualDependencyGraphService(second);
		const edit = (service: VirtualDependencyGraphService, outputId: string, sourceId: string) =>
			service.withStructuralWrite(async (manager) => {
				await service.validateReplacement(
					manager,
					[outputId],
					[{ outputPropertyId: outputId, sourcePropertyId: sourceId }],
				);
				await manager.update(VirtualChannelPropertyEntity, outputId, {
					valueOrigin: VirtualValueOrigin.SOURCE,
					sourcePropertyId: sourceId,
				});
			});
		const outcomes = await Promise.allSettled([
			edit(graph, a.propertyId, b.propertyId),
			edit(other, b.propertyId, a.propertyId),
		]);
		expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
		const rejection = outcomes.find((result) => result.status === 'rejected') as PromiseRejectedResult;
		expect(String(rejection.reason)).toMatch(/cycle/);
		expect(await graph.revision()).toBe(1);
	});

	it('rejects a stale expected revision across independent writers before invoking validation', async () => {
		let validations = 0;
		const other = new VirtualDependencyGraphService(second);
		const operation = async () => {
			validations++;
		};
		const outcomes = await Promise.allSettled([
			graph.withStructuralWrite(operation, 0),
			other.withStructuralWrite(operation, 0),
		]);
		expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
		expect(validations).toBe(1);
		expect(await graph.revision()).toBe(1);
	});

	it('persists physical-light bindings and indexes references without treating members as projection aliases', async () => {
		const groupId = uuid();
		const groupChannelId = uuid();
		const outputId = uuid();
		await database.getRepository(VirtualDeviceEntity).insert({
			id: groupId,
			name: 'Group',
			category: DeviceCategory.LIGHTING,
			mode: VirtualDeviceMode.ACTUATOR_GROUP,
		});
		await database
			.getRepository(VirtualChannelEntity)
			.insert({ id: groupChannelId, device: groupId, name: 'Light', category: ChannelCategory.LIGHT } as never);
		await database.getRepository(VirtualChannelPropertyEntity).insert({
			id: outputId,
			channel: groupChannelId,
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_ONLY],
			valueOrigin: VirtualValueOrigin.DERIVED,
		} as never);
		const members = [];
		for (let i = 0; i < 2; i++) {
			const deviceId = uuid();
			const channelId = uuid();
			const sourceId = uuid();
			await database
				.getRepository(DeviceEntity)
				.insert({ id: deviceId, name: 'Light', category: DeviceCategory.LIGHTING });
			await database
				.getRepository(ChannelEntity)
				.insert({ id: channelId, device: deviceId, name: 'Light', category: ChannelCategory.LIGHT } as never);
			await database.getRepository(ChannelPropertyEntity).insert({
				id: sourceId,
				channel: channelId,
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			} as never);
			members.push({
				sourceChannelId: channelId,
				bindings: [{ outputPropertyId: outputId, sourcePropertyId: sourceId }],
				deviceId,
			});
		}
		const dto = Object.assign(new ConfigureVirtualLightGroupDto(), {
			expectedRevision: 0,
			profile: VirtualLightGroupProfile.LIGHT,
			members,
		});
		const result = await configs.configureLightGroup(groupChannelId, dto);
		expect(result.members).toHaveLength(2);
		const index = new VirtualPropertyIndexService(database.getRepository(VirtualChannelPropertyEntity));
		await index.rebuild();
		expect(index.findBySourceProperty(members[0].bindings[0].sourcePropertyId)).toHaveLength(0);
		expect(index.findDependentOutputIdsBySourceProperty(members[0].bindings[0].sourcePropertyId)).toEqual([outputId]);
		expect(await index.isSourceDeviceReferenced(members[0].deviceId)).toBe(true);
		await database.getRepository(ChannelEntity).delete(members[0].sourceChannelId);
		const missing = await configs.getLightGroup(groupChannelId);
		expect(missing.members).toHaveLength(2);
		expect(missing.members.find((member) => member.source_identity === members[0].sourceChannelId)).toMatchObject({
			source_channel: null,
			bindings: [
				expect.objectContaining({ source_property: null, source_identity: members[0].bindings[0].sourcePropertyId }),
			],
		});
		await database.getRepository(ChannelEntity).delete(groupChannelId);
		expect(await database.getRepository(VirtualLightGroupMemberEntity).count()).toBe(0);
		expect(await database.getRepository(VirtualLightGroupBindingEntity).count()).toBe(0);
	});

	it('builds identical binding column, FK, check and index contracts through migration and synchronize', async () => {
		const migrated = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize();
		try {
			await migrated.query('CREATE TABLE devices_module_devices (id varchar PRIMARY KEY)');
			await migrated.query('CREATE TABLE devices_module_channels (id varchar PRIMARY KEY)');
			await migrated.query('CREATE TABLE devices_module_channels_properties (id varchar PRIMARY KEY)');
			const migration = new AddVirtualProducerBindings1000000000027();
			await migration.up(migrated.createQueryRunner());
			for (const table of [
				'devices_virtual_graph_revision',
				'devices_virtual_aggregate_configs',
				'devices_virtual_aggregate_inputs',
				'devices_virtual_light_group_configs',
				'devices_virtual_light_group_members',
				'devices_virtual_light_group_bindings',
			]) {
				const columns = async (ds: DataSource) =>
					(
						(await ds.query(`PRAGMA table_info("${table}")`)) as {
							name: string;
							type: string;
							notnull: number;
							pk: number;
						}[]
					).map(({ name, type, notnull, pk }) => ({ name, type, notnull, pk }));
				const fks = async (ds: DataSource) =>
					(
						(await ds.query(`PRAGMA foreign_key_list("${table}")`)) as {
							table: string;
							from: string;
							to: string;
							on_delete: string;
						}[]
					)
						.map(({ table, from, to, on_delete }) => ({ table, from, to, on_delete }))
						.sort((a, b) => a.from.localeCompare(b.from));
				const indexes = async (ds: DataSource) =>
					((await ds.query(`PRAGMA index_list("${table}")`)) as { name: string; unique: number }[])
						.filter((index) => !index.name.startsWith('sqlite_autoindex'))
						.map(({ name, unique }) => ({ name, unique }))
						.sort((a, b) => a.name.localeCompare(b.name));
				expect(await columns(migrated)).toEqual(await columns(database));
				expect(await fks(migrated)).toEqual(await fks(database));
				expect(await indexes(migrated)).toEqual(await indexes(database));
			}
			await migration.down(migrated.createQueryRunner());
			await migration.up(migrated.createQueryRunner());
		} finally {
			await migrated.destroy();
		}
	});
});
