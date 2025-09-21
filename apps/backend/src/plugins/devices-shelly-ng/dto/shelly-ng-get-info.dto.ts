import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class ShellyNgGetInfoDto {
	@Expose()
	@IsString({
		message: '[{"field":"hostname","reason":"Hostname attribute must be a valid IP address or network hostname."}]',
	})
	hostname: string;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"password","reason":"Password attribute must be a valid string."}]' })
	password?: string | null = null;
}
