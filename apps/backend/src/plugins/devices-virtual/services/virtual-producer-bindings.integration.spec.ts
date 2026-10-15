import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { ExtensionLoggerService } from '../../../common/logger/extension-logger.service';
import { AddVirtualProducerBindings1000000000027 } from '../../../migrations/1000000000027-AddVirtualProducerBindings';
import { AddVirtualAggregatePolicies1000000000036 } from '../../../migrations/1000000000036-AddVirtualAggregatePolicies';
import { AddVirtualAggregateProfiles1000000000037 } from '../../../migrations/1000000000037-AddVirtualAggregateProfiles';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { ConfigureVirtualAggregateDto, ConfigureVirtualLightGroupDto } from '../dto/producer-config.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import {
	VirtualAggregateConfigEntity,
	VirtualAggregateFilterKind,
	VirtualAggregateInputEntity,
	VirtualAggregateOperator,
	VirtualLightGroupBindingEntity,
	VirtualLightGroupMemberEntity,
	VirtualLightGroupProfile,
} from '../entities/virtual-producer.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualDevicesService } from './virtual-devices.service';
import { VirtualProducerConfigService } from './virtual-producer-config.service';
import { VirtualProducerStateService } from './virtual-producer-state.service';
import { VirtualPropertyIndexService } from './virtual-property-index.service';
import { VirtualValueSourceService } from './virtual-value-source.service';

jest.setTimeout(30_000);

describe('virtual producer bindings with coordinated SQLite', () => {
	let directory: string;
	let database: SqliteDataSource;
	let second: SqliteDataSource;
	let graph: VirtualDependencyGraphService;
	let configs: VirtualProducerConfigService;
	let producers: PropertyProducerRegistryService;
	let producerState: VirtualProducerStateService;

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
		producers = new PropertyProducerRegistryService(new EventEmitter2());
		producerState = new VirtualProducerStateService(database, producers, graph, new EventEmitter2());
		configs = new VirtualProducerConfigService(
			database,
			new DeviceStructureLockService(),
			graph,
			new EventEmitter2(),
			producerState,
		);
	});

	afterEach(async () => {
		producerState?.onModuleDestroy();
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

	it('keeps producer authority closed before the first successful graph validation', async () => {
		const output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		const property = await database.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id: output.propertyId });
		const beforeBootstrap = graph.capturePublishGuard();
		const lease = producers.register(property, 1, { isCurrent: beforeBootstrap, reason: 'graph_validation_pending' });
		expect(graph.isValidated()).toBe(false);
		expect(beforeBootstrap()).toBe(false);
		expect(producers.isAvailable(lease)).toBe(false);
		expect(producers.read(property.id)).toMatchObject({ value: null, producer: { quality: 'unavailable' } });
		await graph.onApplicationBootstrap();
		expect(graph.isRevisionCurrent(0)).toBe(true);
		expect(beforeBootstrap()).toBe(false);
		expect(graph.capturePublishGuard()()).toBe(true);
	});
	it('suspends an unleased projection across failed validation without poisoning its physical source or cached history', async () => {
		const physical = await measurement(),
			projection = await measurement(VirtualDeviceMode.PROJECTION);
		await graph.withStructuralWrite((manager) =>
			manager.update(VirtualChannelPropertyEntity, projection.propertyId, {
				valueOrigin: VirtualValueOrigin.SOURCE,
				sourcePropertyId: physical.propertyId,
			}),
		);
		const sources = new PropertyValueSourceRegistryService();
		sources.register(new VirtualValueSourceService(graph));
		const values = new PropertyValueService(
			{
				isConnected: () => true,
				query: () => Promise.resolve([]),
				enqueueWritePoint: () => undefined,
				flushQueuedWrites: () => Promise.resolve(undefined),
			} as never,
			sources,
			new PropertyValueLockService(database),
			producers,
		);
		const source = await database.manager.findOneByOrFail(ChannelPropertyEntity, { id: physical.propertyId });
		const alias = await database.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id: projection.propertyId });
		// Simulate older owned-series evidence, so falling back to the alias UUID cannot admit history.
		await values.writeSampleWithState(Object.assign(new ChannelPropertyEntity(), source, { id: alias.id }), 99, {
			sampledAt: new Date(),
			receivedAt: new Date(),
			provenance: 'live',
		});
		await values.writeSampleWithState(source, 21, {
			sampledAt: new Date(),
			receivedAt: new Date(),
			provenance: 'live',
		});
		expect(producers.owns(alias.id)).toBe(false);
		expect(values.readQualifiedSample(alias, 10000)?.value).toBe(21);
		const reads = jest.spyOn(graph, 'edges').mockRejectedValueOnce(new Error('post-commit snapshot failed'));
		const logged = jest.spyOn(ExtensionLoggerService.prototype, 'error').mockImplementation();
		try {
			await expect(graph.withStructuralWrite(() => Promise.resolve('committed'))).resolves.toBe('committed');
			expect(values.readQualifiedSample(alias, 10000)).toBeNull();
			expect(values.readQualifiedSample(source, 10000)?.value).toBe(21);
			expect(await values.readLatest(alias)).toMatchObject({ value: null, producer: { quality: 'unavailable' } });
			expect(await values.readLatestStrict(alias)).toMatchObject({ value: null });
			expect((await values.readLatestManyStrict([alias, source])).get(alias.id)?.value).toBeNull();
			expect(
				(await values.readLatestManyBounded([alias, source])).items.find((item) => item.propertyId === alias.id)?.state
					?.value,
			).toBeNull();
			await graph.refreshQuarantine();
			expect(values.readQualifiedSample(alias, 10000)?.value).toBe(21);
		} finally {
			reads.mockRestore();
			logged.mockRestore();
		}
	});
	it('persists typed policy, retains missing input/quorum, repairs the same binding and cascades owner deletion', async () => {
		const a = await measurement();
		const b = await measurement();
		const c = await measurement();
		const output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		const initial = await configs.configureAggregate(output.propertyId, aggregateDto([a.propertyId, b.propertyId]));
		expect(initial.runtime_readiness).toBe('unavailable');
		expect(initial.graph_revision).toBe(1);
		const removed = initial.inputs.find((input) => input.source_property === a.propertyId);
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
		await graph.onApplicationBootstrap();
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
		expect(graph.isRevisionCurrent(0)).toBe(true);
	});

	it('roundtrips weighted/filter policies through preview and persistence and rejects the same invalid boundaries', async () => {
		const a = await measurement(),
			b = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		const dto = aggregateDto([a.propertyId, b.propertyId]);
		dto.operator = VirtualAggregateOperator.WEIGHTED_MEAN;
		dto.inputs[0].weight = 0.000001;
		dto.inputs[1].weight = 1000000;
		dto.outlierFilter = { kind: VirtualAggregateFilterKind.ABSOLUTE_DEVIATION_FROM_MEDIAN, threshold: 2 };
		const preview = await configs.previewAggregate(output.propertyId, dto);
		expect(await graph.revision()).toBe(0);
		const saved = await configs.configureAggregate(output.propertyId, dto);
		expect(saved.outlier_filter).toEqual(preview.outlier_filter);
		expect(saved.inputs.map((input) => input.weight).sort()).toEqual([0.000001, 1000000]);
		expect((await configs.getAggregate(output.propertyId)).outlier_filter).toEqual(dto.outlierFilter);
		for (const weight of [0, -1, Infinity, NaN, 0.0000001, 1000001]) {
			dto.expectedRevision = 1;
			dto.inputs[0].weight = weight;
			await expect(configs.previewAggregate(output.propertyId, dto)).rejects.toThrow();
			await expect(configs.configureAggregate(output.propertyId, dto)).rejects.toThrow();
		}
		dto.inputs[0].weight = 1;
		for (const threshold of [0, -1, Infinity, NaN]) {
			dto.outlierFilter.threshold = threshold;
			await expect(configs.previewAggregate(output.propertyId, dto)).rejects.toThrow();
			await expect(configs.configureAggregate(output.propertyId, dto)).rejects.toThrow();
		}
		expect((await configs.getAggregate(output.propertyId)).revision).toBe(1);
		expect(await graph.revision()).toBe(1);
	});
	it('upgrades old rows to weight one without changing identities or revisions', async () => {
		const migrated = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize();
		try {
			await migrated.query('CREATE TABLE devices_module_devices (id varchar PRIMARY KEY)');
			await migrated.query('CREATE TABLE devices_module_channels (id varchar PRIMARY KEY)');
			await migrated.query('CREATE TABLE devices_module_channels_properties (id varchar PRIMARY KEY)');
			await new AddVirtualProducerBindings1000000000027().up(migrated.createQueryRunner());
			await migrated.query("INSERT INTO devices_module_channels_properties (id) VALUES ('output'), ('source')");
			await migrated.query(
				"INSERT INTO devices_virtual_aggregate_configs (outputPropertyId, operator, minimumValidInputs, maximumAgeSeconds, revision) VALUES ('output', 'mean', 1, 30, 7)",
			);
			await migrated.query(
				"INSERT INTO devices_virtual_aggregate_inputs (id, outputPropertyId, sourcePropertyId, sourcePropertyIdentity, quantity, unit) VALUES ('binding', 'output', 'source', 'source', 'temperature', '°C')",
			);
			const migration = new AddVirtualAggregatePolicies1000000000036();
			await migration.up(migrated.createQueryRunner());
			const profilesMigration = new AddVirtualAggregateProfiles1000000000037();
			await profilesMigration.up(migrated.createQueryRunner());
			expect(
				await migrated.query('SELECT outputPropertyId, profile, revision FROM devices_virtual_aggregate_configs'),
			).toEqual([{ outputPropertyId: 'output', profile: 'temperature', revision: 7 }]);
			await profilesMigration.down(migrated.createQueryRunner());
			await profilesMigration.up(migrated.createQueryRunner());
			expect(
				await migrated.query(
					'SELECT id, sourcePropertyId, sourcePropertyIdentity, weight FROM devices_virtual_aggregate_inputs',
				),
			).toEqual([{ id: 'binding', sourcePropertyId: 'source', sourcePropertyIdentity: 'source', weight: 1 }]);
			expect(
				await migrated.query(
					'SELECT outputPropertyId, operator, revision, outlierFilter FROM devices_virtual_aggregate_configs',
				),
			).toEqual([{ outputPropertyId: 'output', operator: 'mean', revision: 7, outlierFilter: null }]);
			await migration.down(migrated.createQueryRunner());
			await migration.up(migrated.createQueryRunner());
			expect(await migrated.query('SELECT weight FROM devices_virtual_aggregate_inputs')).toEqual([{ weight: 1 }]);
		} finally {
			await migrated.destroy();
		}
	});

	it('uses the same canonical numeric profile for preview, persistence and graph output quarantine', async () => {
		const a = await measurement(),
			b = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		const dto = aggregateDto([a.propertyId, b.propertyId]);
		await configs.configureAggregate(output.propertyId, dto);
		dto.expectedRevision = 1;
		await database.manager.update(ChannelPropertyEntity, a.propertyId, { dataType: DataTypeType.INT });
		await expect(configs.previewAggregate(output.propertyId, dto)).rejects.toThrow(/canonical/);
		await expect(configs.configureAggregate(output.propertyId, dto)).rejects.toThrow(/canonical/);
		expect(await graph.revision()).toBe(1);
		await database.manager.update(ChannelPropertyEntity, output.propertyId, { dataType: DataTypeType.INT });
		await graph.refreshQuarantine();
		expect(graph.isQuarantined(output.propertyId)).toBe(true);
		expect(graph.isQuarantined(a.propertyId)).toBe(false);
		await database.manager.update(ChannelPropertyEntity, output.propertyId, { dataType: DataTypeType.FLOAT });
		await graph.refreshQuarantine();
		expect(graph.isQuarantined(output.propertyId)).toBe(false);
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
		const rejection = outcomes.find((result) => result.status === 'rejected');
		expect(String(rejection.reason)).toMatch(/cycle/);
		expect(await graph.revision()).toBe(1);
	});

	it('rejects a stale expected revision across independent writers before invoking validation', async () => {
		let validations = 0;
		const other = new VirtualDependencyGraphService(second);
		const operation = () => {
			validations++;
			return Promise.resolve();
		};
		const outcomes = await Promise.allSettled([
			graph.withStructuralWrite(operation, 0),
			other.withStructuralWrite(operation, 0),
		]);
		expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
		expect(validations).toBe(1);
		expect(await graph.revision()).toBe(1);
	});

	it('retains every aggregate link and reports removal and repair of a non-last input', async () => {
		const sources = await Promise.all([measurement(), measurement(), measurement()]);
		const output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		const configured = await configs.configureAggregate(
			output.propertyId,
			aggregateDto(sources.map((source) => source.propertyId)),
		);
		const index = new VirtualPropertyIndexService(database.getRepository(VirtualChannelPropertyEntity));
		await index.rebuild();
		const links = index.findLinksByVirtualDevice(output.deviceId);
		expect(links).toHaveLength(3);
		expect(links).toEqual(expect.arrayContaining(await index.loadLinksByVirtualDevice(output.deviceId)));
		const removed = links[0];
		await database.getRepository(ChannelPropertyEntity).delete(removed.sourcePropertyId);
		expect((await index.rebuild()).rewiredVirtualDeviceIds).toContain(output.deviceId);
		expect(index.findLinksByVirtualDevice(output.deviceId)).toHaveLength(3);
		expect(index.findLinksByVirtualDevice(output.deviceId)).toContainEqual(
			expect.objectContaining({ bindingId: removed.bindingId, sourcePropertyId: null }),
		);
		const replacement = await measurement();
		const repair = aggregateDto(
			sources.filter((source) => source.propertyId !== removed.sourcePropertyId).map((source) => source.propertyId),
			configured.revision,
		);
		repair.inputs.push({ id: removed.bindingId, sourcePropertyId: replacement.propertyId });
		await configs.configureAggregate(output.propertyId, repair);
		expect((await index.rebuild()).rewiredVirtualDeviceIds).toContain(output.deviceId);
		expect(index.findLinksByVirtualDevice(output.deviceId)).toHaveLength(3);
		expect(index.findLinksByVirtualDevice(output.deviceId)).toEqual(
			expect.arrayContaining(await index.loadLinksByVirtualDevice(output.deviceId)),
		);
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
		const members: {
			sourceChannelId: string;
			deviceId: string;
			bindings: { outputPropertyId: string; sourcePropertyId: string }[];
		}[] = [];
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
		expect(index.findLinksByVirtualDevice(groupId)).toHaveLength(4);
		expect(index.findLinksByVirtualDevice(groupId)).toEqual(
			expect.arrayContaining(await index.loadLinksByVirtualDevice(groupId)),
		);
		expect(index.findBySourceProperty(members[0].bindings[0].sourcePropertyId)).toHaveLength(0);
		expect(index.findDependentOutputIdsBySourceProperty(members[0].bindings[0].sourcePropertyId)).toEqual([outputId]);
		expect(await index.isSourceDeviceReferenced(members[0].deviceId)).toBe(true);
		await database.getRepository(ChannelEntity).delete(members[0].sourceChannelId);
		expect((await index.rebuild()).rewiredVirtualDeviceIds).toContain(groupId);
		expect(index.findLinksByVirtualDevice(groupId)).toHaveLength(4);
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

	it('owns unavailable live state after configuration and restart, and exposes it through projected core reads', async () => {
		const a = await measurement();
		const b = await measurement();
		const output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await configs.configureAggregate(output.propertyId, aggregateDto([a.propertyId, b.propertyId]));
		expect(producers.read(output.propertyId)?.producer).toMatchObject({
			quality: 'unavailable',
			reasons: ['runtime_unavailable'],
			revision: 1,
		});
		const resolver = new PropertyValueSourceRegistryService();
		resolver.register(new VirtualValueSourceService());
		const values = new PropertyValueService(null as never, resolver, null as never, producers);
		const projection = Object.assign(new VirtualChannelPropertyEntity(), {
			id: uuid(),
			valueOrigin: VirtualValueOrigin.SOURCE,
			sourcePropertyId: output.propertyId,
		});
		// A history backend is deliberately absent: qualified reads must not fall through to it.
		expect((await values.readLatest(projection))?.producer.quality).toBe('unavailable');
		producers.onModuleDestroy();
		await producerState.onModuleInit();
		expect((await values.readLatest(projection))?.producer).toMatchObject({ quality: 'unavailable', revision: 1 });
		const property = await database
			.getRepository(VirtualChannelPropertyEntity)
			.findOneByOrFail({ id: output.propertyId });
		producerState.handlePropertyDeleted(property);
		expect(producers.owns(output.propertyId)).toBe(false);
	});

	it('fences former runtime leases on configuration revision changes and leaves state intact on rejected edits', async () => {
		const a = await measurement();
		const b = await measurement();
		const output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		const property = await database
			.getRepository(VirtualChannelPropertyEntity)
			.findOneByOrFail({ id: output.propertyId });
		const oldLease = producers.register(property, 0);
		await configs.configureAggregate(output.propertyId, aggregateDto([a.propertyId, b.propertyId]));
		expect(producers.isCurrent(oldLease)).toBe(false);
		const before = producers.read(output.propertyId);
		await expect(
			configs.configureAggregate(output.propertyId, aggregateDto([a.propertyId, a.propertyId], 1)),
		).rejects.toThrow(/distinct/);
		expect(producers.read(output.propertyId)).toEqual(before);
		expect(
			producers.commit(
				oldLease,
				new PropertyValueState(22),
				{
					quality: 'good',
					reasons: [],
					sampledAt: new Date(),
					evaluatedAt: new Date(),
					expiresAt: new Date(Date.now() + 1000),
				},
				0,
			),
		).toBe(false);
	});

	it('quarantines only corrupted components across every core read boundary, preserves physical quality and clears repaired masks', async () => {
		const physical = await measurement();
		const other = await measurement();
		const a = await measurement(VirtualDeviceMode.PROJECTION);
		const b = await measurement(VirtualDeviceMode.PROJECTION);
		const healthy = await measurement(VirtualDeviceMode.PROJECTION);
		await database
			.getRepository(VirtualChannelPropertyEntity)
			.update(a.propertyId, { valueOrigin: VirtualValueOrigin.SOURCE, sourcePropertyId: b.propertyId });
		await database
			.getRepository(VirtualChannelPropertyEntity)
			.update(b.propertyId, { valueOrigin: VirtualValueOrigin.SOURCE, sourcePropertyId: a.propertyId });
		await database
			.getRepository(VirtualChannelPropertyEntity)
			.update(healthy.propertyId, { valueOrigin: VirtualValueOrigin.SOURCE, sourcePropertyId: other.propertyId });
		// Imported malformed producer config connects the cycle to a physical leaf. That leaf must
		// retain its own live authority, rather than being globally invalidated with the bad aliases.
		await database.getRepository(VirtualAggregateConfigEntity).insert({
			outputPropertyId: a.propertyId,
			operator: VirtualAggregateOperator.MEAN,
			minimumValidInputs: 1,
			maximumAgeSeconds: 300,
		});
		await database.getRepository(VirtualAggregateInputEntity).insert({
			id: uuid(),
			outputPropertyId: a.propertyId,
			sourcePropertyId: physical.propertyId,
			sourcePropertyIdentity: physical.propertyId,
			quantity: 'temperature',
			unit: '°C',
		});
		await producerState.onModuleInit();
		await graph.onApplicationBootstrap();
		expect(graph.isQuarantined(a.propertyId)).toBe(true);
		expect(graph.isQuarantined(healthy.propertyId)).toBe(false);
		expect(producers.owns(physical.propertyId)).toBe(false);
		const resolver = new PropertyValueSourceRegistryService();
		resolver.register(new VirtualValueSourceService(graph));
		const storage = {
			isConnected: () => true,
			query: () => Promise.resolve([]),
			enqueueWritePoint: () => undefined,
			flushQueuedWrites: () => Promise.resolve(undefined),
		} as unknown as StorageService;
		const values = new PropertyValueService(storage, resolver, new PropertyValueLockService(database), producers);
		const source = await database
			.getRepository(ChannelPropertyEntity)
			.findOne({ where: { id: physical.propertyId }, relations: ['channel'] });
		const alias = await database.getRepository(VirtualChannelPropertyEntity).findOneByOrFail({ id: a.propertyId });
		await values.writeSampleWithState(source, 21, {
			sampledAt: new Date(Date.now() - 10),
			receivedAt: new Date(),
			provenance: 'live',
		});
		expect(values.readQualifiedSample(source, 1000)?.value).toBe(21);
		expect(values.readQualifiedSample(alias, 1000)).toBeNull();
		expect((await values.readLatest(alias))?.producer).toMatchObject({
			quality: 'unavailable',
			reasons: ['graph_quarantined'],
		});
		expect((await values.readLatestStrict(alias))?.producer.quality).toBe('unavailable');
		const many = await values.readLatestManyStrict([alias, source]);
		expect(many.get(alias.id)?.producer.quality).toBe('unavailable');
		expect(many.get(source.id)?.value).toBe(21);
		const bounded = await values.readLatestManyBounded([alias, source]);
		expect(bounded.items.find((item) => item.propertyId === alias.id)?.state?.producer.quality).toBe('unavailable');
		await graph.withStructuralWrite(async (manager) => {
			await manager.delete(VirtualAggregateConfigEntity, { outputPropertyId: a.propertyId });
			await graph.validateReplacement(
				manager,
				[a.propertyId, b.propertyId],
				[a.propertyId, b.propertyId].map((outputPropertyId) => ({
					outputPropertyId,
					sourcePropertyId: physical.propertyId,
				})),
			);
			await manager.update(VirtualChannelPropertyEntity, a.propertyId, { sourcePropertyId: physical.propertyId });
			await manager.update(VirtualChannelPropertyEntity, b.propertyId, { sourcePropertyId: physical.propertyId });
		}, 0);
		expect(graph.isQuarantined(a.propertyId)).toBe(false);
		expect(graph.isRevisionCurrent(1)).toBe(true);
		expect(producers.owns(a.propertyId)).toBe(false);
		const repaired = await database.getRepository(VirtualChannelPropertyEntity).findOneByOrFail({ id: a.propertyId });
		expect((await values.readLatest(repaired))?.value).toBe(21);
		expect(values.readQualifiedSample(repaired, 1000)?.value).toBe(21);
		producerState.onModuleDestroy();
	});

	it('rechecks a previously eligible virtual source after reservation and rejects disappearance before persistence', async () => {
		const source = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		const destination = await measurement(VirtualDeviceMode.PROJECTION);
		const propertyReader = {
			findOne: (id: string) =>
				database
					.getRepository(ChannelPropertyEntity)
					.findOne({ where: { id }, relations: ['channel', 'channel.device'] }),
		} as unknown as ChannelsPropertiesService;
		const channelReader = {
			findOne: (id: string) => database.getRepository(ChannelEntity).findOne({ where: { id }, relations: ['device'] }),
		} as unknown as ChannelsService;
		const deviceReader = {
			findOne: (id: string) => database.getRepository(DeviceEntity).findOneBy({ id }),
		} as unknown as DevicesService;
		const service = new VirtualDevicesService(
			propertyReader,
			channelReader,
			deviceReader,
			new VirtualPropertyIndexService(database.getRepository(VirtualChannelPropertyEntity)),
			null as never,
			graph,
		);
		await expect(service.assertSourceNotVirtual(source.propertyId)).resolves.toBeUndefined();
		await database
			.getRepository(VirtualChannelPropertyEntity)
			.update(source.propertyId, { valueOrigin: VirtualValueOrigin.SOURCE });
		const target = await database
			.getRepository(VirtualChannelPropertyEntity)
			.findOneByOrFail({ id: destination.propertyId });
		target.valueOrigin = VirtualValueOrigin.SOURCE;
		target.sourcePropertyId = source.propertyId;
		await expect(
			graph.withStructuralWrite((manager) =>
				service.assertProjectionCompatible(target, destination.channelId, manager),
			),
		).rejects.toThrow(/eligible/);
		target.sourcePropertyId = uuid();
		await expect(
			graph.withStructuralWrite((manager) =>
				service.assertProjectionCompatible(target, destination.channelId, manager),
			),
		).rejects.toThrow(/disappeared/);
		expect(await graph.revision()).toBe(0);
	});

	it('builds identical binding column, FK, check and index contracts through migration and synchronize', async () => {
		const migrated = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize();
		try {
			await migrated.query('CREATE TABLE devices_module_devices (id varchar PRIMARY KEY)');
			await migrated.query('CREATE TABLE devices_module_channels (id varchar PRIMARY KEY)');
			await migrated.query('CREATE TABLE devices_module_channels_properties (id varchar PRIMARY KEY)');
			const migration = new AddVirtualProducerBindings1000000000027();
			await migration.up(migrated.createQueryRunner());
			await new AddVirtualAggregatePolicies1000000000036().up(migrated.createQueryRunner());
			await new AddVirtualAggregateProfiles1000000000037().up(migrated.createQueryRunner());
			for (const table of [
				'devices_virtual_graph_revision',
				'devices_virtual_aggregate_configs',
				'devices_virtual_aggregate_inputs',
				'devices_virtual_light_group_configs',
				'devices_virtual_light_group_members',
				'devices_virtual_light_group_bindings',
			]) {
				const rows = async <T>(ds: DataSource, sql: string): Promise<T[]> => {
					const result: unknown = await ds.query(sql);
					return result as T[];
				};
				const columns = async (ds: DataSource) =>
					(
						await rows<{ name: string; type: string; notnull: number; pk: number }>(ds, `PRAGMA table_info("${table}")`)
					).map(({ name, type, notnull, pk }) => ({
						name,
						type,
						notnull,
						pk,
					}));
				const fks = async (ds: DataSource) =>
					(
						await rows<{ table: string; from: string; to: string; on_delete: string }>(
							ds,
							`PRAGMA foreign_key_list("${table}")`,
						)
					)
						.map(({ table, from, to, on_delete }) => ({ table, from, to, on_delete }))
						.sort((a, b) => a.from.localeCompare(b.from));
				const indexes = async (ds: DataSource) =>
					(await rows<{ name: string; unique: number }>(ds, `PRAGMA index_list("${table}")`))
						.filter((index) => !index.name.startsWith('sqlite_autoindex'))
						.map(({ name, unique }) => ({ name, unique }))
						.sort((a, b) => a.name.localeCompare(b.name));
				expect((await columns(migrated)).sort((a, b) => a.name.localeCompare(b.name))).toEqual(
					(await columns(database)).sort((a, b) => a.name.localeCompare(b.name)),
				);
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
