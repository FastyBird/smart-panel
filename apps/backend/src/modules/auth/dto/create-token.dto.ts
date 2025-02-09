import { Expose, Transform } from 'class-transformer';
import { IsDate, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

export abstract class CreateTokenDto {
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@Expose()
	@IsNotEmpty({ message: '[{"field":"token","reason":"Token must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"token","reason":"Token must be a non-empty string."}]' })
	token: string;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"type","reason":"Type must be one of the valid types."}]' })
	@IsString({ message: '[{"field":"type","reason":"Type must be one of the valid types."}]' })
	@ValidateIf((_, value) => value !== null)
	type: string;

	@Expose({ name: 'expires_at' })
	@IsDate({ message: '[{"field":"expires_at","reason":"Expires at must be a valid date."}]' })
	@Transform(
		({ obj }: { obj: { expires_at?: string | Date; expiresAt?: string | Date } }) => {
			const value: string | Date = obj.expires_at || obj.expiresAt;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	expiresAt: Date;
}

export class CreateAccessTokenDto extends CreateTokenDto {
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"owner","reason":"Token owner must be a valid UUID (version 4)."}]' })
	owner: string;
}

export class CreateRefreshTokenDto extends CreateTokenDto {
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"owner","reason":"Token owner must be a valid UUID (version 4)."}]' })
	owner: string;

	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"parent","reason":"Parent access token must be a valid UUID (version 4)."}]' })
	parent: string;
}

export class CreateLongLiveTokenDto extends CreateTokenDto {
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"owner","reason":"Token owner must be a valid UUID (version 4)."}]' })
	owner: string;

	@Expose()
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
