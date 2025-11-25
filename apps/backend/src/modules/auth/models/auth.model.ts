import { Expose, Transform } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'AuthModuleResLogin' })
export class LoggedInResponseModel {
	@ApiProperty({
		name: 'access_token',
		description: 'The JWT access token for authenticated sessions.',
		type: 'string',
		example:
			'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
	})
	@Expose({ name: 'access_token' })
	@Transform(
		({ obj }: { obj: { access_token?: string; accessToken?: string } }) => obj.access_token ?? obj.accessToken,
		{ toClassOnly: true },
	)
	accessToken: string;

	@ApiProperty({
		name: 'refresh_token',
		description: 'The JWT refresh token for authenticated sessions.',
		type: 'string',
		example:
			'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDMyfQ.ysGR_iIUp1O2wrUaKzIlr0eKufYUhdNFV156bA_FoFw',
	})
	@Expose({ name: 'refresh_token' })
	@Transform(
		({ obj }: { obj: { refresh_token?: string; refreshToken?: string } }) => obj.refresh_token ?? obj.refreshToken,
		{ toClassOnly: true },
	)
	refreshToken: string;

	@ApiProperty({
		description: 'The JWT access token expiration date.',
		type: 'string',
		format: 'date-time',
		example: '2025-01-18T12:00:00Z',
	})
	@Expose()
	@Transform(
		({ obj }: { obj: { expiration?: string | Date } }) => {
			const value: string | Date = obj.expiration;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: string | Date }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	expiration: Date;

	@ApiProperty({
		description: 'Token type',
		type: 'string',
		default: 'Bearer',
		example: 'Bearer',
	})
	@Expose()
	type: string;
}

@ApiSchema({ name: 'AuthModuleResRefresh' })
export class RefreshTokenResponseModel {
	@ApiProperty({
		name: 'access_token',
		description: 'The JWT access token for authenticated sessions.',
		type: 'string',
		example:
			'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
	})
	@Expose({ name: 'access_token' })
	@Transform(
		({ obj }: { obj: { access_token?: string; accessToken?: string } }) => obj.access_token ?? obj.accessToken,
		{ toClassOnly: true },
	)
	accessToken: string;

	@ApiProperty({
		name: 'refresh_token',
		description: 'The JWT refresh token for authenticated sessions.',
		type: 'string',
		example:
			'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDMyfQ.ysGR_iIUp1O2wrUaKzIlr0eKufYUhdNFV156bA_FoFw',
	})
	@Expose({ name: 'refresh_token' })
	@Transform(
		({ obj }: { obj: { refresh_token?: string; refreshToken?: string } }) => obj.refresh_token ?? obj.refreshToken,
		{ toClassOnly: true },
	)
	refreshToken: string;

	@ApiProperty({
		description: 'The JWT access token expiration date.',
		type: 'string',
		format: 'date-time',
		example: '2025-01-18T12:00:00Z',
	})
	@Expose()
	@Transform(
		({ obj }: { obj: { expiration?: string | Date } }) => {
			const value: string | Date = obj.expiration;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: string | Date }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	expiration: Date;

	@ApiProperty({
		description: 'Token type',
		type: 'string',
		default: 'Bearer',
		example: 'Bearer',
	})
	@Expose()
	type: string;
}

@ApiSchema({ name: 'AuthModuleResRegisterDisplay' })
export class RegisteredDisplayResponseModel {
	@ApiProperty({
		description: 'Display account secret',
		type: 'string',
		example: 'IwMj3jfHdRVIxCck6DBgcQi3zXDNAHUu',
	})
	@Expose()
	secret: string;
}

@ApiSchema({ name: 'AuthModuleResCheck' })
export class CheckResponseModel {
	@ApiProperty({
		description: 'Indicates whether the provided validation field is valid.',
		type: 'boolean',
		example: true,
	})
	@Expose()
	valid: boolean;
}
