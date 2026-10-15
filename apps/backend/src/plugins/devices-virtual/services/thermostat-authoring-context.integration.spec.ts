import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuid } from 'uuid';

import { createProtectionProbe } from '../../../../test/support/thermostat-protection-fixture';
import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ShellySampleSourceEntity } from '../../devices-shelly-ng/entities/shelly-sample-source.entity';
import { ShellyNgDevicePlatform } from '../../devices-shelly-ng/platforms/shelly-ng.device.platform';

import { ThermostatAuthoringContextService } from './thermostat-authoring-context.service';
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
			{ get: () => platform } as unknown as PlatformRegistryService,
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
	it('offers only actual qualified same-Shelly native and single-physical converted sources with read-only calibration', async () => {
		const first = await relay('A8032ABE5084'),
			second = await relay('A8032ABE5099');
		const native = await createProtectionProbe(database, first),
			converter = await createProtectionProbe(database, first, true),
			foreign = await createProtectionProbe(database, second);
		const result = await context.read(first);
		expect(result.candidates.map((entry) => entry.property).sort()).toEqual(
			[native.sourceId, converter.sourceId].sort(),
		);
		expect(result.candidates.some((entry) => entry.property === foreign.sourceId)).toBe(false);
		expect(result.candidates.find((entry) => entry.property === converter.sourceId)).toMatchObject({
			physical_property: converter.physicalId,
			snapshot: { calibration: { operator: 'steinhart_hart' } },
		});
		expect(result).toMatchObject({ device_hardware_id: 'offline-fixture', switch_configuration_json: '{"id":0}' });
		expect(result).not.toHaveProperty('ready');
		current = false;
		const gap = await context.read(first);
		expect(gap.switch_configuration_json).toBeNull();
		expect(gap.reasons).toContain('current_switch_catalog_unavailable');
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
		expect(result.candidates).toEqual([]);
		expect(result.reasons).toContain('no_qualified_local_protective_source');
		expect(result).not.toHaveProperty('temperature');
	});
});
