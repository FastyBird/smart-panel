import { Expose } from 'class-transformer';
import { ChildEntity } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { SpaceType } from '../../../modules/spaces/spaces.constants';

@ApiSchema({ name: 'SpacesModuleDataZoneSpace' })
@ChildEntity(SpaceType.ZONE)
export class ZoneSpaceEntity extends SpaceEntity {
	@ApiProperty({ description: 'Space type', enum: SpaceType, default: SpaceType.ZONE, example: SpaceType.ZONE })
	@Expose()
	get type(): SpaceType {
		return SpaceType.ZONE;
	}
}
