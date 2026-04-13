import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'AuthModuleCreatePersonalToken' })
export class CreatePersonalTokenDto {
	@ApiProperty({
		description: 'Token name',
		type: 'string',
		example: 'Home Assistant Integration',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Token name is required."}]' })
	@IsString()
	name: string;

	@ApiPropertyOptional({
		description: 'Token description',
		type: 'string',
		nullable: true,
		example: 'Token for Home Assistant to access device states',
	})
	@Expose()
	@IsOptional()
	@IsString()
	description?: string | null;

	@ApiPropertyOptional({
		description: 'Token expiry in days (null = never expires)',
		type: 'number',
		nullable: true,
		example: 365,
	})
	@Expose({ name: 'expires_in_days' })
	@IsOptional()
	expiresInDays?: number | null;
}

@ApiSchema({ name: 'AuthModuleReqCreatePersonalToken' })
export class ReqCreatePersonalTokenDto {
	@ApiProperty({
		description: 'Personal token creation data',
		type: () => CreatePersonalTokenDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => CreatePersonalTokenDto)
	data: CreatePersonalTokenDto;
}
