import { Expose } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { UserRole } from '../../users/users.constants';

export type ClientType = 'user' | 'display' | 'third_party';

export class ClientUserDto {
	@Expose()
	@IsOptional()
	@IsString()
	id?: string;

	@Expose()
	@IsEnum(UserRole)
	role: UserRole;

	@Expose()
	@IsOptional()
	@IsString()
	type?: ClientType;
}
