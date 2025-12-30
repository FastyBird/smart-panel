import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

export class HomeAssistantDiscoveredHelperDto {
	@Expose({ name: 'entity_id' })
	@IsString()
	entity_id: string;

	@Expose()
	@IsString()
	name: string;

	@Expose()
	@IsString()
	domain: string;
}
