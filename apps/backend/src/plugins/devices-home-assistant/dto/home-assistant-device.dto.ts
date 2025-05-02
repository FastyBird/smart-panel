import { Expose } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class HomeAssistantDeviceDto {
	@Expose()
	@IsString()
	id: string;

	@Expose()
	@IsString()
	name: string;

	@Expose()
	@IsArray()
	@ArrayNotEmpty()
	@IsString({ each: true })
	entities: string[];
}
