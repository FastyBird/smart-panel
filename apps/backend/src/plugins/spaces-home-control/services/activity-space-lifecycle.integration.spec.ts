import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DisplayEntity } from '../../../modules/displays/entities/displays.entity';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { SpacesTypeMapperService } from '../../../modules/spaces/services/spaces-type-mapper.service';
import { SpacesService } from '../../../modules/spaces/services/spaces.service';
import { SpaceType } from '../../../modules/spaces/spaces.constants';
import { CreateHomeControlSpaceDto } from '../dto/create-home-control-space.dto';
import { UpdateHomeControlSpaceDto } from '../dto/update-home-control-space.dto';
import { RoomSpaceEntity } from '../entities/room-space.entity';

import { activityTestDatabase } from './activity-test-support';

jest.setTimeout(30000);
describe('generic space creation with plugin activity lifecycle', () => {
	it('commits defaults before creation event, rolls back failed plugin initialization', async () => {
		const { database, lifecycle, configs, events } = await activityTestDatabase();
		try {
			const mapper = new SpacesTypeMapperService();
			mapper.registerMapping({
				type: SpaceType.ROOM,
				class: RoomSpaceEntity,
				createDto: CreateHomeControlSpaceDto,
				updateDto: UpdateHomeControlSpaceDto,
			});
			const service = new SpacesService(
				database.getRepository(SpaceEntity),
				database.getRepository(DeviceEntity),
				database.getRepository(DisplayEntity),
				{} as never,
				{} as never,
				{} as never,
				{} as never,
				database,
				events,
				mapper,
				lifecycle,
			);
			const event = jest.spyOn(events, 'emit');
			const room = await service.create({ type: SpaceType.ROOM, name: 'Created through core' });
			expect(await configs.list(room.id)).toHaveLength(5);
			expect(event).toHaveBeenCalledWith('SpacesModule.Space.Created', expect.objectContaining({ id: room.id }));
			lifecycle.register({
				reconcile: () => Promise.reject(new Error('plugin initialization failed')),
			});
			await expect(service.create({ type: SpaceType.ROOM, name: 'Must roll back' })).rejects.toThrow(
				'plugin initialization failed',
			);
			expect(await database.getRepository(SpaceEntity).findOneBy({ name: 'Must roll back' })).toBeNull();
		} finally {
			await database.destroy();
		}
	});
});
