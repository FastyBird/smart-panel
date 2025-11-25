import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import type { components } from '../../../openapi';

type ReqCheckUsername = components['schemas']['AuthModuleReqCheckUsername'];
type CheckUsername = components['schemas']['AuthModuleCheckUsername'];

@ApiSchema({ name: 'AuthModuleCheckUsername' })
export class CheckUsernameDto implements CheckUsername {
	@ApiProperty({
		description: 'The username to check for availability.',
		type: 'string',
		example: 'johndoe',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"username","reason":"Username must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"username","reason":"Username must be a non-empty string."}]' })
	username: string;
}

@ApiSchema({ name: 'AuthModuleReqCheckUsername' })
export class ReqCheckUsernameDto implements ReqCheckUsername {
	@ApiProperty({
		description: 'Username validation data',
		type: () => CheckUsernameDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => CheckUsernameDto)
	data: CheckUsernameDto;
}
