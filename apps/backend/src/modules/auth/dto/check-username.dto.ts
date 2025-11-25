import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'AuthModuleCheckUsername' })
export class CheckUsernameDto {
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
export class ReqCheckUsernameDto {
	@ApiProperty({
		description: 'Username validation data',
		type: () => CheckUsernameDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => CheckUsernameDto)
	data: CheckUsernameDto;
}
