import { Expose, Type } from 'class-transformer';
import { IsEmail, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import type { components } from '../../../openapi';

type ReqCheckEmail = components['schemas']['AuthModuleReqCheckEmail'];
type CheckEmail = components['schemas']['AuthModuleCheckEmail'];

@ApiSchema({ name: 'AuthModuleCheckEmail' })
export class CheckEmailDto implements CheckEmail {
	@ApiProperty({
		description: 'The email address to check for availability.',
		type: 'string',
		format: 'email',
		example: 'john@doe.com',
	})
	@Expose()
	@IsEmail(
		{ require_tld: true, allow_ip_domain: false, ignore_max_length: false },
		{ message: '[{"field":"email","reason":"Email have to be valid email address."}]' },
	)
	email: string;
}

@ApiSchema({ name: 'AuthModuleReqCheckEmail' })
export class ReqCheckEmailDto implements ReqCheckEmail {
	@ApiProperty({
		description: 'Email validation data',
		type: () => CheckEmailDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => CheckEmailDto)
	data: CheckEmailDto;
}
