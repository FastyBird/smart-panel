import { DataSource, UpdateEvent } from 'typeorm';

import { ConfigService } from '@nestjs/config';

import { DeviceCommandGraphService } from '../../../modules/devices/services/device-command-graph.service';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { SpaceRoleEntity } from '../../../modules/spaces/entities/space-role.entity';
import { SpaceType } from '../../../modules/spaces/spaces.constants';
import { SpaceClimateRoleEntity } from '../entities/space-climate-role.entity';
import { SpaceLightingRoleEntity } from '../entities/space-lighting-role.entity';
import { SpaceSensorRoleEntity } from '../entities/space-sensor-role.entity';

import { SpaceStateReadService, spaceStateMetadataCapacity } from './space-state-read.service';

type Configuration = {
	space: { id: string; type: SpaceType };
	deviceIds: string[];
	lighting: SpaceLightingRoleEntity[];
	climate: SpaceClimateRoleEntity[];
	sensor: SpaceSensorRoleEntity[];
};
type Queries = { query(id: string): Promise<Configuration | null> };
const configuration = (id: string): Configuration => ({
	space: { id, type: SpaceType.ROOM },
	deviceIds: [],
	lighting: [],
	climate: [],
	sensor: [],
});
const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason: Error) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
};

describe('Bounded runtime space configuration retention', () => {
	let service: SpaceStateReadService;
	let query: jest.SpyInstance<Promise<Configuration | null>, [string]>;
	let catalogGeneration: number;

	beforeEach(() => {
		catalogGeneration = 0;
		service = new SpaceStateReadService(
			{ subscribers: [] } as unknown as DataSource,
			{ getGeneration: () => catalogGeneration } as PropertyMetadataService,
			{} as DeviceCommandGraphService,
			new ConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: false }),
		);
		query = jest
			.spyOn(service as unknown as Queries, 'query')
			.mockImplementation((id) => Promise.resolve(configuration(id)));
	});
	afterEach(() => {
		service.onModuleDestroy();
		jest.restoreAllMocks();
	});

	it('coalesces concurrent domain reads and detaches exposed space facts', async () => {
		await Promise.all([
			service.findOne('room'),
			service.getLightingRoleMap('room'),
			service.getClimateRoleMap('room'),
			service.getSensorRoleMap('room'),
		]);
		expect(query).toHaveBeenCalledTimes(1);
		(await service.findOne('room')).id = 'changed';
		expect((await service.findOne('room')).id).toBe('room');
	});

	it('does not retain failures or missing IDs', async () => {
		query.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(null);
		await expect(service.findOne('room')).rejects.toThrow('unavailable');
		expect(await service.findOne('room')).toBeNull();
		expect(await service.findOne('room')).toMatchObject({ id: 'room' });
		expect(query).toHaveBeenCalledTimes(3);
	});

	it('evicts the least recently used configuration at capacity', async () => {
		for (let i = 0; i < spaceStateMetadataCapacity; i++) await service.findOne(String(i));
		await service.findOne('0');
		await service.findOne('extra');
		await service.findOne('0');
		expect(query).toHaveBeenCalledTimes(spaceStateMetadataCapacity + 1);
		await service.findOne('1');
		expect(query).toHaveBeenCalledTimes(spaceStateMetadataCapacity + 2);
	});

	it('bounds coalesced pending lookups and serves overflow without retaining it', async () => {
		const gate = deferred<void>();
		query.mockImplementation(async (id) => {
			await gate.promise;
			return configuration(id);
		});
		const pending = Array.from({ length: spaceStateMetadataCapacity }, (_, i) => service.findOne(String(i)));
		const overflow = [service.findOne('overflow'), service.findOne('overflow')];
		expect(query).toHaveBeenCalledTimes(spaceStateMetadataCapacity + 2);
		gate.resolve();
		await Promise.all([...pending, ...overflow]);
		await service.findOne('overflow');
		expect(query).toHaveBeenCalledTimes(spaceStateMetadataCapacity + 3);
	});

	it('retries a superseded load after shared catalog invalidation', async () => {
		const old = deferred<Configuration>();
		query.mockReturnValueOnce(old.promise);
		const reading = service.findOne('room');
		catalogGeneration++;
		old.resolve({ ...configuration('room'), space: { id: 'room', type: SpaceType.ZONE } });
		expect(await reading).toMatchObject({ type: SpaceType.ROOM });
		expect(query).toHaveBeenCalledTimes(2);
	});

	it('does not let an older failed load discard newer coalesced work', async () => {
		const old = deferred<Configuration>();
		const current = deferred<Configuration>();
		query.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
		const first = service.findOne('room');
		const rejected = expect(first).rejects.toThrow('old');
		service.invalidate();
		const second = service.findOne('room');
		old.reject(new Error('old'));
		await rejected;
		const third = service.findOne('room');
		expect(query).toHaveBeenCalledTimes(2);
		current.resolve(configuration('room'));
		await Promise.all([second, third]);
	});

	it('ignores unrelated role subtypes while invalidating base-table bulk updates', async () => {
		class OtherRole {}
		await service.findOne('room');
		const event = {
			metadata: { target: OtherRole, inheritanceTree: [OtherRole, SpaceRoleEntity] },
			queryRunner: { isTransactionActive: false },
		} as unknown as UpdateEvent<unknown>;
		service.afterUpdate(event);
		await service.findOne('room');
		expect(query).toHaveBeenCalledTimes(1);
		event.metadata.target = SpaceRoleEntity;
		event.metadata.inheritanceTree = [SpaceRoleEntity];
		service.afterUpdate(event);
		await service.findOne('room');
		expect(query).toHaveBeenCalledTimes(2);
	});

	it('does not refill retention after shutdown', async () => {
		const old = deferred<Configuration>();
		query.mockReturnValueOnce(old.promise);
		const pending = service.findOne('room');
		service.onModuleDestroy();
		old.resolve(configuration('room'));
		await pending;
		const before = query.mock.calls.length;
		await service.findOne('room');
		await service.findOne('room');
		expect(query).toHaveBeenCalledTimes(before + 2);
	});
});
