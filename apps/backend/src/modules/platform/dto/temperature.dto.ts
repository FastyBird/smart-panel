import { IsNumber, IsOptional } from 'class-validator';

export class TemperatureDto {
	@IsOptional()
	@IsNumber()
	cpu?: number = null;

	@IsOptional()
	@IsNumber()
	gpu?: number = null;
}
