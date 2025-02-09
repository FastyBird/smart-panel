import { Expose } from 'class-transformer';
import { IsEmail } from 'class-validator';

import type { components } from '../../../openapi';

type CheckEmail = components['schemas']['AuthCheckEmail'];

export class CheckEmailDto implements CheckEmail {
	@Expose()
	@IsEmail(
		{ require_tld: true, allow_ip_domain: false, ignore_max_length: false },
		{ message: '[{"field":"email","reason":"Email have to be valid email address."}]' },
	)
	email: string;
}
