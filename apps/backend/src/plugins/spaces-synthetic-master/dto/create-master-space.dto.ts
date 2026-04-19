import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { CreateSpaceDto } from '../../../modules/spaces/dto/create-space.dto';
import { SpaceType } from '../../../modules/spaces/spaces.constants';

@ApiSchema({ name: 'SpacesSyntheticMasterPluginCreateMasterSpace' })
export class CreateMasterSpaceDto extends CreateSpaceDto {
	@ApiProperty({
		description: 'Space type',
		enum: [SpaceType.MASTER],
		default: SpaceType.MASTER,
		example: SpaceType.MASTER,
	})
	readonly type: SpaceType.MASTER;
}
