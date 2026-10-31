import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { SpaceOccupancyEntity } from '../entities/space-occupancy.entity';
import { OccupancyStatus } from '../occupancy/space-occupancy.types';

import { SpaceOccupancyInputsService } from './space-occupancy-inputs.service';

describe('explicit multi-sensor occupancy evidence', () => {
	let generation: number;
	let online: boolean;
	let samples: Map<string, { value: boolean; quality: string }>;
	let service: SpaceOccupancyInputsService;
	const row = Object.assign(new SpaceOccupancyEntity(), {
		spaceId: 'room',
		sensorPropertyIds: ['a', 'b'],
		maximumAgeSeconds: 3600,
	});
	beforeEach(() => {
		generation = 1;
		online = true;
		samples = new Map();
		const devices = [
			{
				id: 'device',
				name: 'Sensor',
				enabled: true,
				hidden: false,
				channels: [
					{
						category: ChannelCategory.MOTION,
						properties: ['a', 'b'].map((id) => ({ id, category: PropertyCategory.DETECTED, value: { value: false } })),
					},
				],
			},
		];
		service = new SpaceOccupancyInputsService(
			{ findDevicesBySpace: () => Promise.resolve(devices) } as never,
			{ getGeneration: () => generation } as never,
			{ readQualifiedSampleSnapshot: (property: { id: string }) => samples.get(property.id) ?? null } as never,
			{ isCurrentlyOnline: () => online } as never,
		);
	});
	it('never uses historical display values as absence evidence', async () => {
		expect((await service.capture(row)).status).toBe(OccupancyStatus.UNKNOWN);
	});
	it('any qualified positive is occupied even if another sensor is unavailable', async () => {
		samples.set('a', { value: true, quality: 'good' });
		expect((await service.capture(row)).status).toBe(OccupancyStatus.OCCUPIED);
	});
	it('all selected sensors must be qualified and negative for vacancy', async () => {
		samples.set('a', { value: false, quality: 'good' });
		expect((await service.capture(row)).status).toBe(OccupancyStatus.UNKNOWN);
		samples.set('b', { value: false, quality: 'good' });
		const observation = await service.capture(row);
		expect(observation.status).toBe(OccupancyStatus.VACANT);
		samples.set('b', { value: true, quality: 'good' });
		expect(observation.isCurrent()).toBe(false);
	});
	it('offline, degraded and changed structural membership revoke vacancy', async () => {
		samples.set('a', { value: false, quality: 'good' });
		samples.set('b', { value: false, quality: 'good' });
		const observation = await service.capture(row);
		online = false;
		expect(observation.isCurrent()).toBe(false);
		online = true;
		samples.set('b', { value: false, quality: 'degraded' });
		expect(observation.isCurrent()).toBe(false);
		samples.set('b', { value: false, quality: 'good' });
		generation++;
		expect(observation.isCurrent()).toBe(false);
	});
});
