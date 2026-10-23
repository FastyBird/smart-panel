import { DataSource } from 'typeorm';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DeviceZoneEntity } from '../../../modules/devices/entities/device-zone.entity';
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from '../../../modules/devices/entities/devices.entity';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';

import { HomeyChannelEntity, HomeyChannelPropertyEntity, HomeyDeviceEntity } from './devices-homey.entity';

describe('the Homey capability identity constraint under synchronize', () => {
	let dataSource: DataSource;
	let setup: Promise<void> | undefined;

	const initializeFixture = async (): Promise<void> => {
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			// Homey STI roots/subclasses and their complete relation targets; no unrelated plugin schema.
			entities: [
				DeviceEntity,
				DeviceControlEntity,
				ChannelEntity,
				ChannelControlEntity,
				ChannelPropertyEntity,
				DeviceZoneEntity,
				SpaceEntity,
				HomeyDeviceEntity,
				HomeyChannelEntity,
				HomeyChannelPropertyEntity,
			],
			synchronize: true,
		});
		await dataSource.initialize();
		await dataSource.getRepository(DeviceEntity).insert({
			id: 'device',
			name: 'Homey device',
			category: DeviceCategory.GENERIC,
		});
		await dataSource.getRepository(ChannelEntity).insert({
			id: 'channel',
			name: 'Light',
			category: ChannelCategory.LIGHT,
			device: 'device',
		});
	};

	beforeAll(() => {
		setup = initializeFixture();
		return setup;
	});

	afterAll(async () => {
		// A failed/timed-out hook may still own initialization or seeding. Join it before closing.
		await setup?.catch(() => undefined);
		if (dataSource?.isInitialized) await dataSource.destroy();
	});

	const property = async (id: string, identifier: string): Promise<void> => {
		await dataSource.getRepository(HomeyChannelPropertyEntity).insert({
			id,
			identifier,
			category: PropertyCategory.ON,
			permissions: [PermissionType.READ_WRITE],
			dataType: DataTypeType.BOOL,
			channel: 'channel',
			homeyCapabilityId: 'onoff',
			homeyMappingName: 'light-power',
		});
	};

	it('creates the partial identity index from entity metadata', async () => {
		const indexes: Array<{ name: string; sql: string }> = await dataSource.query(
			`SELECT "name", "sql" FROM sqlite_master WHERE "type" = 'index' ` +
				`AND "tbl_name" = 'devices_module_channels_properties'`,
		);
		const index = indexes.find(({ name }) => name === 'UQ_homey_capability_mapping_channel');

		expect(index?.sql).toContain(`WHERE "type" = 'devices-homey'`);
		expect(index?.sql).toContain(`"homeyCapabilityId" IS NOT NULL`);
		expect(index?.sql).toContain(`"homeyMappingName" IS NOT NULL`);
	});

	it('rejects a duplicate capability and mapping in one channel despite different identifiers', async () => {
		await property('first-property', 'onoff::light-power');

		await expect(property('duplicate-property', 'different-identifier')).rejects.toThrow(/UNIQUE constraint failed/);
	});
});
