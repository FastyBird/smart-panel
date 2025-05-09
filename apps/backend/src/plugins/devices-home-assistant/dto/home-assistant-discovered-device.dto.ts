import { Expose } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class HomeAssistantDiscoveredDeviceDto {
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
