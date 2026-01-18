import { Expose, Transform, Type } from 'class-transformer';
import {
	IsBoolean,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	Min,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { DeviceCategory } from '../../../modules/devices/devices.constants';

@ApiSchema({ name: 'DevicesSimulatorPluginGenerateDevice' })
export class GenerateDeviceDto {
	@ApiProperty({
		description: 'Device category to generate',
		enum: DeviceCategory,
		example: DeviceCategory.LIGHTING,
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"category","reason":"Category must be a valid device category."}]' })
	@IsEnum(DeviceCategory, { message: '[{"field":"category","reason":"Category must be a valid device category."}]' })
	category: DeviceCategory;

	@ApiProperty({
		description: 'Device name',
		type: 'string',
		example: 'Simulated Living Room Light',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	name: string;

	@ApiPropertyOptional({
		description: 'Device description',
		type: 'string',
		example: 'A simulated light device for testing',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"description","reason":"Description must be a valid string."}]' })
	description?: string | null;

	@ApiPropertyOptional({
		name: 'room_id',
		description: 'Room ID where this device is located',
		type: 'string',
		format: 'uuid',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"room_id","reason":"Room ID must be a valid UUID."}]' })
	room_id?: string | null;

	@ApiPropertyOptional({
		description: 'Whether to include only required channels',
		name: 'required_channels_only',
		type: 'boolean',
		default: false,
		example: false,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"required_channels_only","reason":"Required channels only must be a boolean."}]' })
	required_channels_only?: boolean;

	@ApiPropertyOptional({
		description: 'Whether to include only required properties in channels',
		name: 'required_properties_only',
		type: 'boolean',
		default: false,
		example: false,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({
		message: '[{"field":"required_properties_only","reason":"Required properties only must be a boolean."}]',
	})
	required_properties_only?: boolean;

	@ApiPropertyOptional({
		description: 'Whether to auto-simulate value changes',
		name: 'auto_simulate',
		type: 'boolean',
		default: false,
		example: false,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"auto_simulate","reason":"Auto simulate must be a boolean."}]' })
	auto_simulate?: boolean;

	@ApiPropertyOptional({
		description: 'Simulation interval in milliseconds (when auto_simulate is true)',
		name: 'simulate_interval',
		type: 'number',
		default: 5000,
		minimum: 1000,
		maximum: 60000,
		example: 5000,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"simulate_interval","reason":"Simulate interval must be an integer."}]' })
	@Min(1000, { message: '[{"field":"simulate_interval","reason":"Simulate interval must be at least 1000ms."}]' })
	@Max(60000, { message: '[{"field":"simulate_interval","reason":"Simulate interval must not exceed 60000ms."}]' })
	simulate_interval?: number;
}

@ApiSchema({ name: 'DevicesSimulatorPluginReqGenerateDevice' })
export class ReqGenerateDeviceDto {
	@ApiProperty({ description: 'Device generation data', type: () => GenerateDeviceDto })
	@Expose()
	@ValidateNested()
	@Type(() => GenerateDeviceDto)
	data: GenerateDeviceDto;
}
