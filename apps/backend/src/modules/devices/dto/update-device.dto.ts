import { Expose, Transform, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { DeviceCategory } from '../devices.constants';

@ApiSchema({ name: 'DevicesModuleUpdateDevice' })
export class UpdateDeviceDto {
	@ApiProperty({ description: 'Device type', type: 'string', example: 'generic' })
	@Expose()
	@IsNotEmpty({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported device type."}]',
	})
	@IsString({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported device type."}]',
	})
	type: string;

	@ApiPropertyOptional({
		description: 'Device category',
		enum: DeviceCategory,
		example: DeviceCategory.GENERIC,
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({
		message: '[{"field":"category","reason":"Category must be a valid device category."}]',
	})
	@IsEnum(DeviceCategory, {
		message: '[{"field":"category","reason":"Category must be a valid device category."}]',
	})
	category?: DeviceCategory;

	@ApiPropertyOptional({
		description: 'Device identifier',
		type: 'string',
		nullable: true,
		example: 'device-001',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({
		message:
			'[{"field":"identifier","reason":"Identifier must be a valid string representing device unique identifier."}]',
	})
	@IsString({
		message:
			'[{"field":"identifier","reason":"Identifier must be a valid string representing device unique identifier."}]',
	})
	@ValidateIf((_, value) => value !== null)
	identifier?: string | null;

	@ApiPropertyOptional({ description: 'Device name', type: 'string', example: 'My Device' })
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a valid string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a valid string."}]' })
	name?: string;

	@ApiPropertyOptional({
		description: 'Device description',
		type: 'string',
		example: 'Device description',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"description","reason":"Description must be a valid string."}]' })
	@IsString({ message: '[{"field":"description","reason":"Description must be a valid string."}]' })
	@ValidateIf((_, value) => value !== null)
	description?: string | null;

	@ApiPropertyOptional({ description: 'Device enabled status', type: 'boolean', example: true })
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled attribute must be a valid true or false."}]' })
	enabled?: boolean;

	@ApiPropertyOptional({
		name: 'room_id',
		description: 'Room ID where this device is physically located (must be a space with type=room)',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose({ name: 'room_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"room_id","reason":"Room ID must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => value !== null)
	@Transform(({ obj }: { obj: { room_id?: string | null; roomId?: string | null } }) => obj.room_id ?? obj.roomId, {
		toClassOnly: true,
	})
	roomId?: string | null;

	@ApiPropertyOptional({
		name: 'zone_ids',
		description: 'Zone IDs this device belongs to (only non-floor zones allowed)',
		type: 'array',
		items: { type: 'string', format: 'uuid' },
		example: ['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6'],
	})
	@Expose({ name: 'zone_ids' })
	@IsOptional()
	@IsArray({ message: '[{"field":"zone_ids","reason":"Zone IDs must be an array."}]' })
	@IsUUID('4', { each: true, message: '[{"field":"zone_ids","reason":"Each zone ID must be a valid UUID."}]' })
	@Transform(({ obj }: { obj: { zone_ids?: string[]; zoneIds?: string[] } }) => obj.zone_ids ?? obj.zoneIds, {
		toClassOnly: true,
	})
	zoneIds?: string[];
}

@ApiSchema({ name: 'DevicesModuleReqUpdateDevice' })
export class ReqUpdateDeviceDto {
	@ApiProperty({ description: 'Device data', type: () => UpdateDeviceDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdateDeviceDto)
	data: UpdateDeviceDto;
}
