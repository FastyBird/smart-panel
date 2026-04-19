import { Expose } from 'class-transformer';
import { ChildEntity } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { SpaceType } from '../../../modules/spaces/spaces.constants';

@ApiSchema({ name: 'SpacesSyntheticEntryPluginDataEntrySpace' })
@ChildEntity(SpaceType.ENTRY)
export class EntrySpaceEntity extends SpaceEntity {
	@ApiProperty({
		description: 'Space type',
		enum: SpaceType,
		default: SpaceType.ENTRY,
		example: SpaceType.ENTRY,
	})
	@Expose()
	get type(): SpaceType {
		return SpaceType.ENTRY;
	}
}
