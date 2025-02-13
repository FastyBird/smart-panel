import { Expose, Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenResponseDto {
	@Expose({ name: 'access_token' })
	@IsNotEmpty()
	@IsString()
	@Transform(
		({ obj }: { obj: { access_token?: string; accessToken?: string } }) => obj.access_token ?? obj.accessToken,
		{ toClassOnly: true },
	)
	accessToken: string;

	@Expose({ name: 'refresh_token' })
	@IsNotEmpty()
	@IsString()
	@Transform(
		({ obj }: { obj: { refresh_token?: string; refreshToken?: string } }) => obj.refresh_token ?? obj.refreshToken,
		{ toClassOnly: true },
	)
	refreshToken: string;

	@Expose()
	@IsNotEmpty()
	@IsString()
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

	@Expose()
	@IsNotEmpty()
	@IsString()
	type: string;
}
