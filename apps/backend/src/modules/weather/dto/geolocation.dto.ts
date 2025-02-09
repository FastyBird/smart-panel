import { Expose, Type } from 'class-transformer';
import { IsDefined, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class GeolocationDto {
	@Expose()
	@IsString()
	@IsDefined()
	name: string;

	@Expose()
	@IsOptional()
	@IsObject()
	@ValidateNested()
	@Type(() => Object)
	local_names?: Record<string, string>;

	@Expose()
	@IsNumber()
	lat: number;

	@Expose()
	@IsNumber()
	lon: number;

	@Expose()
	@IsString()
	country: string;

	@Expose()
	@IsOptional()
	@IsString()
	state?: string;
}
