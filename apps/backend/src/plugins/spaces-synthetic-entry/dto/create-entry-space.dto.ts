import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { CreateSpaceDto } from '../../../modules/spaces/dto/create-space.dto';
import { SpaceType } from '../../../modules/spaces/spaces.constants';

@ApiSchema({ name: 'SpacesSyntheticEntryPluginCreateEntrySpace' })
export class CreateEntrySpaceDto extends CreateSpaceDto {
	@ApiProperty({
		description: 'Space type',
		enum: [SpaceType.ENTRY],
		default: SpaceType.ENTRY,
		example: SpaceType.ENTRY,
	})
	readonly type: SpaceType.ENTRY;
}
