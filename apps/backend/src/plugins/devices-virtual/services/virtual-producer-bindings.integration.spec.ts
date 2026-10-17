import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

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
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import { ChannelPropertyEntitySubscriber } from '../../../modules/devices/subscribers/channel-property-entity.subscriber';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { OwnedProducerPublisher, OwnedProducerOperation, PropertyProducerLease, PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
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

import { VirtualAggregateRuntimeService } from './virtual-aggregate-runtime.service';
import { VirtualTransformRuntimeService } from './virtual-transform-runtime.service';
import { VirtualDewPointRuntimeService } from './virtual-dew-point-runtime.service';

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

	describe('owned unavailable batches and real producer staging', () => {
		afterEach(() => { producers.onModuleDestroy(); jest.restoreAllMocks(); jest.useRealTimers(); });
		const property = async () => {
			const output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
			return database.manager.findOneOrFail(VirtualChannelPropertyEntity, {
				where: { id: output.propertyId }, relations: ['channel', 'channel.device'],
			});
		};
		const admitted = (owner: OwnedProducerPublisher, rows: readonly VirtualChannelPropertyEntity[]) => {
			const lifecycle = graph.captureOwnedPublicationLifecycle();
			const batch = producers.beginObservedBatch(owner, rows.map((row) => row.id), lifecycle.guard);
			const operations: OwnedProducerOperation[] = rows.map((row) => ({ kind: 'unavailable', propertyId: row.id,
				property: row, revision: 1, reason: 'runtime_unavailable', expected: producers.captureExpectedSlot(batch, row.id) }));
			const prepared = producers.prepareOwnedBatch(batch, { revision: 0, configurationRevisions: [], operations });
			return { batch, prepared, lifecycle };
		};
		const owner = (events: EventEmitter2) => {
			const result = producers.acquireOwnedPublisher('virtual-producer-state:v1', events);
			if (!result) throw new Error('Expected real publisher owner');
			return result;
		};

		it('captures only pre-admitted expected slots, retains absent ABA while active and drops all observations', async () => {
			const row = await property();
			const owned = owner(new EventEmitter2());
			const a = admitted(owned, [row]);
			const counts = producers.readOwnedOperationCounts();
			const originalExpected = producers.captureExpectedSlot(a.batch, row.id);
			expect(producers.captureExpectedSlot(a.batch, row.id)).toBe(producers.captureExpectedSlot(a.batch, row.id));
			expect(producers.readOwnedOperationCounts()).toEqual(counts);
			producers.register(row, 1);
			producers.remove(row.id);
			expect(producers.owns(row.id)).toBe(false);
			expect(producers.validatePreparedBatch(a.prepared)).toBe(false);
			expect(producers.installPreparedNoEvents(a.prepared)).toBe(false);
			expect(producers.readOwnedOperationCounts()).toEqual({ activeBatches: 0, observedIds: 0 });
			const b = admitted(owned, [row]);
			expect(producers.captureExpectedSlot(b.batch, row.id)).not.toBe(originalExpected);
			expect(() => producers.captureExpectedSlot(a.batch, row.id)).toThrow();
			producers.closeObservedBatch(b.batch);
			expect(producers.readOwnedOperationCounts()).toEqual({ activeBatches: 0, observedIds: 0 });
		});

		it.each(['register', 'remove', 'unregister', 'invalidate', 'beginEvaluation', 'commit', 'metadata', 'clock', 'expiry', 'validator'])(
			'invalidates live exact-slot observations on actual %s mutation', async (mutation) => {
				const events = new EventEmitter2();
				producers = new PropertyProducerRegistryService(events);
				if (mutation === 'metadata') producers.onModuleInit();
				await graph.onApplicationBootstrap();
				const row = await property();
				const lease = producers.register(row, 1, { isCurrent: graph.capturePublishGuard(), reason: 'graph_validation_pending' });
				const now = Date.now();
				const publication = { quality: 'good', reasons: [], sampledAt: new Date(now), evaluatedAt: new Date(now), expiresAt: new Date(now + 60_000) } satisfies import('../../../modules/devices/models/property-sample.model').DerivedPropertyPublication;
				expect(producers.commit(lease, new PropertyValueState(5), publication, producers.version(lease))).toBe(true);
				const a = admitted(owner(events), [row]);
				if (mutation === 'register') producers.register(row, 1);
				if (mutation === 'remove') producers.remove(row.id);
				if (mutation === 'unregister') producers.unregister(lease);
				if (mutation === 'invalidate') producers.invalidate(lease, ['runtime_unavailable']);
				if (mutation === 'beginEvaluation') producers.beginEvaluation(lease);
				if (mutation === 'commit') expect(producers.commit(lease, new PropertyValueState(6), publication, producers.version(lease))).toBe(true);
				if (mutation === 'metadata') events.emit(EventType.CHANNEL_PROPERTY_UPDATED, row);
				if (mutation === 'clock') { jest.useFakeTimers({ now: now - 1000 }); producers.read(row.id); }
				if (mutation === 'expiry') { jest.useFakeTimers({ now: now + 60_001 }); producers.read(row.id); }
				if (mutation === 'validator') producers.setEvidenceValidator(() => false);
				expect(producers.installPreparedNoEvents(a.prepared)).toBe(false);
				expect(producers.readOwnedOperationCounts()).toEqual({ activeBatches: 0, observedIds: 0 });
			},
		);

		it('legacy unregister never mutates same-object same-revision B installed inside A invalidate event', async () => {
			const events = new EventEmitter2();
			producers = new PropertyProducerRegistryService(events);
			const row = await property(), a = producers.register(row, 1);
			let b: PropertyProducerLease | undefined, version: number | null = null;
			events.once(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, () => { b = producers.register(row, 1); version = producers.version(b); });
			expect(producers.unregister(a)).toBe(false);
			if (!b) throw new Error('Reentrant real registration did not execute');
			expect(producers.isCurrent(b)).toBe(true);
			expect(producers.version(b)).toBe(version);
			expect(producers.isCurrent(a)).toBe(false);
		});

		it('one stale slot refuses the whole two-property batch with no owner-view or partial install', async () => {
			const rows = [await property(), await property()], owned = owner(new EventEmitter2());
			const view = producers.readOwnedView(owned), a = admitted(owned, rows);
			const b = producers.register(rows[1], 1);
			expect(producers.installPreparedNoEvents(a.prepared)).toBe(false);
			expect(producers.owns(rows[0].id)).toBe(false);
			expect(producers.isCurrent(b)).toBe(true);
			expect(producers.readOwnedView(owned)).toBe(view);
			expect(producers.readInstalledReport(a.prepared)).toMatchObject({ installed: false, attempted: 0, completed: 0 });
		});

		it('installs all final maps before initializing event1 and stops A before event2 after same-object B replacement', async () => {
			const events = new EventEmitter2(); producers = new PropertyProducerRegistryService(events);
			await graph.onApplicationBootstrap();
			const rows = [await property(), await property()], owned = owner(events), a = admitted(owned, rows);
			const delivered: string[][] = []; let b: PropertyProducerLease | undefined;
			events.once(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, (snapshot: ChannelPropertyEntity) => {
				delivered.push(snapshot.value?.producer?.reasons ?? []);
				expect(rows.map((row) => producers.read(row.id)?.producer?.reasons)).toEqual([['runtime_unavailable'], ['runtime_unavailable']]);
				b = producers.register(rows[1], 1);
			});
			expect(producers.installPreparedNoEvents(a.prepared)).toBe(true);
			expect(producers.notifyInstalled(a.prepared, 0)).toBe('completed');
			expect(producers.notifyInstalled(a.prepared, 1)).toBe('superseded');
			expect(delivered).toEqual([['initializing']]);
			if (!b) throw new Error('B not reached');
			producers.disposeOwnedPublisher(owned);
			expect(producers.isCurrent(b)).toBe(true);
			expect(producers.readInstalledReport(a.prepared)).toMatchObject({ installed: true, attempted: 1, completed: 1 });
		});

		it('records partial delivery on a throwing listener, never retries and leaks no owned handle', async () => {
			const events = new EventEmitter2(); producers = new PropertyProducerRegistryService(events);
			const row = await property(), owned = owner(events), a = admitted(owned, [row]);
			const delivered: string[] = [];
			events.on(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, () => delivered.push('first'));
			events.on(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, () => { throw new Error('PRIVATE Q'); });
			expect(producers.installPreparedNoEvents(a.prepared)).toBe(true);
			expect(producers.notifyInstalled(a.prepared, 0)).toBe('rejected');
			expect(producers.notifyInstalled(a.prepared, 0)).toBe('superseded');
			expect(producers.notifyInstalled(a.prepared, 1)).toBe('superseded');
			expect(delivered).toEqual(['first']);
			expect(producers.readInstalledReport(a.prepared)).toEqual({ installed: true, attempted: 1, completed: 0, terminal: 'notification_rejected' });
			expect(JSON.stringify([owned, a.batch, a.prepared])).toBe('[{},{},{}]');
		});

		it('keeps optional registry emitter absence honest and exact disposal cannot remove B or revive after destroy', async () => {
			producers = new PropertyProducerRegistryService();
			const row = await property(), a = owner(new EventEmitter2());
			expect(producers.acquireOwnedPublisher('virtual-producer-state:v1', new EventEmitter2())).toBeNull();
			const first = admitted(a, [row]);
			producers.disposeOwnedPublisher(a);
			const b = owner(new EventEmitter2());
			producers.disposeOwnedPublisher(a);
			expect(producers.isOwnedPublisherCurrent(b)).toBe(true);
			expect(producers.installPreparedNoEvents(first.prepared)).toBe(false);
			const next = admitted(b, [row]);
			expect(producers.installPreparedNoEvents(next.prepared)).toBe(true);
			for (let i = 0; i < producers.ownedNotificationCount(next.prepared); i++) expect(producers.notifyInstalled(next.prepared, i)).toBe('completed');
			expect(producers.readInstalledReport(next.prepared)).toMatchObject({ attempted: 0, completed: 0 });
			producers.onModuleDestroy();
			expect(producers.acquireOwnedPublisher('virtual-producer-state:v1', new EventEmitter2())).toBeNull();
			expect(() => producers.register(row, 1)).toThrow('destroyed');
			expect(producers.readOwnedOperationCounts()).toEqual({ activeBatches: 0, observedIds: 0 });
		});

		it('does not invalidate fixed-ID observation when an unrelated good producer publishes', async () => {
			const row = await property(), unrelated = await property();
			const a = admitted(owner(new EventEmitter2()), [row]);
			const lease = producers.register(unrelated, 1);
			const now = new Date();
			expect(producers.commit(lease, new PropertyValueState(4), { quality: 'good', reasons: [], sampledAt: now, evaluatedAt: now,
				expiresAt: new Date(now.getTime() + 60_000) }, producers.version(lease))).toBe(true);
			expect(producers.validatePreparedBatch(a.prepared)).toBe(true);
			producers.closeObservedBatch(a.batch);
		});
		it('real aggregate transform and dew runtime activation callbacks run only after required pending callbacks', async () => {
			const events = new EventEmitter2();
			producers = new PropertyProducerRegistryService(events);
			producerState = new VirtualProducerStateService(database, producers, graph, events);
			// Empty catalog: these dependencies MUST remain unused, not fabricated evidence/readiness.
			const module = await Test.createTestingModule({ providers: [
				VirtualAggregateRuntimeService, VirtualTransformRuntimeService, VirtualDewPointRuntimeService,
				{ provide: DataSource, useValue: database }, { provide: PropertyProducerRegistryService, useValue: producers },
				{ provide: VirtualDependencyGraphService, useValue: graph }, { provide: EventEmitter2, useValue: events },
				{ provide: ConfigService, useValue: new ConfigService({ FB_CLI: 'off' }) },
				{ provide: PropertyValueService, useValue: Object.freeze({}) },
				{ provide: DeviceConnectionStateService, useValue: Object.freeze({}) },
			] }).compile();
			const aggregate = module.get(VirtualAggregateRuntimeService), transform = module.get(VirtualTransformRuntimeService), dew = module.get(VirtualDewPointRuntimeService);
			try {
				await producerState.onModuleInit();
				await aggregate.onApplicationBootstrap(); await transform.onApplicationBootstrap(); await dew.onApplicationBootstrap();
				const trace: string[] = [];
				const originalAggregate = aggregate.requestRecompute, originalTransform = transform.requestRecompute, originalDew = dew.requestRecompute;
				jest.spyOn(aggregate, 'requestRecompute').mockImplementation((sourceId) => { trace.push(`aggregate:${graph.isValidated()}`); originalAggregate.call(aggregate, sourceId); });
				jest.spyOn(transform, 'requestRecompute').mockImplementation((sourceId) => { trace.push(`transform:${graph.isValidated()}`); originalTransform.call(transform, sourceId); });
				jest.spyOn(dew, 'requestRecompute').mockImplementation(() => { trace.push(`dew:${graph.isValidated()}`); originalDew.call(dew); });
				let pendingCapture: (() => boolean) | undefined;
				const stop = graph.observeValidation(() => {
					trace.push(`required:${graph.isValidated()}`);
					pendingCapture = graph.capturePublishGuard();
					expect(pendingCapture()).toBe(false);
					return Promise.resolve();
				});
				await graph.refreshQuarantine();
				expect(trace).toEqual(['required:false', 'aggregate:true', 'transform:true', 'dew:true']);
				if (!pendingCapture) throw new Error('Required real callback not reached');
				expect(pendingCapture()).toBe(true);
				graph.invalidateValidation();
				expect(pendingCapture()).toBe(false);
				stop();
			} finally {
				aggregate.onModuleDestroy(); transform.onModuleDestroy(); dew.onModuleDestroy();
				await aggregate.flush(); await transform.flush(); await dew.flush();
				await module.close();
			}
		});

		it.each(['shared', 'distinct'])('stages alias repair metadata with %s emitters like the actual subscriber while leaving canonical physical sample qualified', async (mode) => {
			const events = new EventEmitter2(), propertyEvents = mode === 'shared' ? events : new EventEmitter2();
			producers = new PropertyProducerRegistryService(events);
			producerState = new VirtualProducerStateService(database, producers, graph, propertyEvents);
			producers.onModuleInit();
			const sources = new PropertyValueSourceRegistryService(); sources.register(new VirtualValueSourceService(graph));
			const storage = { isConnected: () => true, query: () => Promise.resolve([]), enqueueWritePoint: () => undefined, flushQueuedWrites: () => Promise.resolve() };
			const module = await Test.createTestingModule({ providers: [
				PropertyValueService, DeviceConnectionStateService, ChannelPropertyEntitySubscriber,
				{ provide: DataSource, useValue: database }, { provide: StorageService, useValue: storage },
				{ provide: PropertyValueSourceRegistryService, useValue: sources },
				{ provide: PropertyValueLockService, useValue: new PropertyValueLockService(database) },
				{ provide: PropertyProducerRegistryService, useValue: producers },
			] }).compile();
			const values = module.get(PropertyValueService);
			try {
				const physical = await measurement(), a = await measurement(VirtualDeviceMode.PROJECTION), b = await measurement(VirtualDeviceMode.PROJECTION);
				await database.manager.update(VirtualChannelPropertyEntity, a.propertyId, { valueOrigin: VirtualValueOrigin.SOURCE, sourcePropertyId: b.propertyId });
				await database.manager.update(VirtualChannelPropertyEntity, b.propertyId, { valueOrigin: VirtualValueOrigin.SOURCE, sourcePropertyId: a.propertyId });
				await producerState.onModuleInit(); await graph.onApplicationBootstrap();
				const source = await database.manager.findOneOrFail(ChannelPropertyEntity, { where: { id: physical.propertyId }, relations: ['channel'] });
				await values.writeSampleWithState(source, 21, { sampledAt: new Date(Date.now() - 10), receivedAt: new Date(), provenance: 'live' });
				const physicalBefore = values.readQualifiedSample(source, 1000);
				const snapshots: ChannelPropertyEntity[] = [];
				propertyEvents.on(EventType.CHANNEL_PROPERTY_UPDATED, (row: ChannelPropertyEntity) => snapshots.push(row));
				let actual: VirtualChannelPropertyEntity | undefined;
				const stop = graph.observeValidation(async () => {
					actual = await database.manager.findOneOrFail(VirtualChannelPropertyEntity, { where: { id: a.propertyId }, relations: ['channel', 'channel.device'] });
					expect(graph.isValidated()).toBe(false);
				});
				await graph.withStructuralWrite(async (manager) => {
					await manager.update(VirtualChannelPropertyEntity, a.propertyId, { sourcePropertyId: physical.propertyId });
					await manager.update(VirtualChannelPropertyEntity, b.propertyId, { sourcePropertyId: physical.propertyId });
				}, 0);
				stop();
				const prepared = snapshots.find((row) => row.id === a.propertyId);
				if (!prepared || !actual) throw new Error('Actual alias notification/subscriber boundary not reached');
				expect(prepared).toBeInstanceOf(VirtualChannelPropertyEntity);
				expect(prepared.unit).toBe(actual.unit);
				expect(prepared.value?.producer?.reasons).toEqual(actual.value?.producer?.reasons);
				expect(prepared.value?.producer?.quality).toBe(actual.value?.producer?.quality);
				expect(prepared.value?.producer?.revision).toBe(actual.value?.producer?.revision);
				expect(prepared.value?.value).toBe(actual.value?.value);
				expect(prepared.value?.lastUpdated).toBe(actual.value?.lastUpdated);
				expect(prepared.value?.producer?.reasons).toEqual(['graph_validation_pending']);
				expect(producers.owns(a.propertyId)).toBe(false);
				expect(values.readQualifiedSample(source, 1000)).toEqual(physicalBefore);
				expect((await values.readLatest(actual))?.value).toBe(21);
			} finally { await module.close(); }
		});

		it('owns plan getters once without freezing caller metadata and refuses failed preparation before install', async () => {
			const events = new EventEmitter2(); producers = new PropertyProducerRegistryService(events);
			const row = await property(), owned = owner(events);
			row.identifier = 'before';
			const lifecycle = graph.captureOwnedPublicationLifecycle();
			const batch = producers.beginObservedBatch(owned, [row.id], lifecycle.guard);
			let reads = 0;
			const operation = { kind: 'unavailable', propertyId: row.id, property: row, revision: 1,
				reason: 'runtime_unavailable', expected: producers.captureExpectedSlot(batch, row.id) } satisfies OwnedProducerOperation;
			Object.defineProperty(operation, 'revision', { enumerable: true, get: () => ++reads });
			const prepared = producers.prepareOwnedBatch(batch, { revision: 0, configurationRevisions: [], operations: [operation] });
			row.identifier = 'after';
			expect(Object.isFrozen(row)).toBe(false); expect(reads).toBe(1);
			const snapshots: ChannelPropertyEntity[] = [];
			events.on(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, (snapshot: ChannelPropertyEntity) => snapshots.push(snapshot));
			expect(producers.installPreparedNoEvents(prepared)).toBe(true);
			expect(producers.notifyInstalled(prepared, 0)).toBe('completed');
			expect(producers.notifyInstalled(prepared, 1)).toBe('completed');
			expect(snapshots.map((snapshot) => snapshot.identifier)).toEqual(['before', 'before']);
			expect(snapshots.map((snapshot) => snapshot.value?.producer?.revision)).toEqual([1, 1]);
			producers.closeObservedBatch(batch);
			const next = producers.beginObservedBatch(owned, [row.id], lifecycle.guard), before = producers.readOwnedView(owned);
			const invalid = { kind: 'unavailable', propertyId: row.id, property: row, revision: 1,
				reason: 'runtime_unavailable', expected: producers.captureExpectedSlot(next, row.id) } satisfies OwnedProducerOperation;
			Object.defineProperty(invalid, 'revision', { get: () => { throw new Error('TEST getter'); } });
			expect(() => producers.prepareOwnedBatch(next, { revision: 0, configurationRevisions: [], operations: [invalid] })).toThrow('TEST getter');
			expect(producers.readOwnedView(owned)).toBe(before);
			expect(producers.isObservedBatchCurrent(next)).toBe(false);
			expect(() => producers.captureExpectedSlot(next, row.id)).toThrow();
			producers.closeObservedBatch(next);
			expect(producers.readOwnedOperationCounts()).toEqual({ activeBatches: 0, observedIds: 0 });
		});

		it('sync pre-init hook admits only registry ownership and stale deletion A never removes same-ID B', async () => {
			const row = await property();
			await graph.onApplicationBootstrap();
			const original = graph.capturePublishGuard();
			producerState.installUnavailable(row, 1);
			expect(graph.isValidated()).toBe(true);
			expect(original()).toBe(true);
			const b = producers.register(row, 1);
			producerState.handlePropertyDeleted(row);
			expect(producers.isCurrent(b)).toBe(true);
			producerState.onModuleDestroy();
			expect(producers.isCurrent(b)).toBe(true);
		});

		it('failed duplicate service init and its cleanup cannot steal or dispose incumbent', async () => {
			const incumbent = owner(new EventEmitter2());
			expect(() => producerState.onModuleInit()).toThrow('already registered');
			producerState.onModuleDestroy();
			expect(producers.isOwnedPublisherCurrent(incumbent)).toBe(true);
		});

		it('pure retain changes no lease epoch owner cell or events and unknown capture cannot admit', async () => {
			const events = new EventEmitter2(); producers = new PropertyProducerRegistryService(events);
			const row = await property(), lease = producers.register(row, 1), owned = owner(events);
			const view = producers.readOwnedView(owned), epoch = producers.version(lease), delivered = jest.fn();
			events.on(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, delivered);
			const batch = producers.beginObservedBatch(owned, [row.id], graph.captureOwnedPublicationLifecycle().guard);
			const prepared = producers.prepareOwnedBatch(batch, { revision: -1, configurationRevisions: [], operations: [
				{ kind: 'retain', propertyId: row.id, expected: producers.captureExpectedSlot(batch, row.id) },
			] });
			expect(producers.installPreparedNoEvents(prepared)).toBe(true);
			expect(producers.ownedNotificationCount(prepared)).toBe(0);
			expect(producers.readOwnedView(owned)).toBe(view);
			expect(producers.version(lease)).toBe(epoch);
			expect(producers.isCurrent(lease)).toBe(true);
			expect(delivered).not.toHaveBeenCalled();
			producers.closeObservedBatch(batch);
			expect(() => producers.captureExpectedSlot({ toJSON: () => ({}) }, row.id)).toThrow();
			expect(producers.isOwnedPublisherCurrent({ toJSON: () => ({}) })).toBe(false);
			expect(producers.readOwnedOperationCounts()).toEqual({ activeBatches: 0, observedIds: 0 });
		});

		it('retains revision metadata only for current owned entries and drops it on exact legacy replacement', async () => {
			const row = await property(), owned = owner(new EventEmitter2());
			const batch = producers.beginObservedBatch(owned, [row.id], graph.captureOwnedPublicationLifecycle().guard);
			const prepared = producers.prepareOwnedBatch(batch, { revision: 0, configurationRevisions: [{ propertyId: row.id, revision: 7 }], operations: [
				{ kind: 'unavailable', propertyId: row.id, property: row, revision: 7, reason: 'runtime_unavailable', expected: producers.captureExpectedSlot(batch, row.id) },
			] });
			expect(producers.installPreparedNoEvents(prepared)).toBe(true);
			producers.closeObservedBatch(batch);
			expect(producers.readOwnedView(owned).configurationRevisions).toEqual([{ propertyId: row.id, revision: 7 }]);
			const b = producers.register(row, 7);
			expect(producers.readOwnedView(owned).configurationRevisions).toEqual([]);
			expect(producers.readOwnedView(owned).quarantineLeases).toEqual([]);
			expect(producers.isCurrent(b)).toBe(true);
			expect(producers.readOwnedOperationCounts()).toEqual({ activeBatches: 0, observedIds: 0 });
		});

	});

});
