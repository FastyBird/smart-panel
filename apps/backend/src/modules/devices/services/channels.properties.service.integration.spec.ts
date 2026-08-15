import { DataSource, EntitySchema, EntitySubscriberInterface, LoadEvent } from 'typeorm';

import { ChannelCategory, DataTypeType, PropertyCategory } from '../devices.constants';

import { ChannelsPropertiesService } from './channels.properties.service';

interface TestDeviceRow {
	id: string;
	name: string;
	enabled: boolean;
	hidden: boolean;
	roomId: string | null;
}

interface TestChannelRow {
	id: string;
	name: string;
	category: string;
	device: TestDeviceRow;
}

interface TestPropertyRow {
	id: string;
	name: string | null;
	identifier: string | null;
	category: string;
	dataType: string;
	permissions: string[];
	channel: TestChannelRow;
}

interface TestDeviceZoneRow {
	deviceId: string;
	zoneId: string;
	device: TestDeviceRow;
}

interface TestSpaceRow {
	id: string;
	name: string;
	parentId: string | null;
}

const deviceSchema = new EntitySchema<TestDeviceRow>({
	name: 'CurrentStateTestDevice',
	tableName: 'devices_module_devices',
	columns: {
		id: { type: String, primary: true },
		name: { type: String },
		enabled: { type: Boolean },
		hidden: { type: Boolean },
		roomId: { type: String, nullable: true },
	},
	relations: {
		deviceZones: {
			type: 'one-to-many',
			target: 'CurrentStateTestDeviceZone',
			inverseSide: 'device',
		},
	} as never,
});

const channelSchema = new EntitySchema<TestChannelRow>({
	name: 'CurrentStateTestChannel',
	tableName: 'devices_module_channels',
	columns: {
		id: { type: String, primary: true },
		name: { type: String },
		category: { type: String },
	},
	relations: {
		device: {
			type: 'many-to-one',
			target: 'CurrentStateTestDevice',
			joinColumn: { name: 'deviceId' },
		},
	},
});

const propertySchema = new EntitySchema<TestPropertyRow>({
	name: 'CurrentStateTestProperty',
	tableName: 'devices_module_channels_properties',
	columns: {
		id: { type: String, primary: true },
		name: { type: String, nullable: true },
		identifier: { type: String, nullable: true },
		category: { type: String },
		dataType: { type: String },
		permissions: { type: 'simple-array' },
	},
	relations: {
		channel: {
			type: 'many-to-one',
			target: 'CurrentStateTestChannel',
			joinColumn: { name: 'channelId' },
		},
	},
});

const deviceZoneSchema = new EntitySchema<TestDeviceZoneRow>({
	name: 'CurrentStateTestDeviceZone',
	tableName: 'devices_module_devices_zones',
	columns: {
		deviceId: { type: String, primary: true },
		zoneId: { type: String, primary: true },
	},
	relations: {
		device: {
			type: 'many-to-one',
			target: 'CurrentStateTestDevice',
			joinColumn: { name: 'deviceId' },
		},
	},
});

const spaceSchema = new EntitySchema<TestSpaceRow>({
	name: 'CurrentStateTestSpace',
	tableName: 'spaces_module_spaces',
	columns: {
		id: { type: String, primary: true },
		name: { type: String },
		parentId: { type: String, nullable: true },
	},
});

const valueStorageReadProbe = jest.fn();

class PropertyValueLoadProbeSubscriber implements EntitySubscriberInterface<Record<string, unknown>> {
	afterLoad(_entity: Record<string, unknown>, event?: LoadEvent<Record<string, unknown>>): void {
		if (event?.metadata.tableName === 'devices_module_channels_properties') {
			valueStorageReadProbe();
		}
	}
}

describe('ChannelsPropertiesService.findVisibleReadableStateCandidates SQLite integration', () => {
	let dataSource: DataSource;
	let service: ChannelsPropertiesService;

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [deviceSchema, channelSchema, propertySchema, deviceZoneSchema, spaceSchema],
			synchronize: true,
		});
		await dataSource.initialize();
		dataSource.subscribers.push(new PropertyValueLoadProbeSubscriber());

		service = Object.create(ChannelsPropertiesService.prototype) as ChannelsPropertiesService;
		Object.defineProperty(service, 'repository', {
			value: dataSource.getRepository<TestPropertyRow>('CurrentStateTestProperty'),
		});

		await seedCatalog();
		valueStorageReadProbe.mockClear();
	});

	afterEach(async () => {
		await dataSource.destroy();
	});

	async function seedCatalog(): Promise<void> {
		await dataSource.query(
			`INSERT INTO spaces_module_spaces (id, name, "parentId") VALUES
			 ('floor-a', 'First floor', NULL),
			 ('room-a', 'Living room', 'floor-a'),
			 ('room-b', 'Kitchen', 'floor-a'),
			 ('room-c', 'Garage', NULL)`,
		);
		await dataSource.query(
			`INSERT INTO devices_module_devices (id, name, enabled, hidden, "roomId") VALUES
			 ('device-disabled', 'Alpha disabled', 0, 0, 'room-a'),
			 ('device-visible', 'Beta visible', 1, 0, 'room-b'),
			 ('device-hidden', 'Gamma hidden', 1, 1, 'room-a'),
			 ('device-garage', 'Delta garage', 1, 0, 'room-c')`,
		);
		await dataSource.query(
			`INSERT INTO devices_module_devices_zones ("deviceId", "zoneId") VALUES
			 ('device-disabled', 'zone-a'),
			 ('device-garage', 'zone-a')`,
		);
		await dataSource.query(
			`INSERT INTO devices_module_channels (id, name, category, "deviceId") VALUES
			 ('channel-disabled-temp', 'Temperature', 'temperature', 'device-disabled'),
			 ('channel-disabled-humidity', 'Humidity', 'humidity', 'device-disabled'),
			 ('channel-visible-temp', 'Temperature', 'temperature', 'device-visible'),
			 ('channel-hidden-temp', 'Temperature', 'temperature', 'device-hidden'),
			 ('channel-garage-temp', 'Temperature', 'temperature', 'device-garage')`,
		);
		await dataSource.query(
			`INSERT INTO devices_module_channels_properties
			 (id, name, identifier, category, "dataType", permissions, "channelId") VALUES
			 ('disabled-ro', 'Air temperature', 'disabled-ro', 'generic', 'float', 'ro', 'channel-disabled-temp'),
			 ('disabled-rw', 'Target temperature', 'disabled-rw', 'target_temperature', 'float', 'rw',
			  'channel-disabled-temp'),
			 ('disabled-wo', 'Write only', 'disabled-wo', 'generic', 'float', 'wo', 'channel-disabled-temp'),
			 ('disabled-ev', 'Event only', 'disabled-ev', 'generic', 'bool', 'ev', 'channel-disabled-temp'),
			 ('disabled-humidity', 'Humidity', 'disabled-humidity', 'generic', 'float', 'ro',
			  'channel-disabled-humidity'),
			 ('visible-ro', 'Kitchen temperature', 'visible-ro', 'generic', 'float', 'ro', 'channel-visible-temp'),
			 ('hidden-ro', 'Hidden temperature', 'hidden-ro', 'generic', 'float', 'ro', 'channel-hidden-temp'),
			 ('garage-ro', 'Garage temperature', 'garage-ro', 'generic', 'int', 'ro', 'channel-garage-temp')`,
		);
	}

	it('enforces readable visibility while retaining disabled owners and exact bounded ordering totals', async () => {
		await dataSource.getRepository<TestPropertyRow>('CurrentStateTestProperty').findOneByOrFail({ id: 'disabled-ro' });
		expect(valueStorageReadProbe).toHaveBeenCalledTimes(1);
		valueStorageReadProbe.mockClear();

		const full = await service.findVisibleReadableStateCandidates({ limit: 500 });

		expect(full.properties.map((property) => property.id)).toEqual([
			'disabled-humidity',
			'disabled-ro',
			'disabled-rw',
			'visible-ro',
			'garage-ro',
		]);
		expect(full.total).toBe(5);
		expect(full.properties[0].channel).toMatchObject({
			id: 'channel-disabled-humidity',
			device: { id: 'device-disabled', enabled: false, hidden: false },
		});
		expect(full.properties.map((property) => property.id)).not.toEqual(
			expect.arrayContaining(['disabled-wo', 'disabled-ev', 'hidden-ro']),
		);

		const bounded = await service.findVisibleReadableStateCandidates({ limit: 2 });

		expect(bounded.properties.map((property) => property.id)).toEqual(['disabled-humidity', 'disabled-ro']);
		expect(bounded.total).toBe(5);
		expect(valueStorageReadProbe).not.toHaveBeenCalled();
	});

	it('applies room, zone, and floor-parent scopes in SQLite before returning candidates', async () => {
		const room = await service.findVisibleReadableStateCandidates({ limit: 500, scope: { roomIds: ['room-b'] } });
		const zone = await service.findVisibleReadableStateCandidates({ limit: 500, scope: { zoneId: 'zone-a' } });
		const floor = await service.findVisibleReadableStateCandidates({ limit: 500, roomParentId: 'floor-a' });

		expect(room.properties.map((property) => property.id)).toEqual(['visible-ro']);
		expect(room.total).toBe(1);
		expect(zone.properties.map((property) => property.id)).toEqual([
			'disabled-humidity',
			'disabled-ro',
			'disabled-rw',
			'garage-ro',
		]);
		expect(zone.total).toBe(4);
		expect(floor.properties.map((property) => property.id)).toEqual([
			'disabled-humidity',
			'disabled-ro',
			'disabled-rw',
			'visible-ro',
		]);
		expect(floor.total).toBe(4);
		expect(valueStorageReadProbe).not.toHaveBeenCalled();
	});

	it('combines channel, property, and data-type filters in the database', async () => {
		const result = await service.findVisibleReadableStateCandidates({
			limit: 500,
			channelCategories: [ChannelCategory.TEMPERATURE],
			propertyCategories: [PropertyCategory.GENERIC],
			dataTypes: [DataTypeType.FLOAT],
		});

		expect(result.properties.map((property) => property.id)).toEqual(['disabled-ro', 'visible-ro']);
		expect(result.total).toBe(2);
		expect(valueStorageReadProbe).not.toHaveBeenCalled();
	});
});
