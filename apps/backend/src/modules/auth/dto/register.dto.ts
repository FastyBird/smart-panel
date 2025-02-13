import { Expose, Type } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

type ReqRegister = components['schemas']['AuthReqRegister'];
type Register = components['schemas']['AuthRegister'];

export class RegisterDto implements Register {
	@Expose()
	@IsNotEmpty({ message: '[{"field":"username","reason":"Username must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"username","reason":"Username must be a non-empty string."}]' })
	username: string;

	@Expose()
	@IsNotEmpty({ message: '[{"field":"password","reason":"Password must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"password","reason":"Password must be a non-empty string."}]' })
	password: string;

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
}

export class ReqRegisterDto implements ReqRegister {
	@Expose()
	@ValidateNested()
	@Type(() => RegisterDto)
	data: RegisterDto;
}
