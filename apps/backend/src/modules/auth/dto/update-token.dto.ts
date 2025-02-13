import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';

import { TokenType } from '../auth.constants';

export abstract class UpdateTokenDto {
	@Expose()
	@IsNotEmpty({ message: '[{"field":"type","reason":"Type must be one of the valid types."}]' })
	@IsString({ message: '[{"field":"type","reason":"Type must be one of the valid types."}]' })
	type: string;

	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"revoked","reason":"Revoked must be a valid boolean value."}]' })
	revoked: boolean;
}

export class UpdateAccessTokenDto extends UpdateTokenDto {
	type: TokenType.ACCESS;
}

export class UpdateRefreshTokenDto extends UpdateTokenDto {
	type: TokenType.REFRESH;
}

export class UpdateLongLiveTokenDto extends UpdateTokenDto {
	type: TokenType.LONG_LIVE;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	name?: string;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"description","reason":"Description must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"description","reason":"Description must be a non-empty string."}]' })
	@ValidateIf((_, value) => value !== null)
	description?: string | null;
}

export class ReqUpdateTokenDto {
	@Expose()
	@ValidateNested()
	@Type(() => UpdateTokenDto)
	data: UpdateAccessTokenDto | UpdateRefreshTokenDto | UpdateLongLiveTokenDto;
}
