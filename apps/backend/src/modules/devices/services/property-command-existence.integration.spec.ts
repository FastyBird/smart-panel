import { useContainer, validate } from 'class-validator';
import { DataSource, EntitySubscriberInterface } from 'typeorm';

import { ConfigService } from '@nestjs/config';

import { toInstance } from '../../../common/utils/transform.utils';
import {
	SimulatorChannelEntity,
	SimulatorChannelPropertyEntity,
	SimulatorDeviceEntity,
} from '../../../plugins/simulator/entities/simulator.entity';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { ChannelCategory, DataTypeType, DeviceCategory, PermissionType, PropertyCategory } from '../devices.constants';
import { PropertyCommandDto } from '../dto/property-command.dto';
import { DeviceZoneEntity } from '../entities/device-zone.entity';
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from '../entities/devices.entity';
import { PropertyCommandTargetConstraintValidator } from '../validators/property-command-target-constraint.validator';

import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { DevicesService } from './devices.service';
import { PropertyMetadataService } from './property-metadata.service';

const ids = {
	device: '550e8400-e29b-41d4-a716-446655440001',
	channel: '550e8400-e29b-41d4-a716-446655440002',
	property: '550e8400-e29b-41d4-a716-446655440003',
	otherDevice: '550e8400-e29b-41d4-a716-446655440004',
	otherChannel: '550e8400-e29b-41d4-a716-446655440005',
	missing: '550e8400-e29b-41d4-a716-446655440006',
};

/** Existence validation must not invoke subscribers that load status and property values. */
class LoadProbe implements EntitySubscriberInterface {
	afterLoad = jest.fn();
}

const withRepository = <T extends object>(prototype: T, repository: object): T => {
	const service = Object.create(prototype) as T;
	Object.defineProperty(service, 'repository', { value: repository });
	return service;
};

describe.each([false, true])('Property command target validation with SQLite (shared writers: %s)', (locksEnabled) => {
	let dataSource: DataSource;
	let devices: DevicesService;
	let channels: ChannelsService;
	let properties: ChannelsPropertiesService;
	let probe: LoadProbe;
	let metadata: PropertyMetadataService;

	beforeEach(async () => {
		dataSource = await new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [
				DeviceEntity,
				ChannelEntity,
				ChannelPropertyEntity,
				DeviceControlEntity,
				ChannelControlEntity,
				DeviceZoneEntity,
				SpaceEntity,
				SimulatorDeviceEntity,
				SimulatorChannelEntity,
				SimulatorChannelPropertyEntity,
			],
			synchronize: true,
		}).initialize();
		probe = new LoadProbe();
		dataSource.subscribers.push(probe);
		devices = withRepository(DevicesService.prototype, dataSource.getRepository(DeviceEntity));
		channels = withRepository(ChannelsService.prototype, dataSource.getRepository(ChannelEntity));
		properties = withRepository(ChannelsPropertiesService.prototype, dataSource.getRepository(ChannelPropertyEntity));
		await dataSource.getRepository(SimulatorDeviceEntity).save(
			[ids.device, ids.otherDevice].map((id) => ({
				id,
				name: id,
				category: DeviceCategory.GENERIC,
			})),
		);
		await dataSource.getRepository(SimulatorChannelEntity).save([
			{ id: ids.channel, name: 'Channel', category: ChannelCategory.GENERIC, device: { id: ids.device } },
			{ id: ids.otherChannel, name: 'Other', category: ChannelCategory.GENERIC, device: { id: ids.otherDevice } },
		]);
		await dataSource.getRepository(SimulatorChannelPropertyEntity).save({
			id: ids.property,
			channel: { id: ids.channel },
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		});
		metadata = new PropertyMetadataService(
			dataSource,
			new ConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: locksEnabled }),
		);
		await metadata.onModuleInit();
		probe.afterLoad.mockClear();

		const validators = new Map<unknown, unknown>([
			[PropertyCommandTargetConstraintValidator, new PropertyCommandTargetConstraintValidator(metadata)],
		]);
		useContainer({ get: <T>(type: new () => T): T => (validators.get(type) ?? new type()) as T });
	});

	afterEach(async () => {
		useContainer({ get: <T>(type: new () => T): T => new type() });
		metadata?.onModuleDestroy();
		await dataSource.destroy();
	});

	const validateCommand = (overrides: Partial<Record<'device' | 'channel' | 'property', unknown>> = {}) =>
		validate(
			toInstance(PropertyCommandDto, {
				request_id: ids.missing,
				properties: [{ device: ids.device, channel: ids.channel, property: ids.property, value: true, ...overrides }],
			}),
			{ whitelist: true, forbidNonWhitelisted: true },
		);

	it('validates a warm command target without ORM or SQL in single-process mode', async () => {
		const query = jest.spyOn(dataSource.createQueryRunner(), 'query');
		const repository = jest.spyOn(dataSource, 'getRepository');
		await expect(validateCommand()).resolves.toEqual([]);
		expect(query).toHaveBeenCalledTimes(locksEnabled ? 1 : 0);
		expect(repository).toHaveBeenCalledTimes(locksEnabled ? 1 : 0);
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

	it.each(['device', 'channel', 'property'] as const)('rejects malformed %s without a catalog query', async (field) => {
		const query = jest.spyOn(dataSource.createQueryRunner(), 'query');
		for (const invalid of [undefined, null, 42, [], {}, '', 'not-a-uuid']) {
			expect(await validateCommand({ [field]: invalid })).not.toHaveLength(0);
		}
		expect(query).not.toHaveBeenCalled();
	});

	it.each(['property', 'channel'] as const)('rejects the old chain after reparenting its %s', async (field) => {
		await expect(validateCommand()).resolves.toEqual([]);
		if (field === 'property') {
			await dataSource
				.getRepository(SimulatorChannelPropertyEntity)
				.update(ids.property, { channel: { id: ids.otherChannel } });
		} else {
			await dataSource.getRepository(SimulatorChannelEntity).update(ids.channel, { device: { id: ids.otherDevice } });
		}
		expect(await validateCommand()).not.toHaveLength(0);
		await expect(
			validateCommand({ device: ids.otherDevice, channel: field === 'property' ? ids.otherChannel : ids.channel }),
		).resolves.toEqual([]);
	});

	it('discards uncommitted target changes after an inner commit followed by outer rollback', async () => {
		await expect(validateCommand()).resolves.toEqual([]);
		const runner = dataSource.createQueryRunner();
		await runner.startTransaction();
		try {
			await runner.startTransaction();
			await runner.manager
				.getRepository(SimulatorChannelPropertyEntity)
				.update(ids.property, { channel: { id: ids.otherChannel } });
			await runner.commitTransaction();
			await expect(validateCommand({ device: ids.otherDevice, channel: ids.otherChannel })).resolves.toEqual([]);
		} finally {
			await runner.rollbackTransaction();
			await runner.release();
		}
		await expect(validateCommand()).resolves.toEqual([]);
		expect(await validateCommand({ device: ids.otherDevice, channel: ids.otherChannel })).not.toHaveLength(0);
	});

	if (locksEnabled) {
		it('sees independent metadata writes that bypass local invalidation in shared-writer mode', async () => {
			await expect(validateCommand()).resolves.toEqual([]);
			await dataSource
				.getRepository(SimulatorChannelPropertyEntity)
				.createQueryBuilder()
				.update()
				.set({ channel: { id: ids.otherChannel } })
				.where('id = :id', { id: ids.property })
				.callListeners(false)
				.execute();
			expect(await validateCommand()).not.toHaveLength(0);
			await expect(validateCommand({ device: ids.otherDevice, channel: ids.otherChannel })).resolves.toEqual([]);
		});
	}

	it('supports existence-only checks and observes deletion without caching a positive result', async () => {
		await expect(channels.exists(ids.channel)).resolves.toBe(true);
		await expect(properties.exists(ids.property)).resolves.toBe(true);
		await dataSource.getRepository(SimulatorChannelPropertyEntity).delete(ids.property);
		await expect(properties.exists(ids.property)).resolves.toBe(false);
		await expect(validateCommand()).resolves.not.toHaveLength(0);
	});

	it('rejects orphan rows even when the parent ID remains in the foreign key column', async () => {
		await dataSource.query('PRAGMA foreign_keys = OFF');
		await dataSource.getRepository(SimulatorDeviceEntity).delete(ids.device);
		await expect(devices.exists(ids.device)).resolves.toBe(false);
		await expect(validateCommand()).resolves.not.toHaveLength(0);
		await expect(channels.exists(ids.channel)).resolves.toBe(false);
		await expect(channels.exists(ids.channel, ids.device)).resolves.toBe(false);
		await expect(properties.exists(ids.property, ids.channel)).resolves.toBe(false);
		await dataSource.getRepository(SimulatorChannelEntity).delete(ids.channel);
		await expect(properties.exists(ids.property)).resolves.toBe(false);
		await expect(validateCommand()).resolves.not.toHaveLength(0);
		expect(probe.afterLoad).not.toHaveBeenCalled();
	});
});
