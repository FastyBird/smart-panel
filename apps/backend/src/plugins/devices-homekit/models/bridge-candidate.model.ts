import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

@ApiSchema({ name: 'DevicesHomeKitPluginDataDeviceCandidate' })
export class HomeKitDeviceCandidateModel {
	@ApiProperty({
		description: 'Smart Panel device identifier',
		type: 'string',
		example: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
	})
	@Expose()
	@IsString()
	id: string;

	@ApiProperty({
		description: 'Device display name',
		type: 'string',
		example: 'Ceiling Light',
	})
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({
		description: 'Smart Panel device category',
		type: 'string',
		example: 'lighting',
	})
	@Expose()
	@IsString()
	category: string;

	@ApiPropertyOptional({
		description: 'Room/space name the device is placed in, if assigned',
		type: 'string',
		nullable: true,
		example: 'Living Room',
		name: 'room_name',
	})
	@Expose({ name: 'room_name' })
	@IsOptional()
	@IsString()
	roomName: string | null = null;

	@ApiPropertyOptional({
		description: 'Room/space ID the device is placed in, if assigned',
		type: 'string',
		nullable: true,
		example: 'a123f1ee-6c54-4b01-90e6-d701748f0899',
		name: 'room_id',
	})
	@Expose({ name: 'room_id' })
	@IsOptional()
	@IsString()
	roomId: string | null = null;

	@ApiProperty({
		description: 'Whether the device is compatible with HomeKit mapping',
		type: 'boolean',
		example: true,
		name: 'is_compatible',
	})
	@Expose({ name: 'is_compatible' })
	@IsBoolean()
	isCompatible: boolean = false;

	@ApiPropertyOptional({
		description:
			'Suggested HomeKit service type (e.g. lightbulb, switch, outlet, thermostat, sensor, window_covering, lock)',
		type: 'string',
		nullable: true,
		example: 'lightbulb',
		name: 'suggested_service_type',
	})
	@Expose({ name: 'suggested_service_type' })
	@IsOptional()
	@IsString()
	suggestedServiceType: string | null = null;

	@ApiProperty({
		description: 'Whether this device is currently mapped/bridged to HomeKit',
		type: 'boolean',
		example: true,
		name: 'is_mapped',
	})
	@Expose({ name: 'is_mapped' })
	@IsBoolean()
	isMapped: boolean = false;

	@ApiProperty({
		description: 'Number of channels on this device',
		type: 'integer',
		example: 2,
		name: 'channels_count',
	})
	@Expose({ name: 'channels_count' })
	@IsInt()
	channelsCount: number = 0;
}

@ApiSchema({ name: 'DevicesHomeKitPluginResCandidates' })
export class HomeKitCandidatesResponseModel extends BaseSuccessResponseModel<HomeKitDeviceCandidateModel[]> {
	@ApiProperty({
		description: 'List of device candidates with compatibility and mapping status',
		type: () => [HomeKitDeviceCandidateModel],
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => HomeKitDeviceCandidateModel)
	declare data: HomeKitDeviceCandidateModel[];
}
