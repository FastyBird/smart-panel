import { Expose } from 'class-transformer';
import { ChildEntity } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { SpaceType } from '../spaces.constants';

import { SpaceEntity } from './space.entity';

@ApiSchema({ name: 'SpacesModuleDataZoneSpace' })
@ChildEntity(SpaceType.ZONE)
export class ZoneSpaceEntity extends SpaceEntity {
	@ApiProperty({ description: 'Space type', type: 'string', default: SpaceType.ZONE, example: SpaceType.ZONE })
	@Expose()
	get type(): string {
		return SpaceType.ZONE;
	}
}
