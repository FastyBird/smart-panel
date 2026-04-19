import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateSpaceDto } from '../../../modules/spaces/dto/update-space.dto';
import { SpaceType } from '../../../modules/spaces/spaces.constants';

@ApiSchema({ name: 'SpacesSyntheticMasterPluginUpdateMasterSpace' })
export class UpdateMasterSpaceDto extends UpdateSpaceDto {
	@ApiProperty({
		description: 'Space type',
		enum: [SpaceType.MASTER],
		default: SpaceType.MASTER,
		example: SpaceType.MASTER,
	})
	readonly type: SpaceType.MASTER;
}
