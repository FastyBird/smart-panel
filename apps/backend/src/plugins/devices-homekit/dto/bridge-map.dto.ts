import { Expose, Type } from 'class-transformer';
import { IsArray, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'DevicesHomeKitPluginMapDevices' })
export class HomeKitMapDevicesDto {
	@ApiProperty({
		description: 'Array of Smart Panel device IDs to expose/bridge into Apple Home',
		type: [String],
		example: ['d290f1ee-6c54-4b01-90e6-d701748f0851', 'b180f1ee-6c54-4b01-90e6-d701748f0822'],
		name: 'device_ids',
	})
	@Expose({ name: 'device_ids' })
	@IsArray()
	@IsString({ each: true, message: '[{"field":"device_ids","reason":"Each device ID must be a string."}]' })
	device_ids: string[];
}

@ApiSchema({ name: 'DevicesHomeKitPluginReqMapDevices' })
export class ReqHomeKitMapDevicesDto {
	@ApiProperty({
		description: 'Request data wrapper for device mapping',
		type: () => HomeKitMapDevicesDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => HomeKitMapDevicesDto)
	data: HomeKitMapDevicesDto;
}
