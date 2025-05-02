import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

export class ServiceRequestDto {
	@Expose()
	@IsString()
	entity_id: string;

	[key: string]: unknown; // Dynamic properties like brightness, color_temp, etc.
}
