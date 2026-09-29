import { useContainer, validate } from 'class-validator';
import { DataSource, EntitySchema, EntitySubscriberInterface } from 'typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { PropertyCommandDto } from '../dto/property-command.dto';
import { ChannelExistsConstraintValidator } from '../validators/channel-exists-constraint.validator';
import { ChannelPropertyExistsConstraintValidator } from '../validators/channel-property-exists-constraint.validator';
import { DeviceExistsConstraintValidator } from '../validators/device-exists-constraint.validator';

import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { DevicesService } from './devices.service';

const ids = {
	device: '550e8400-e29b-41d4-a716-446655440001',
	channel: '550e8400-e29b-41d4-a716-446655440002',
	property: '550e8400-e29b-41d4-a716-446655440003',
	otherDevice: '550e8400-e29b-41d4-a716-446655440004',
	otherChannel: '550e8400-e29b-41d4-a716-446655440005',
	missing: '550e8400-e29b-41d4-a716-446655440006',
};

const deviceSchema = new EntitySchema({ name: 'ExistenceDevice', columns: { id: { type: String, primary: true } } });
const channelSchema = new EntitySchema<{ id: string; device: { id: string } }>({
	name: 'ExistenceChannel',
	columns: { id: { type: String, primary: true } },
	relations: { device: { type: 'many-to-one', target: 'ExistenceDevice', joinColumn: true } },
});
const propertySchema = new EntitySchema<{ id: string; channel: { id: string } }>({
	name: 'ExistenceProperty',
	columns: { id: { type: String, primary: true } },
	relations: { channel: { type: 'many-to-one', target: 'ExistenceChannel', joinColumn: true } },
});

/** Existence validation must not invoke subscribers that load status and property values. */
class LoadProbe implements EntitySubscriberInterface {
	afterLoad = jest.fn();
}

const withRepository = <T extends object>(prototype: T, dataSource: DataSource, entity: EntitySchema): T => {
	const service = Object.create(prototype) as T;
	Object.defineProperty(service, 'repository', { value: dataSource.getRepository(entity) });
	return service;
};

describe('Property command existence validation with SQLite', () => {
	let dataSource: DataSource;
	let devices: DevicesService;
	let channels: ChannelsService;
	let properties: ChannelsPropertiesService;
	let probe: LoadProbe;

	beforeEach(async () => {
		dataSource = await new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [deviceSchema, channelSchema, propertySchema],
			synchronize: true,
		}).initialize();
		probe = new LoadProbe();
		dataSource.subscribers.push(probe);
		devices = withRepository(DevicesService.prototype, dataSource, deviceSchema);
		channels = withRepository(ChannelsService.prototype, dataSource, channelSchema);
		properties = withRepository(ChannelsPropertiesService.prototype, dataSource, propertySchema);
		await dataSource.getRepository(deviceSchema).insert([{ id: ids.device }, { id: ids.otherDevice }]);
		await dataSource.getRepository(channelSchema).insert([
			{ id: ids.channel, device: { id: ids.device } },
			{ id: ids.otherChannel, device: { id: ids.otherDevice } },
		]);
		await dataSource.getRepository(propertySchema).insert({ id: ids.property, channel: { id: ids.channel } });

		const validators = new Map<unknown, unknown>([
			[DeviceExistsConstraintValidator, new DeviceExistsConstraintValidator(devices)],
			[ChannelExistsConstraintValidator, new ChannelExistsConstraintValidator(channels)],
			[ChannelPropertyExistsConstraintValidator, new ChannelPropertyExistsConstraintValidator(properties)],
		]);
		useContainer({ get: <T>(type: new () => T): T => (validators.get(type) ?? new type()) as T });
	});

	afterEach(async () => {
		useContainer({ get: <T>(type: new () => T): T => new type() });
		await dataSource.destroy();
	});

	const validateCommand = (overrides: Partial<Pick<typeof ids, 'device' | 'channel' | 'property'>> = {}) =>
		validate(
			toInstance(PropertyCommandDto, {
				request_id: ids.missing,
				properties: [{ device: ids.device, channel: ids.channel, property: ids.property, value: true, ...overrides }],
			}),
			{ whitelist: true, forbidNonWhitelisted: true },
		);

	it('validates the real command DTO without hydrating entities or reading runtime values', async () => {
		await expect(validateCommand()).resolves.toEqual([]);
		expect(probe.afterLoad).not.toHaveBeenCalled();
	});

	it.each(['device', 'channel', 'property'] as const)('rejects a missing %s', async (field) => {
		expect(await validateCommand({ [field]: ids.missing })).not.toHaveLength(0);
		expect(probe.afterLoad).not.toHaveBeenCalled();
	});

	it('rejects existing IDs with mismatched device/channel or channel/property ownership', async () => {
		expect(await validateCommand({ device: ids.otherDevice })).not.toHaveLength(0);
		expect(await validateCommand({ device: ids.otherDevice, channel: ids.otherChannel })).not.toHaveLength(0);
		expect(probe.afterLoad).not.toHaveBeenCalled();
	});

	it('supports existence-only checks and observes deletion without caching a positive result', async () => {
		await expect(channels.exists(ids.channel)).resolves.toBe(true);
		await expect(properties.exists(ids.property)).resolves.toBe(true);
		await dataSource.getRepository(propertySchema).delete(ids.property);
		await expect(properties.exists(ids.property)).resolves.toBe(false);
		await expect(validateCommand()).resolves.not.toHaveLength(0);
	});

	it('rejects orphan rows even when the parent ID remains in the foreign key column', async () => {
		await dataSource.query('PRAGMA foreign_keys = OFF');
		await dataSource.getRepository(deviceSchema).delete(ids.device);
		await expect(devices.exists(ids.device)).resolves.toBe(false);
		await expect(channels.exists(ids.channel)).resolves.toBe(false);
		await expect(channels.exists(ids.channel, ids.device)).resolves.toBe(false);
		await expect(properties.exists(ids.property, ids.channel)).resolves.toBe(false);
		await dataSource.getRepository(channelSchema).delete(ids.channel);
		await expect(properties.exists(ids.property)).resolves.toBe(false);
		expect(probe.afterLoad).not.toHaveBeenCalled();
	});
});
