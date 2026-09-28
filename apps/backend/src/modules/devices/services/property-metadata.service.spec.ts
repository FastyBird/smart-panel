import { DataSource, InsertEvent, RemoveEvent, TransactionCommitEvent } from 'typeorm';

import { ConfigService } from '@nestjs/config';

import { PermissionType } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';

import { PropertyMetadataService } from './property-metadata.service';

describe('PropertyMetadataService', () => {
	let service: PropertyMetadataService;
	let getMany: jest.Mock;
	let getOne: jest.Mock;
	let where: jest.Mock;
	let dataSource: DataSource;
	let property: ChannelPropertyEntity;

	beforeEach(() => {
		property = Object.assign(new ChannelPropertyEntity(), {
			id: 'property',
			name: 'Original',
			permissions: [PermissionType.READ_WRITE],
			format: ['on', 'off'],
			channel: Object.assign(new ChannelEntity(), {
				id: 'channel',
				name: 'Channel',
				device: Object.assign(new DeviceEntity(), { id: 'device', name: 'Device' }),
			}),
		});
		getMany = jest.fn().mockResolvedValue([property]);
		getOne = jest.fn().mockResolvedValue(property);
		where = jest.fn().mockReturnThis();
		const builder = {
			innerJoinAndSelect: jest.fn().mockReturnThis(),
			callListeners: jest.fn().mockReturnThis(),
			getMany,
			getOne,
			where,
		};
		dataSource = {
			subscribers: [],
			getRepository: () => ({ createQueryBuilder: () => builder }),
		} as unknown as DataSource;
		service = new PropertyMetadataService(dataSource, new ConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: false }));
	});

	afterEach(() => service.onModuleDestroy());

	it('coalesces parallel row loads and keeps caller mutations out of the catalog', async () => {
		const [first, second] = await Promise.all([service.findOne('property'), service.findOne('property')]);
		expect(getOne).toHaveBeenCalledTimes(1);
		expect(where).toHaveBeenCalledWith('property.id = :id', { id: 'property' });
		expect(first).toBeInstanceOf(ChannelPropertyEntity);
		expect(first).not.toBe(second);
		if (!first || typeof first.channel === 'string' || typeof first.channel.device === 'string') {
			throw new Error('Missing fixture');
		}
		first.name = 'Mutated';
		first.permissions.length = 0;
		first.format?.pop();
		first.channel.name = 'Mutated channel';
		first.channel.device.name = 'Mutated device';
		expect(await service.findOne('property')).toMatchObject({
			name: 'Original',
			permissions: [PermissionType.READ_WRITE],
			format: ['on', 'off'],
			channel: { name: 'Channel', device: { name: 'Device' } },
		});
		getOne.mockResolvedValueOnce(null);
		expect(await service.findOne('missing')).toBeNull();
		expect(getOne).toHaveBeenCalledTimes(2);
		expect(getMany).not.toHaveBeenCalled();
	});

	it('does not install a stale in-flight row after a structural change', async () => {
		let finish!: (property: ChannelPropertyEntity) => void;
		getOne.mockImplementationOnce(
			() =>
				new Promise<ChannelPropertyEntity>((resolve) => {
					finish = resolve;
				}),
		);
		const pending = service.findOne('property');
		service.afterInsert({
			metadata: { inheritanceTree: [ChannelPropertyEntity] },
			queryRunner: { isTransactionActive: false },
		} as unknown as InsertEvent<ChannelPropertyEntity>);
		getOne.mockResolvedValue(Object.assign(new ChannelPropertyEntity(), property, { name: 'Current' }));
		finish(property);
		expect((await pending)?.name).toBe('Current');
		expect((await service.findOne('property'))?.name).toBe('Current');
		expect(getOne).toHaveBeenCalledTimes(2);
	});

	it('retries a failed load without caching a missing row', async () => {
		getOne.mockRejectedValueOnce(new Error('database temporarily unavailable'));
		await expect(service.findOne('property')).rejects.toThrow('database temporarily unavailable');
		expect((await service.findOne('property'))?.name).toBe('Original');
		expect(getOne).toHaveBeenCalledTimes(2);
	});

	it('unregisters only its own subscriber', () => {
		const unrelated = {};
		dataSource.subscribers.push(unrelated);
		service.onModuleDestroy();
		expect(dataSource.subscribers).toEqual([unrelated]);
	});
	it('preloads once, then refreshes only requested rows after invalidation', async () => {
		await service.onModuleInit();
		await service.findOne('property');
		expect(getOne).not.toHaveBeenCalled();
		service.afterInsert({
			metadata: { inheritanceTree: [ChannelPropertyEntity] },
			queryRunner: { isTransactionActive: false },
		} as unknown as InsertEvent<ChannelPropertyEntity>);
		await Promise.all([service.findOne('property'), service.findOne('property')]);
		expect(getOne).toHaveBeenCalledTimes(1);
		expect(getMany).toHaveBeenCalledTimes(1);
	});

	it('does not make an unrelated property wait for another row load', async () => {
		let finish!: (property: ChannelPropertyEntity) => void;
		getOne.mockImplementationOnce(() => new Promise<ChannelPropertyEntity>((resolve) => (finish = resolve)));
		const pending = service.findOne('blocked');
		expect((await service.findOne('property'))?.name).toBe('Original');
		finish(property);
		await pending;
	});

	it('discards a preload invalidated while its query was running', async () => {
		let finish!: (properties: ChannelPropertyEntity[]) => void;
		getMany.mockImplementationOnce(() => new Promise<ChannelPropertyEntity[]>((resolve) => (finish = resolve)));
		const preload = service.onModuleInit();
		service.afterInsert({
			metadata: { inheritanceTree: [ChannelPropertyEntity] },
			queryRunner: { isTransactionActive: false },
		} as unknown as InsertEvent<ChannelPropertyEntity>);
		getOne.mockResolvedValue(Object.assign(new ChannelPropertyEntity(), property, { name: 'Current' }));
		await service.findOne('property');
		finish([property]);
		await preload;
		expect((await service.findOne('property'))?.name).toBe('Current');
		expect(getMany).toHaveBeenCalledTimes(1);
	});

	it('can read individual rows when initial preload failed', async () => {
		getMany.mockRejectedValueOnce(new Error('schema not ready'));
		await service.onModuleInit();
		expect((await service.findOne('property'))?.name).toBe('Original');
	});

	it('keeps fresh single-row reads when shared-writer mode is enabled', async () => {
		service.onModuleDestroy();
		service = new PropertyMetadataService(dataSource, new ConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: true }));
		await service.onModuleInit();
		await service.findOne('property');
		await service.findOne('property');
		expect(getMany).not.toHaveBeenCalled();
		expect(getOne).toHaveBeenCalledTimes(2);
	});

	it.each(['afterTransactionCommit', 'afterTransactionRollback'] as const)(
		'invalidates transaction-time reads on %s',
		async (method) => {
			await service.findOne('property');
			const queryRunner = { isTransactionActive: true };
			service.afterInsert({
				metadata: { inheritanceTree: [ChannelPropertyEntity] },
				queryRunner,
			} as unknown as InsertEvent<ChannelPropertyEntity>);
			getOne.mockResolvedValue(Object.assign(new ChannelPropertyEntity(), property, { name: 'In transaction' }));
			await service.findOne('property');
			service[method]({ queryRunner } as unknown as TransactionCommitEvent);
			getOne.mockResolvedValue(Object.assign(new ChannelPropertyEntity(), property, { name: 'Settled' }));
			expect((await service.findOne('property'))?.name).toBe('Settled');
		},
	);

	it('does not let an obsolete failed load remove a newer request', async () => {
		let rejectOld!: (error: Error) => void;
		let finishCurrent!: (property: ChannelPropertyEntity) => void;
		getOne
			.mockImplementationOnce(() => new Promise<ChannelPropertyEntity>((_, reject) => (rejectOld = reject)))
			.mockImplementationOnce(() => new Promise<ChannelPropertyEntity>((resolve) => (finishCurrent = resolve)));
		const stale = service.findOne('property');
		const rejected = expect(stale).rejects.toThrow('old read failed');
		service.afterInsert({
			metadata: { inheritanceTree: [ChannelPropertyEntity] },
			queryRunner: { isTransactionActive: false },
		} as unknown as InsertEvent<ChannelPropertyEntity>);
		const current = service.findOne('property');
		rejectOld(new Error('old read failed'));
		await rejected;
		const coalesced = service.findOne('property');
		finishCurrent(property);
		await Promise.all([current, coalesced]);
		expect(getOne).toHaveBeenCalledTimes(2);
	});

	it('does not retain missing IDs or a property removed after preload', async () => {
		await service.onModuleInit();
		service.afterRemove({
			metadata: { inheritanceTree: [ChannelPropertyEntity] },
			queryRunner: { isTransactionActive: false },
		} as unknown as RemoveEvent<ChannelPropertyEntity>);
		getOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
		expect(await service.findOne('property')).toBeNull();
		expect(await service.findOne('missing')).toBeNull();
		expect((await service.findOne('property'))?.name).toBe('Original');
		expect(getOne).toHaveBeenCalledTimes(3);
	});
});
