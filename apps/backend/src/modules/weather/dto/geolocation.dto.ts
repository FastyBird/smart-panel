import { Expose, Type } from 'class-transformer';
import { IsDefined, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class GeolocationCityDto {
	@Expose()
	@IsString()
	@IsDefined()
	name: string;

	@Expose()
	@IsOptional()
	@IsObject()
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

export class GeolocationZipDto {
	@Expose()
	@IsString()
	@IsDefined()
	zip: string;

	@Expose()
	@IsString()
	@IsDefined()
	name: string;

	@Expose()
	@IsNumber()
	lat: number;

	@Expose()
	@IsNumber()
	lon: number;

	@Expose()
	@IsString()
	country: string;
}
