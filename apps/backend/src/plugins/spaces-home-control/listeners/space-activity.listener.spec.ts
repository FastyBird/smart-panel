import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { SpaceActivityService } from '../../../modules/spaces/services/space-activity.service';

import { SpaceActivityListener } from './space-activity.listener';

describe('SpaceActivityListener', () => {
	const roomId = 'room';
	let findOne: jest.Mock;
	let activity: SpaceActivityService;
	let listener: SpaceActivityListener;

	beforeEach(() => {
		findOne = jest.fn().mockResolvedValue(
			Object.assign(new ChannelPropertyEntity(), {
				channel: Object.assign(new ChannelEntity(), { device: Object.assign(new DeviceEntity(), { roomId }) }),
			}),
		);
		activity = new SpaceActivityService();
		listener = new SpaceActivityListener({ findOne } as unknown as PropertyMetadataService, activity);
	});

	it('records activity from current catalog membership rather than a stale event relation', async () => {
		const before = Date.now();
		await listener.handlePropertyUpdated(
			Object.assign(new ChannelPropertyEntity(), { id: 'property', channel: 'old-channel' }),
		);
		const value = activity.readLatest({ id: roomId, lastActivityAt: null });
		expect(value).toBeInstanceOf(Date);
		expect((value as Date).getTime()).toBeGreaterThanOrEqual(before);
		expect(findOne).toHaveBeenCalledWith('property');
	});

	it.each([null, { channel: 'channel' }, { channel: { device: 'device' } }, { channel: { device: { roomId: null } } }])(
		'ignores missing properties or unassigned devices: %j',
		async (metadata) => {
			findOne.mockResolvedValue(metadata);
			await listener.handlePropertyUpdated(Object.assign(new ChannelPropertyEntity(), { id: 'property' }));
			expect(activity.readLatest({ id: roomId, lastActivityAt: null })).toBeNull();
		},
	);

	it('does not turn a failed metadata read into activity or a failed value publication', async () => {
		findOne.mockRejectedValue(new Error('catalog unavailable'));
		await expect(
			listener.handlePropertyUpdated(Object.assign(new ChannelPropertyEntity(), { id: 'property' })),
		).resolves.toBeUndefined();
		expect(activity.readLatest({ id: roomId, lastActivityAt: null })).toBeNull();
	});
});
