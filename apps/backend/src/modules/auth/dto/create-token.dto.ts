import { Expose, Transform, Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateIf, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';

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
	@ApiPropertyOptional({
		description: 'Token ID (optional, generated if not provided)',
		type: 'string',
		format: 'uuid',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@ApiProperty({
		description: 'Token value',
		type: 'string',
		example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"token","reason":"Token must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"token","reason":"Token must be a non-empty string."}]' })
	token: string;

	@ApiProperty({
		description: 'Token type discriminator',
		enum: TokenType,
		example: TokenType.ACCESS,
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"type","reason":"Type must be one of the valid types."}]' })
	@IsString({ message: '[{"field":"type","reason":"Type must be one of the valid types."}]' })
	type: string;

	@ApiProperty({
		name: 'expires_at',
		description: 'Token expiration date',
		type: 'string',
		format: 'date-time',
		example: '2025-01-18T12:00:00Z',
	})
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
	@ApiProperty({
		description: 'Token type',
		enum: [TokenType.ACCESS],
		example: TokenType.ACCESS,
	})
	type: TokenType.ACCESS;

	@ApiProperty({
		description: 'Token owner user ID',
		type: 'string',
		format: 'uuid',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"owner","reason":"Token owner must be a valid UUID (version 4)."}]' })
	owner: string;
}

export class CreateRefreshTokenDto extends CreateTokenDto {
	@ApiProperty({
		description: 'Token type',
		enum: [TokenType.REFRESH],
		example: TokenType.REFRESH,
	})
	type: TokenType.REFRESH;

	@ApiProperty({
		description: 'Token owner user ID',
		type: 'string',
		format: 'uuid',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"owner","reason":"Token owner must be a valid UUID (version 4)."}]' })
	owner: string;

	@ApiProperty({
		description: 'Parent access token ID',
		type: 'string',
		format: 'uuid',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"parent","reason":"Parent access token must be a valid UUID (version 4)."}]' })
	parent: string;
}

export class CreateLongLiveTokenDto extends CreateTokenDto {
	@ApiProperty({
		description: 'Token type',
		enum: [TokenType.LONG_LIVE],
		example: TokenType.LONG_LIVE,
	})
	type: TokenType.LONG_LIVE;

	@ApiProperty({
		description: 'Token owner user ID',
		type: 'string',
		format: 'uuid',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"owner","reason":"Token owner must be a valid UUID (version 4)."}]' })
	owner: string;

	@ApiProperty({
		description: 'Token name',
		type: 'string',
		example: 'My API Token',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	name: string;

	@ApiProperty({
		description: 'Token description',
		type: 'string',
		nullable: true,
		example: 'Token for accessing the API from external services',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"description","reason":"Description must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"description","reason":"Description must be a non-empty string."}]' })
	@ValidateIf((_, value) => value !== null)
	description: string | null;
}

export class ReqCreateTokenDto {
	@ApiProperty({
		description: 'Token creation data',
		oneOf: [
			{ $ref: getSchemaPath(CreateAccessTokenDto) },
			{ $ref: getSchemaPath(CreateRefreshTokenDto) },
			{ $ref: getSchemaPath(CreateLongLiveTokenDto) },
		],
		discriminator: {
			propertyName: 'type',
			mapping: {
				access: getSchemaPath(CreateAccessTokenDto),
				refresh: getSchemaPath(CreateRefreshTokenDto),
				long_live: getSchemaPath(CreateLongLiveTokenDto),
			},
		},
	})
	@Expose()
	@ValidateNested()
	@Type((options) => determineTokenDto(options?.object ?? {}))
	data: CreateAccessTokenDto | CreateRefreshTokenDto | CreateLongLiveTokenDto;
}
