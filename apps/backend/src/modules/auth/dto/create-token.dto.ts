import { Expose, Transform, Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateIf, ValidateNested } from 'class-validator';

import { TokenType } from '../auth.constants';

const determineTokenDto = (obj: unknown): new () => object => {
	if (
		typeof obj === 'object' &&
		obj !== null &&
		'data' in obj &&
		typeof obj.data === 'object' &&
		obj.data !== null &&
		'type' in obj.data
	) {
		const type = (obj.data as { type: string }).type as TokenType;

		if (!Object.values(TokenType).includes(type)) {
			throw new Error(`Unknown type ${type}`);
		}

		switch (type) {
			case TokenType.ACCESS:
				return CreateAccessTokenDto;
			case TokenType.REFRESH:
				return CreateRefreshTokenDto;
			case TokenType.LONG_LIVE:
				return CreateLongLiveTokenDto;
			default:
				throw new Error(`Unknown type ${(obj.data as { type: string }).type}`);
		}
	}
	throw new Error('Invalid object format for determining config DTO');
};

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
	@IsNotEmpty({ message: '[{"field":"type","reason":"Type must be one of the valid types."}]' })
	@IsString({ message: '[{"field":"type","reason":"Type must be one of the valid types."}]' })
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
	type: TokenType.ACCESS;

	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"owner","reason":"Token owner must be a valid UUID (version 4)."}]' })
	owner: string;
}

export class CreateRefreshTokenDto extends CreateTokenDto {
	type: TokenType.REFRESH;

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
	type: TokenType.LONG_LIVE;

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

export class ReqCreateTokenDto {
	@Expose()
	@ValidateNested()
	@Type((options) => determineTokenDto(options?.object ?? {}))
	data: CreateAccessTokenDto | CreateRefreshTokenDto | CreateLongLiveTokenDto;
}
