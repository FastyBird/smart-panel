import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class ShellyV1ProbeDto {
	@Expose()
	@IsString({
		message: '[{"field":"host","reason":"Host attribute must be a valid IP address or hostname."}]',
	})
	host: string;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"password","reason":"Password attribute must be a valid string."}]' })
	password?: string | null = null;
}
