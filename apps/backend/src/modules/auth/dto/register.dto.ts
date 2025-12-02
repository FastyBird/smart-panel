import { Expose, Type } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateIf, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UserRole } from '../../users/users.constants';

@ApiSchema({ name: 'AuthModuleRegister' })
export class RegisterDto {
	@ApiPropertyOptional({
		description: 'Optional user ID (UUID v4)',
		format: 'uuid',
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@ApiProperty({
		description: 'Unique identifier for the user.',
		type: 'string',
		example: 'johndoe',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"username","reason":"Username must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"username","reason":"Username must be a non-empty string."}]' })
	username: string;

	@ApiPropertyOptional({
		description: 'User role',
		enum: UserRole,
	})
	@Expose()
	@IsOptional()
	@IsEnum(UserRole, { message: '[{"field":"role","reason":"Role must be one of the valid roles."}]' })
	@ValidateIf((_, value) => value !== null)
	role?: UserRole;

	@ApiProperty({
		description: "User's password. Must be at least 6 characters long.",
		type: 'string',
		format: 'password',
		example: 'superstrongpassword',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"password","reason":"Password must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"password","reason":"Password must be a non-empty string."}]' })
	password: string;

	@ApiPropertyOptional({
		description: "Optional user's email address.",
		type: 'string',
		format: 'email',
		example: 'john@doe.com',
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
		description: "Optional user's first name.",
		type: 'string',
		example: 'John',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"first_name","reason":"First name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"first_name","reason":"First name must be a non-empty string."}]' })
	@ValidateIf((_, value) => value !== null)
	first_name?: string | null;

	@ApiPropertyOptional({
		description: "Optional user's last name.",
		type: 'string',
		example: 'Doe',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"last_name","reason":"Last name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"last_name","reason":"Last name must be a non-empty string."}]' })
	@ValidateIf((_, value) => value !== null)
	last_name?: string | null;
}

@ApiSchema({ name: 'AuthModuleReqRegister' })
export class ReqRegisterDto {
	@ApiProperty({
		description: 'Registration data',
		type: () => RegisterDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => RegisterDto)
	data: RegisterDto;
}
