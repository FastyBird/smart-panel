import { Expose } from 'class-transformer';
import { ChildEntity } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { SpaceType } from '../spaces.constants';

import { SpaceEntity } from './space.entity';

@ApiSchema({ name: 'SpacesModuleDataRoomSpace' })
@ChildEntity(SpaceType.ROOM)
export class RoomSpaceEntity extends SpaceEntity {
	@ApiProperty({ description: 'Space type', enum: SpaceType, default: SpaceType.ROOM, example: SpaceType.ROOM })
	@Expose()
	get type(): SpaceType {
		return SpaceType.ROOM;
	}
}
