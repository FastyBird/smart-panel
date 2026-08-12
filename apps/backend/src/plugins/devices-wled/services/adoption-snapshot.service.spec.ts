import { DataSource } from 'typeorm';

import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { WledChannelEntity, WledChannelPropertyEntity } from '../entities/devices-wled.entity';

import { WledAdoptionSnapshotService } from './adoption-snapshot.service';

describe('WledAdoptionSnapshotService', () => {
	it('restores captured latest values through the property value service', async () => {
		const channel = { id: 'channel-1', device: { id: 'device-1' } } as WledChannelEntity;
		const valuedProperty = {
			id: 'property-1',
			channel,
			value: { value: 'original' },
		} as WledChannelPropertyEntity;
		const emptyProperty = {
			id: 'property-2',
			channel,
			value: null,
		} as WledChannelPropertyEntity;
		const extraProperty = {
			id: 'property-extra',
			channel,
			value: { value: 'orphaned' },
		} as WledChannelPropertyEntity;
		const channelRepository = {
			find: jest.fn().mockResolvedValue([channel]),
			delete: jest.fn(),
			save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
		};
		const propertyRepository = {
			find: jest.fn().mockResolvedValue([valuedProperty, emptyProperty, extraProperty]),
			delete: jest.fn(),
			save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
		};
		const manager = {
			getRepository: jest.fn((entity) => (entity === WledChannelEntity ? channelRepository : propertyRepository)),
		};
		const dataSource = {
			transaction: jest.fn(async (handler: (transactionManager: typeof manager) => Promise<void>): Promise<void> => {
				await handler(manager);
			}),
		} as unknown as DataSource;
		const write = jest.fn().mockResolvedValue(true);
		const deleteValue = jest.fn().mockResolvedValue(undefined);
		const propertyValueService = {
			write,
			delete: deleteValue,
		} as unknown as PropertyValueService;
		const service = new WledAdoptionSnapshotService(dataSource, propertyValueService);

		await service.restore({
			deviceId: 'device-1',
			channels: [channel],
			properties: [valuedProperty, emptyProperty],
		});

		expect(write).toHaveBeenCalledWith(expect.objectContaining({ id: 'property-1' }), 'original');
		expect(deleteValue).toHaveBeenCalledWith(expect.objectContaining({ id: 'property-2' }));
		expect(deleteValue).toHaveBeenCalledWith(expect.objectContaining({ id: 'property-extra' }));
	});
});
