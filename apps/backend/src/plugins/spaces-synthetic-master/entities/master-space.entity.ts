import { Expose } from 'class-transformer';
import { ChildEntity } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { SpaceType } from '../../../modules/spaces/spaces.constants';

@ApiSchema({ name: 'SpacesSyntheticMasterPluginDataMasterSpace' })
@ChildEntity(SpaceType.MASTER)
export class MasterSpaceEntity extends SpaceEntity {
	@ApiProperty({
		description: 'Space type',
		enum: SpaceType,
		default: SpaceType.MASTER,
		example: SpaceType.MASTER,
	})
	@Expose()
	get type(): SpaceType {
		return SpaceType.MASTER;
	}
}
