import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuid } from 'uuid';

import {
	createProtectionProbe,
	createShellyThermostatSafetyCatalog,
} from '../../../../test/support/thermostat-protection-fixture';
import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import {
	ModbusChannelEntity,
	ModbusChannelPropertyEntity,
	ModbusDeviceEntity,
} from '../../devices-modbus/entities/devices-modbus.entity';
import { SHELLY_GUARDED_PROFILE } from '../../devices-shelly-ng/contracts/thermostat-actuation.constants';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ShellySampleSourceEntity } from '../../devices-shelly-ng/entities/shelly-sample-source.entity';
import { ShellyNgDevicePlatform } from '../../devices-shelly-ng/platforms/shelly-ng.device.platform';
import {
	Zigbee2mqttChannelEntity,
	Zigbee2mqttChannelPropertyEntity,
	Zigbee2mqttDeviceEntity,
} from '../../devices-zigbee2mqtt/entities/devices-zigbee2mqtt.entity';
import { SUPERVISED_SWITCH_PROFILE } from '../contracts/thermostat-actuation.contract';
import { VirtualThermostatActuatorClaimEntity } from '../entities/virtual-thermostat.entity';

import { ThermostatAuthoringContextService } from './thermostat-authoring-context.service';
import { ThermostatSafetyCatalog } from './thermostat-safety-catalog.service';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';

jest.setTimeout(30000);
describe('read-only thermostat member authoring catalog', () => {
	let directory: string, database: SqliteDataSource, context: ThermostatAuthoringContextService, current: boolean;
	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'thermostat-candidates-'));
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: join(directory, 'test.sqlite'),
			entities: [__dirname + '/../../../**/*.entity.ts'],
			synchronize: true,
		}).initialize();
		current = true;
		const platform = Object.assign(Object.create(ShellyNgDevicePlatform.prototype) as ShellyNgDevicePlatform, {
			captureThermostatSetupMetadata: () => ({
				device_hardware_id: 'offline-fixture',
				firmware: 'fixture',
				switch_configuration_json: '{"id":0}',
				isCurrent: () => current,
			}),
		});
		context = new ThermostatAuthoringContextService(
			database,
			new DeviceStructureLockService(),
			new VirtualDependencyGraphService(database),
			createShellyThermostatSafetyCatalog({ get: () => platform } as unknown as PlatformRegistryService),
		);
	});
	afterEach(async () => {
		if (database?.isInitialized) await database.destroy();
		await rm(directory, { recursive: true, force: true });
	});
	const relay = async (mac: string) => {
		const device = uuid(),
			channel = uuid(),
			property = uuid();
		await database.manager.insert(ShellyNgDeviceEntity, {
			id: device,
			identifier: `fixture-${mac}`,
			name: mac,
			enabled: true,
			canonicalMac: mac,
			category: DeviceCategory.SWITCHER,
		});
		await database.manager.insert(ShellyNgChannelEntity, {
			id: channel,
			device,
			name: 'Switch',
			identifier: 'switch:0',
			category: ChannelCategory.SWITCHER,
		} as never);
		await database.manager.insert(ShellyNgChannelPropertyEntity, {
			id: property,
			channel,
			identifier: 'output',
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		} as never);
		return property;
	};
	it('offers supervised control for a write-only Shelly leaf without advertising the readback-dependent safety profiles', async () => {
		const actuator = await relay('A8032ABE5084');
		await database.manager.update(ShellyNgChannelPropertyEntity, actuator, {
			permissions: [PermissionType.WRITE_ONLY],
		});
		const result = await context.read(actuator);
		expect(result.reasons).toEqual([]);
		expect(result.safety_extensions).toEqual([]);
	});
	it('offers a Zigbee2MQTT floor probe to a Modbus output with no device-side guard or declared range', async () => {
		const store = database.manager;
		const makeDevice = async (ctor: typeof DeviceEntity, category: DeviceCategory) => {
			const id = uuid();
			await store.insert(ctor, { id, identifier: id, name: id, category, enabled: true });
			return id;
		};
		const makeChannel = async (ctor: typeof ChannelEntity, device: string, category: ChannelCategory) => {
			const id = uuid();
			await store.insert(ctor, { id, device, identifier: id, name: id, category });
			return id;
		};
		const makeProperty = async (
			ctor: typeof ChannelPropertyEntity,
			channel: string,
			category: PropertyCategory,
			dataType: DataTypeType,
			permission: PermissionType,
		) => {
			const id = uuid();
			await store.insert(ctor, { id, channel, identifier: category, category, dataType, permissions: [permission] });
			return id;
		};
		const relay = await makeDevice(ModbusDeviceEntity, DeviceCategory.SWITCHER);
		const relayChannel = await makeChannel(ModbusChannelEntity, relay, ChannelCategory.SWITCHER);
		const output = await makeProperty(
			ModbusChannelPropertyEntity,
			relayChannel,
			PropertyCategory.ON,
			DataTypeType.BOOL,
			PermissionType.READ_WRITE,
		);
		const sensor = await makeDevice(Zigbee2mqttDeviceEntity, DeviceCategory.SENSOR);
		const probeChannel = await makeChannel(Zigbee2mqttChannelEntity, sensor, ChannelCategory.TEMPERATURE);
		const probe = await makeProperty(
			Zigbee2mqttChannelPropertyEntity,
			probeChannel,
			PropertyCategory.TEMPERATURE,
			DataTypeType.FLOAT,
			PermissionType.READ_ONLY,
		);
		const result = await context.read(output);
		expect(result.reasons).toEqual([]);
		expect(result.safety_extensions).toEqual([]);
		expect(result.candidates.map(({ property }) => property)).toEqual([probe]);
		const source = await new ThermostatSafetyCatalog().resolveSource(
			store,
			probe,
			Object.assign(new VirtualThermostatActuatorClaimEntity(), {
				providerProfile: SUPERVISED_SWITCH_PROFILE,
				sourceDeviceId: relay,
			}),
		);
		expect(source).toMatchObject({ leaf: { id: probe }, domain: null, fingerprint: result.candidates[0].fingerprint });
	});
	it('offers only actual qualified same-Shelly native and single-physical converted sources with read-only calibration', async () => {
		const first = await relay('A8032ABE5084'),
			second = await relay('A8032ABE5099');
		const native = await createProtectionProbe(database, first),
			converter = await createProtectionProbe(database, first, true),
			foreign = await createProtectionProbe(database, second);
		const result = await context.read(first);
		expect(result.candidates.map((entry) => entry.property).sort()).toEqual(
			[native.sourceId, converter.sourceId, foreign.sourceId].sort(),
		);
		const guarded = result.safety_extensions.find((offer) => offer.id === SHELLY_GUARDED_PROFILE);
		expect(guarded.candidates.map((entry) => entry.property).sort()).toEqual(
			[native.sourceId, converter.sourceId].sort(),
		);
		expect(guarded.candidates.find((entry) => entry.property === converter.sourceId)).toMatchObject({
			physical_property: converter.physicalId,
			snapshot: { calibration: { operator: 'steinhart_hart' } },
		});
		expect(result).toMatchObject({ device_hardware_id: 'offline-fixture', switch_configuration_json: '{"id":0}' });
		expect(result).not.toHaveProperty('ready');
		current = false;
		const gap = await context.read(first);
		expect(gap.switch_configuration_json).toBeNull();
		expect(gap.reasons).toEqual([]);
		expect(gap.safety_extensions.find((offer) => offer.id === SHELLY_GUARDED_PROFILE).reasons).toContain(
			'current_switch_catalog_unavailable',
		);
	});
	it('preserves an eligible historical source without inventing its missing installation snapshot', async () => {
		const actuator = await relay('A8032ABE5084');
		const native = await createProtectionProbe(database, actuator),
			converter = await createProtectionProbe(database, actuator, true);
		const original = await database.manager.findOneByOrFail(ShellySampleSourceEntity, {
			propertyId: native.physicalId,
		});
		await database.manager.update(
			ShellySampleSourceEntity,
			{ propertyId: native.physicalId },
			{ installationSnapshot: null },
		);
		const incomplete = (await context.read(actuator)).safety_extensions.find(
			(offer) => offer.id === SHELLY_GUARDED_PROFILE,
		);
		expect(incomplete.candidates.find((source) => source.property === native.sourceId)?.snapshot).toBeNull();
		expect(incomplete.candidates.find((source) => source.property === converter.sourceId)?.snapshot).toMatchObject({
			calibration: { operator: 'steinhart_hart' },
		});
		expect(incomplete.reasons).toEqual([]);
		await database.manager.update(
			ShellySampleSourceEntity,
			{ propertyId: native.physicalId },
			{ installationSnapshot: original.installationSnapshot },
		);
		expect(
			(await context.read(actuator)).safety_extensions
				.find((offer) => offer.id === SHELLY_GUARDED_PROFILE)
				.candidates.find((source) => source.property === native.sourceId)?.snapshot,
		).not.toBeNull();
	});
	it('withdraws a replaced source contract and never manufactures a positive reading from catalog metadata', async () => {
		const actuator = await relay('A8032ABE5084');
		const probe = await createProtectionProbe(database, actuator);
		await database.manager.update(
			ShellySampleSourceEntity,
			{ propertyId: probe.physicalId },
			{ fingerprint: 'replaced' },
		);
		const result = await context.read(actuator);
		expect(result.candidates).toHaveLength(1);
		const guard = result.safety_extensions.find((offer) => offer.id === SHELLY_GUARDED_PROFILE);
		expect(guard.candidates).toEqual([]);
		expect(guard.reasons).toContain('no_qualified_local_protective_source');
		expect(result).not.toHaveProperty('temperature');
	});
});
