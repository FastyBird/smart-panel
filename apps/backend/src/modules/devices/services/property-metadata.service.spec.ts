import { DataSource, InsertEvent } from 'typeorm';

import { ConfigService } from '@nestjs/config';

import { PermissionType } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';

import { PropertyMetadataService } from './property-metadata.service';

describe('PropertyMetadataService', () => {
	let service: PropertyMetadataService;
	let getMany: jest.Mock;
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
		const builder = {
			innerJoinAndSelect: jest.fn().mockReturnThis(),
			callListeners: jest.fn().mockReturnThis(),
			getMany,
		};
		dataSource = {
			subscribers: [],
			getRepository: () => ({ createQueryBuilder: () => builder }),
		} as unknown as DataSource;
		service = new PropertyMetadataService(dataSource, new ConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: false }));
	});

	afterEach(() => service.onModuleDestroy());

	it('coalesces parallel initial loads and keeps caller mutations out of the catalog', async () => {
		const [first, second] = await Promise.all([service.findOne('property'), service.findOne('property')]);
		expect(getMany).toHaveBeenCalledTimes(1);
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
		expect(await service.findOne('missing')).toBeNull();
		expect(getMany).toHaveBeenCalledTimes(1);
	});

	it('does not install a stale in-flight snapshot after a structural change', async () => {
		let finish!: (properties: ChannelPropertyEntity[]) => void;
		getMany.mockImplementationOnce(
			() =>
				new Promise<ChannelPropertyEntity[]>((resolve) => {
					finish = resolve;
				}),
		);
		const pending = service.findOne('property');
		service.afterInsert({
			metadata: { inheritanceTree: [ChannelPropertyEntity] },
			queryRunner: { isTransactionActive: false },
		} as unknown as InsertEvent<ChannelPropertyEntity>);
		getMany.mockResolvedValue([Object.assign(new ChannelPropertyEntity(), property, { name: 'Current' })]);
		finish([property]);
		expect((await pending)?.name).toBe('Current');
		expect((await service.findOne('property'))?.name).toBe('Current');
		expect(getMany).toHaveBeenCalledTimes(2);
	});

	it('retries a failed load without caching a missing catalog', async () => {
		getMany.mockRejectedValueOnce(new Error('database temporarily unavailable'));
		await expect(service.findOne('property')).rejects.toThrow('database temporarily unavailable');
		expect((await service.findOne('property'))?.name).toBe('Original');
		expect(getMany).toHaveBeenCalledTimes(2);
	});

	it('unregisters only its own subscriber', () => {
		const unrelated = {};
		dataSource.subscribers.push(unrelated);
		service.onModuleDestroy();
		expect(dataSource.subscribers).toEqual([unrelated]);
	});
});
