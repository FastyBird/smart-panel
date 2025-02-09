import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

import type { components } from '../../../openapi';

type Login = components['schemas']['AuthLogin'];

export class LoginDto implements Login {
	@Expose()
	@IsNotEmpty({ message: '[{"field":"username","reason":"Username must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"username","reason":"Username must be a non-empty string."}]' })
	username: string;

	@Expose()
	@IsNotEmpty({ message: '[{"field":"password","reason":"Password must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"password","reason":"Password must be a non-empty string."}]' })
	password: string;
}
