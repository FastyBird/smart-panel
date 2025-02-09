import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

import type { components } from '../../../openapi';

type CheckUsername = components['schemas']['AuthCheckUsername'];

export class CheckUsernameDto implements CheckUsername {
	@Expose()
	@IsNotEmpty({ message: '[{"field":"username","reason":"Username must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"username","reason":"Username must be a non-empty string."}]' })
	username: string;
}
