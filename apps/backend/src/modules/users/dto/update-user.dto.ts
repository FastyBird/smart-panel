import { Expose, Type } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import type { components } from '../../../openapi';
import { UserRole } from '../users.constants';

type ReqUpdateUser = components['schemas']['UsersModuleReqUpdateUser'];
type UpdateUser = components['schemas']['UsersModuleUpdateUser'];

@ApiSchema({ name: 'UsersModuleUpdateUser' })
export class UpdateUserDto implements UpdateUser {
	@ApiPropertyOptional({
		description: 'Unique identifier for the user.',
		type: 'string',
		example: 'johndoe',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"username","reason":"Username must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"username","reason":"Username must be a non-empty string."}]' })
	username?: string;

	@ApiPropertyOptional({
		description: "User's password.",
		type: 'string',
		format: 'password',
		example: 'superstrongpassword',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"password","reason":"Password must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"password","reason":"Password must be a non-empty string."}]' })
	@ValidateIf((_, value) => value !== null)
	password?: string | null;

	@ApiPropertyOptional({
		description: "User's email address.",
		type: 'string',
		format: 'email',
		example: 'john@doe.com',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsEmail(
		{ require_tld: true, allow_ip_domain: false, ignore_max_length: false },
		{ message: '[{"field":"email","reason":"Email have to be valid email address."}]' },
	)
	@ValidateIf((_, value) => value !== null)
	email?: string | null;

	@ApiPropertyOptional({
		name: 'first_name',
		description: "User's first name.",
		type: 'string',
		example: 'John',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"first_name","reason":"First name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"first_name","reason":"First name must be a non-empty string."}]' })
	@ValidateIf((_, value) => value !== null)
	first_name?: string | null;

	@ApiPropertyOptional({
		name: 'last_name',
		description: "User's last name.",
		type: 'string',
		example: 'Doe',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"last_name","reason":"Last name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"last_name","reason":"Last name must be a non-empty string."}]' })
	@ValidateIf((_, value) => value !== null)
	last_name?: string | null;

	@ApiPropertyOptional({
		description: 'User role',
		enum: UserRole,
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsEnum(UserRole, { message: '[{"field":"role","reason":"Role must be one of the valid roles."}]' })
	@ValidateIf((_, value) => value !== null)
	role?: UserRole;
}

@ApiSchema({ name: 'UsersModuleReqUpdateUser' })
export class ReqUpdateUserDto implements ReqUpdateUser {
	@ApiProperty({
		description: 'User update data',
		type: () => UpdateUserDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => UpdateUserDto)
	data: UpdateUserDto;
}
