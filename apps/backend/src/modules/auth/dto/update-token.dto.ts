import { Expose } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export abstract class UpdateTokenDto {
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"revoked","reason":"Revoked must be a valid boolean value."}]' })
	revoked: boolean;
}

export class UpdateAccessTokenDto extends UpdateTokenDto {}

export class UpdateRefreshTokenDto extends UpdateTokenDto {}

export class UpdateLongLiveTokenDto extends UpdateTokenDto {
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	name: string;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"description","reason":"Description must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"description","reason":"Description must be a non-empty string."}]' })
	@ValidateIf((_, value) => value !== null)
	description: string | null;
}
