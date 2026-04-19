import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateSpaceDto } from '../../../modules/spaces/dto/update-space.dto';
import { SpaceType } from '../../../modules/spaces/spaces.constants';

@ApiSchema({ name: 'SpacesSyntheticEntryPluginUpdateEntrySpace' })
export class UpdateEntrySpaceDto extends UpdateSpaceDto {
	@ApiProperty({
		description: 'Space type',
		enum: [SpaceType.ENTRY],
		default: SpaceType.ENTRY,
		example: SpaceType.ENTRY,
	})
	readonly type: SpaceType.ENTRY;
}
