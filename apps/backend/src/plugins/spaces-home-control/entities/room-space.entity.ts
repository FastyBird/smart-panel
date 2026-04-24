import { Expose } from 'class-transformer';
import { ChildEntity } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { SpaceType } from '../../../modules/spaces/spaces.constants';

@ApiSchema({ name: 'SpacesModuleDataRoomSpace' })
@ChildEntity(SpaceType.ROOM)
export class RoomSpaceEntity extends SpaceEntity {
	@ApiProperty({ description: 'Space type', enum: SpaceType, default: SpaceType.ROOM, example: SpaceType.ROOM })
	@Expose()
	get type(): SpaceType {
		return SpaceType.ROOM;
	}
}
