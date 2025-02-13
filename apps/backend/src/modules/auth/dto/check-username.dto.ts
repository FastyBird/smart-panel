import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

type ReqCheckUsername = components['schemas']['AuthReqCheckUsername'];
type CheckUsername = components['schemas']['AuthCheckUsername'];

export class CheckUsernameDto implements CheckUsername {
	@Expose()
	@IsNotEmpty({ message: '[{"field":"username","reason":"Username must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"username","reason":"Username must be a non-empty string."}]' })
	username: string;
}

export class ReqCheckUsernameDto implements ReqCheckUsername {
	@Expose()
	@ValidateNested()
	@Type(() => CheckUsernameDto)
	data: CheckUsernameDto;
}
