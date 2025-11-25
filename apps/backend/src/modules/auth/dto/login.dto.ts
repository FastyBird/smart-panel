import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import type { components } from '../../../openapi';

type ReqLogin = components['schemas']['AuthModuleReqLogin'];
type Login = components['schemas']['AuthModuleLogin'];

@ApiSchema({ name: 'AuthModuleLogin' })
export class LoginDto implements Login {
	@ApiProperty({
		description: 'The username of the user.',
		type: 'string',
		example: 'johndoe',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"username","reason":"Username must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"username","reason":"Username must be a non-empty string."}]' })
	username: string;

	@ApiProperty({
		description: "The user's password.",
		type: 'string',
		format: 'password',
		example: 'superstrongpassword',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"password","reason":"Password must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"password","reason":"Password must be a non-empty string."}]' })
	password: string;
}

@ApiSchema({ name: 'AuthModuleReqLogin' })
export class ReqLoginDto implements ReqLogin {
	@ApiProperty({
		description: 'Login credentials',
		type: () => LoginDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => LoginDto)
	data: LoginDto;
}
