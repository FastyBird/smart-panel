import { DataSource } from 'typeorm';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';

import { HomeyChannelPropertyEntity } from './devices-homey.entity';

describe('the Homey capability identity constraint under synchronize', () => {
	let dataSource: DataSource;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [__dirname + '/../../../**/*.entity.ts'],
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
	});

	afterAll(async () => {
		await dataSource.destroy();
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
