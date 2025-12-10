import { Expose } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { TokenOwnerType } from '../../auth/auth.constants';
import { UserRole } from '../../users/users.constants';

export type ClientType = 'user' | 'token';

export class ClientUserDto {
	@Expose()
	@IsOptional()
	@IsString()
	id?: string | null;

	@Expose()
	@IsEnum(UserRole)
	role: UserRole;

	@Expose()
	@IsOptional()
	@IsString()
	type?: ClientType;

	@Expose()
	@IsOptional()
	@IsEnum(TokenOwnerType)
	ownerType?: TokenOwnerType;

	@Expose()
	@IsOptional()
	@IsString()
	tokenId?: string;
}
