import { Expose } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { TokenOwnerType } from '../../auth/auth.constants';
import { UserRole } from '../../users/users.constants';

export type ClientType = 'user' | 'token';

export class ClientUserDto {
	@ApiPropertyOptional({
		description: 'User ID',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	id?: string | null;

	@ApiProperty({
		description: 'User role',
		enum: UserRole,
	})
	@Expose()
	@IsEnum(UserRole)
	role: UserRole;

	@ApiPropertyOptional({
		description: 'Client type',
		type: 'string',
		enum: ['user', 'token'],
	})
	@Expose()
	@IsOptional()
	@IsString()
	type?: ClientType;

	@ApiPropertyOptional({
		name: 'owner_type',
		description: 'Token owner type',
		enum: TokenOwnerType,
	})
	@Expose({ name: 'owner_type' })
	@IsOptional()
	@IsEnum(TokenOwnerType)
	ownerType?: TokenOwnerType;

	@ApiPropertyOptional({
		name: 'token_id',
		description: 'Token ID',
		type: 'string',
	})
	@Expose({ name: 'token_id' })
	@IsOptional()
	@IsString()
	tokenId?: string;
}
