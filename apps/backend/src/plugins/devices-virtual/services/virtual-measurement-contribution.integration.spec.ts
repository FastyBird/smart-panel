import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuid } from 'uuid';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { DeviceContributionRegistryService } from '../../../modules/devices/services/device-contribution.registry.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { ClimateContributionPlannerService } from '../../spaces-home-control/services/climate-contribution-planner.service';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import {
	VirtualAggregateConfigEntity,
	VirtualAggregateInputEntity,
	VirtualAggregateOperator,
} from '../entities/virtual-producer.entity';
import { VirtualThermostatConfigEntity, VirtualThermostatSourceEntity } from '../entities/virtual-thermostat.entity';
import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';

import { VirtualMeasurementContributionService } from './virtual-measurement-contribution.service';
import { VirtualValueSourceService } from './virtual-value-source.service';

jest.setTimeout(30000);

describe('durable virtual measurement coverage and room planner integration', () => {
	let directory: string;
	let database: SqliteDataSource;
	let provider: VirtualMeasurementContributionService;
	let planner: ClimateContributionPlannerService;
	let generation: number;
	let graphCurrent: boolean;
	let publications: Map<string, PropertyValueState>;
	let values: PropertyValueService;
	let storage: { query: jest.Mock; isConnected: jest.Mock; writePoints: jest.Mock; enqueueWritePoint: jest.Mock };

	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'vd2-climate-coverage-'));
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: join(directory, 'test.sqlite'),
			synchronize: true,
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		generation = 1;
		graphCurrent = true;
		publications = new Map();
		const registry = new DeviceContributionRegistryService();
		const valueSources = new PropertyValueSourceRegistryService();
		valueSources.register(
			new VirtualValueSourceService({ isValidated: () => graphCurrent, isQuarantined: () => false } as never),
		);
		storage = {
			query: jest.fn().mockResolvedValue([]),
			isConnected: jest.fn().mockReturnValue(true),
			writePoints: jest.fn().mockResolvedValue(undefined),
			enqueueWritePoint: jest.fn().mockResolvedValue(undefined),
		};
		values = new PropertyValueService(
			storage as unknown as StorageService,
			valueSources,
			new PropertyValueLockService({} as never),
		);
		provider = new VirtualMeasurementContributionService(
			registry,
			database,
			{
				revision: () => Promise.resolve(1),
				capturePublishGuard: () => () => graphCurrent,
				isRevisionCurrent: () => graphCurrent,
			} as never,
			{ getGeneration: () => generation } as never,
			{ read: (id: string) => publications.get(id) ?? null } as never,
			values,
		);
		provider.onModuleInit();
		planner = new ClimateContributionPlannerService(registry);
	});

	afterEach(async () => {
		provider?.onModuleDestroy();
		if (database?.isInitialized) await database.destroy();
		await rm(directory, { recursive: true, force: true });
	});

	const measurement = async (mode?: VirtualDeviceMode) => {
		const deviceId = uuid(),
			channelId = uuid(),
			id = uuid();
		await database.getRepository(mode ? VirtualDeviceEntity : DeviceEntity).insert({
			id: deviceId,
			name: 'Temperature',
			category: DeviceCategory.SENSOR,
			...(mode ? { mode } : {}),
		} as never);
		await database
			.getRepository(mode ? VirtualChannelEntity : ChannelEntity)
			.insert({ id: channelId, device: deviceId, name: 'Temperature', category: ChannelCategory.TEMPERATURE } as never);
		await database.getRepository(mode ? VirtualChannelPropertyEntity : ChannelPropertyEntity).insert({
			id,
			channel: channelId,
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			permissions: [PermissionType.READ_ONLY],
			...(mode ? { valueOrigin: VirtualValueOrigin.DERIVED } : {}),
		} as never);
		const property = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id },
			relations: ['channel', 'channel.device'],
		});
		property.value = new PropertyValueState(20);
		return property;
	};
	const aggregate = async (inputs: ChannelPropertyEntity[]) => {
		const output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await database.manager.save(VirtualAggregateConfigEntity, {
			outputPropertyId: output.id,
			schemaVersion: 1,
			revision: 1,
			operator: VirtualAggregateOperator.MEAN,
			minimumValidInputs: 1,
			maximumAgeSeconds: 60,
		});
		await database.manager.save(
			VirtualAggregateInputEntity,
			inputs.map((source) => ({
				outputPropertyId: output.id,
				sourcePropertyId: source.id,
				sourcePropertyIdentity: source.id,
				quantity: PropertyCategory.TEMPERATURE,
				unit: '°C',
			})),
		);
		publications.set(
			output.id,
			Object.assign(new PropertyValueState(24), { producer: { quality: 'good', revision: 1 } }),
		);
		return output;
	};
	const transform = async (source: ChannelPropertyEntity) => {
		const output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await database.manager.save(VirtualTransformConfigEntity, {
			outputPropertyId: output.id,
			schemaVersion: 1,
			revision: 1,
			maximumAgeSeconds: 60,
			policy: {} as never,
			configuredAt: new Date(),
			quantity: 'temperature',
			unit: '°C',
		});
		await database.manager.save(VirtualTransformSourceEntity, {
			outputPropertyId: output.id,
			sourcePropertyId: source.id,
			sourcePropertyIdentity: source.id,
			quantity: 'temperature',
			unit: '°C',
		});
		publications.set(
			output.id,
			Object.assign(new PropertyValueState(24), { producer: { quality: 'good', revision: 1 } }),
		);
		return output;
	};

	it('qualifies projection live evidence without trusting loaded history, adding a room TTL or reviving revoked/faulted samples', async () => {
		const raw = await measurement(),
			output = await measurement(VirtualDeviceMode.PROJECTION);
		await database.manager.update(VirtualChannelPropertyEntity, output.id, {
			valueOrigin: VirtualValueOrigin.SOURCE,
			sourcePropertyId: raw.id,
		});
		const now = Date.now();
		storage.query.mockResolvedValue([{ propertyId: raw.id, time: new Date(now - 86400000), numberValue: 99 }]);
		// Mirror the normal afterLoad value hydration: a persisted historical scalar remains displayable,
		// but it is never sufficient evidence for the selected room representative.
		database.subscribers.push({
			listenTo: () => ChannelPropertyEntity,
			afterLoad: async (property: ChannelPropertyEntity) => {
				property.value = await values.readLatest(property);
			},
		});
		expect(
			await values.readLatest(
				await database.manager.findOneOrFail(ChannelPropertyEntity, { where: { id: output.id } }),
			),
		).toMatchObject({ value: 99 });
		const plan = await planner.plan([raw, output]);
		expect(plan.read()).toMatchObject({
			temperature: null,
			diagnostics: { excludedPropertyIds: [raw.id], unavailablePropertyIds: [output.id] },
		});
		let sourceCurrent = true;
		await values.writeSampleWithState(raw, 21, {
			sampledAt: new Date(now - 86400000),
			receivedAt: new Date(now),
			provenance: 'live',
			sourceIsCurrent: () => sourceCurrent,
		});
		expect(plan.read().temperature).toBe(21);
		sourceCurrent = false;
		expect(plan.read().temperature).toBeNull();
		sourceCurrent = true;
		await values.writeSampleWithState(raw, 22, {
			sampledAt: new Date(now - 1000),
			receivedAt: new Date(now),
			provenance: 'live',
			sourceIsCurrent: () => sourceCurrent,
		});
		expect(plan.read().temperature).toBe(22);
		await values.writeSampleWithState(raw, null, {
			sampledAt: new Date(now),
			receivedAt: new Date(now),
			provenance: 'live',
		});
		expect(plan.read().temperature).toBeNull();
		await values.writeSampleWithState(raw, 99, {
			sampledAt: new Date(now),
			receivedAt: new Date(now),
			provenance: 'retained',
		});
		expect(plan.read().temperature).toBeNull();
		expect(plan.read().diagnostics.excludedPropertyIds).toEqual([raw.id]);
	});

	it('expands aggregate through a transform to physical identity and suppresses both raw and transform readings', async () => {
		const raw = await measurement(),
			converted = await transform(raw),
			output = await aggregate([converted]);
		const result = (await planner.plan([raw, converted, output])).read();
		expect(result.temperature).toBe(24);
		expect(result.diagnostics).toMatchObject({
			status: 'ok',
			selectedPropertyIds: [output.id],
			excludedPropertyIds: [raw.id, converted.id],
		});
	});

	it('detects aggregate overlap through distinct transformed and physical input identities', async () => {
		const raw = await measurement(),
			converted = await transform(raw),
			first = await aggregate([converted]),
			second = await aggregate([raw]);
		const result = (await planner.plan([raw, first, second])).read();
		expect(result.temperature).toBeNull();
		expect(result.diagnostics.conflicts).toEqual([
			{ leafPropertyId: raw.id, representativePropertyIds: [first.id, second.id].sort() },
		]);
	});

	it('retains missing physical identity and coverage after deletion without accepting a cached output', async () => {
		const raw = await measurement(),
			output = await aggregate([raw]);
		await database.manager.delete(ChannelPropertyEntity, raw.id);
		publications.delete(output.id);
		const coverage = await provider.getMeasurementCoverage(output);
		expect(coverage.leaves).toEqual([raw.id]);
		const result = (await planner.plan([raw, output])).read();
		expect(result.temperature).toBeNull();
		expect(result.diagnostics).toMatchObject({ excludedPropertyIds: [raw.id], unavailablePropertyIds: [output.id] });
	});

	it('reports duplicate physical leaves inside one aggregate even when reached through a transform', async () => {
		const raw = await measurement(),
			converted = await transform(raw),
			output = await aggregate([raw, converted]);
		const result = (await planner.plan([raw, converted, output])).read();
		expect(result.temperature).toBeNull();
		expect(result.diagnostics).toMatchObject({
			status: 'coverage_conflict',
			conflicts: [{ leafPropertyId: raw.id, representativePropertyIds: [output.id] }],
		});
	});

	it('refuses a disabled or semantically changed output even if an old producer value remains cached', async () => {
		const raw = await measurement(),
			output = await aggregate([raw]);
		const owner = (output.channel as ChannelEntity).device as DeviceEntity;
		await database.manager.update(DeviceEntity, owner.id, { enabled: false });
		expect((await planner.plan([raw, output])).read()).toMatchObject({
			temperature: null,
			diagnostics: { excludedPropertyIds: [raw.id], unavailablePropertyIds: [output.id] },
		});
		await database.manager.update(DeviceEntity, owner.id, { enabled: true });
		await database.manager.update(ChannelPropertyEntity, output.id, { category: PropertyCategory.VOLTAGE });
		expect((await planner.plan([raw, output])).read().temperature).toBeNull();
	});

	it('uses only the bound ambient provenance for a controller room readout, never its protective floor', async () => {
		const ambient = await measurement(),
			floor = await measurement(),
			output = await measurement(VirtualDeviceMode.CLIMATE_CONTROLLER);
		await database.manager.update(VirtualChannelPropertyEntity, output.id, { valueOrigin: VirtualValueOrigin.LOCAL });
		const owner = (output.channel as ChannelEntity).device as DeviceEntity;
		const controllerId = uuid();
		await database.manager.save(VirtualThermostatConfigEntity, {
			controllerId,
			ownerDeviceId: owner.id,
			revision: 1,
			schemaVersion: 1,
			requestedMode: 'off',
			locked: false,
			policy: {} as never,
			heuristic: null,
			contactOpeningMs: 0,
			contactClosingMs: 0,
			configuredAt: new Date(),
			releaseRequestedAt: null,
		});
		await database.manager.save(VirtualThermostatSourceEntity, [
			{
				controllerId,
				role: 'ambient',
				sourcePropertyId: ambient.id,
				sourcePropertyIdentity: ambient.id,
				physicalIdentity: null,
				contractFingerprint: 'ambient',
				maximumAgeSeconds: 60,
				openValue: null,
				closedValue: null,
			},
			{
				controllerId,
				role: 'floor',
				sourcePropertyId: floor.id,
				sourcePropertyIdentity: floor.id,
				physicalIdentity: null,
				contractFingerprint: 'floor',
				maximumAgeSeconds: 60,
				openValue: null,
				closedValue: null,
			},
		]);
		publications.set(
			output.id,
			Object.assign(new PropertyValueState(22), { producer: { quality: 'good', revision: 1 } }),
		);
		const coverage = await provider.getMeasurementCoverage(output);
		expect(coverage.leaves).toEqual([ambient.id]);
		expect(coverage.representedProperties).toEqual([ambient.id]);
		expect((await planner.plan([ambient, output])).read()).toMatchObject({
			temperature: 22,
			diagnostics: { excludedPropertyIds: [ambient.id] },
		});
	});

	it('rejects obsolete producer revisions and fences cached coverage on metadata and graph changes', async () => {
		const raw = await measurement(),
			output = await aggregate([raw]);
		const plan = await planner.plan([raw, output]);
		publications.set(
			output.id,
			Object.assign(new PropertyValueState(99), { producer: { quality: 'good', revision: 0 } }),
		);
		expect(plan.read()).toMatchObject({ temperature: null, diagnostics: { unavailablePropertyIds: [output.id] } });
		generation++;
		expect(plan.read().diagnostics.status).toBe('coverage_stale');
		graphCurrent = false;
		expect((await planner.plan([raw, output])).read().diagnostics.status).toBe('coverage_stale');
	});
});
