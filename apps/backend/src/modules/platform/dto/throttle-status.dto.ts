import { Expose } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class ThrottleStatusDto {
	@Expose()
	@IsBoolean()
	undervoltage: boolean;

	@Expose()
	@IsBoolean()
	frequency_capping: boolean;

	@Expose()
	@IsBoolean()
	throttling: boolean;

	@Expose()
	@IsBoolean()
	soft_temp_limit: boolean;
}
