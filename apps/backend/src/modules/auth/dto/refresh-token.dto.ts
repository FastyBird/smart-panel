import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

type ReqRefreshToken = components['schemas']['AuthReqRefreshToken'];
type RefreshToken = components['schemas']['AuthRefreshToken'];

export class RefreshTokenDto implements RefreshToken {
	@Expose()
	@IsNotEmpty({ message: '[{"field":"token","reason":"Token must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"token","reason":"Token must be a non-empty string."}]' })
	token: string;
}

export class ReqRefreshDto implements ReqRefreshToken {
	@Expose()
	@ValidateNested()
	@Type(() => RefreshTokenDto)
	data: RefreshTokenDto;
}
