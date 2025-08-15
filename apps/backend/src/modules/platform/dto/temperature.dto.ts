import { Expose } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';

export class TemperatureDto {
	@Expose()
	@IsOptional()
	@IsNumber()
	cpu?: number = null;

	@Expose()
	@IsOptional()
	@IsNumber()
	gpu?: number = null;
}
