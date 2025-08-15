import { Expose, Type } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';
import { UserRole } from '../users.constants';

type ReqUpdateUser = components['schemas']['UsersModuleReqUpdateUser'];
type UpdateUser = components['schemas']['UsersModuleUpdateUser'];

export class UpdateUserDto implements UpdateUser {
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"username","reason":"Username must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"username","reason":"Username must be a non-empty string."}]' })
	username?: string;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"password","reason":"Password must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"password","reason":"Password must be a non-empty string."}]' })
	@ValidateIf((_, value) => value !== null)
	password?: string | null;

	@Expose()
	@IsOptional()
	@IsEmail(
		{ require_tld: true, allow_ip_domain: false, ignore_max_length: false },
		{ message: '[{"field":"email","reason":"Email have to be valid email address."}]' },
	)
	@ValidateIf((_, value) => value !== null)
	email?: string | null;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"first_name","reason":"First name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"first_name","reason":"First name must be a non-empty string."}]' })
	@ValidateIf((_, value) => value !== null)
	first_name?: string | null;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"last_name","reason":"Last name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"last_name","reason":"Last name must be a non-empty string."}]' })
	@ValidateIf((_, value) => value !== null)
	last_name?: string | null;

	@Expose()
	@IsOptional()
	@IsEnum(UserRole, { message: '[{"field":"role","reason":"Role must be one of the valid roles."}]' })
	@ValidateIf((_, value) => value !== null)
	role?: UserRole;
}

export class ReqUpdateUserDto implements ReqUpdateUser {
	@Expose()
	@ValidateNested()
	@Type(() => UpdateUserDto)
	data: UpdateUserDto;
}
