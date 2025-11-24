import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';

import { ApiSchema } from '../../../common/decorators/api-schema.decorator';
import { TokenType } from '../auth.constants';

@ApiSchema('AuthModuleUpdateToken')
export abstract class UpdateTokenDto {
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
		description: 'Token revoked status',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"revoked","reason":"Revoked must be a valid boolean value."}]' })
	revoked: boolean;
}

@ApiSchema('AuthModuleUpdateAccessToken')
export class UpdateAccessTokenDto extends UpdateTokenDto {
	@ApiProperty({
		description: 'Token type',
		enum: [TokenType.ACCESS],
		example: TokenType.ACCESS,
	})
	type: TokenType.ACCESS;
}

@ApiSchema('AuthModuleUpdateRefreshToken')
export class UpdateRefreshTokenDto extends UpdateTokenDto {
	@ApiProperty({
		description: 'Token type',
		enum: [TokenType.REFRESH],
		example: TokenType.REFRESH,
	})
	type: TokenType.REFRESH;
}

@ApiSchema('AuthModuleUpdateLongLiveToken')
export class UpdateLongLiveTokenDto extends UpdateTokenDto {
	@ApiProperty({
		description: 'Token type',
		enum: [TokenType.LONG_LIVE],
		example: TokenType.LONG_LIVE,
	})
	type: TokenType.LONG_LIVE;

	@ApiPropertyOptional({
		description: 'Token name',
		type: 'string',
		example: 'My API Token',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	name?: string;

	@ApiPropertyOptional({
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
	description?: string | null;
}

@ApiSchema('AuthModuleReqUpdateToken')
export class ReqUpdateTokenDto {
	@ApiProperty({
		description: 'Token update data',
		oneOf: [
			{ $ref: getSchemaPath(UpdateAccessTokenDto) },
			{ $ref: getSchemaPath(UpdateRefreshTokenDto) },
			{ $ref: getSchemaPath(UpdateLongLiveTokenDto) },
		],
		discriminator: {
			propertyName: 'type',
			mapping: {
				access: getSchemaPath(UpdateAccessTokenDto),
				refresh: getSchemaPath(UpdateRefreshTokenDto),
				long_live: getSchemaPath(UpdateLongLiveTokenDto),
			},
		},
	})
	@Expose()
	@ValidateNested()
	@Type(() => UpdateTokenDto)
	data: UpdateAccessTokenDto | UpdateRefreshTokenDto | UpdateLongLiveTokenDto;
}
