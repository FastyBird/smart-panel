import { Expose, Transform } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayUnique,
	IsArray,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
	Max,
	Min,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { DEVICES_HOMEKIT_PLUGIN_NAME } from '../devices-homekit.constants';

@ApiSchema({ name: 'DevicesHomeKitPluginUpdateConfig' })
export class HomeKitUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	@ApiProperty({
		description: 'Plugin type identifier',
		example: DEVICES_HOMEKIT_PLUGIN_NAME,
	})
	type: typeof DEVICES_HOMEKIT_PLUGIN_NAME;

	@Expose({ name: 'bridge_name' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsString({ message: '[{"field":"bridge_name","reason":"Bridge name must be a valid string."}]' })
	@ApiPropertyOptional({
		description: 'HomeKit Bridge display name visible in Apple Home app',
		example: 'Smart Panel Bridge',
		name: 'bridge_name',
	})
	bridge_name?: string;

	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"port","reason":"Port must be a valid integer."}]' })
	@Min(1024)
	@Max(65535)
	@ApiPropertyOptional({
		description: 'TCP port for the HomeKit Accessory Protocol server',
		example: 51826,
	})
	port?: number;

	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsString({ message: '[{"field":"pincode","reason":"PIN code must be a valid string."}]' })
	@Matches(/^\d{3}-\d{2}-\d{3}$/, {
		message: '[{"field":"pincode","reason":"PIN code must be in format XXX-XX-XXX."}]',
	})
	@ApiPropertyOptional({
		description: 'HomeKit pairing PIN code in standard XXX-XX-XXX format',
		example: '031-45-154',
	})
	pincode?: string;

	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsString({ message: '[{"field":"username","reason":"Username must be a valid string."}]' })
	@Matches(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/, {
		message: '[{"field":"username","reason":"Username must be a MAC address in AA:BB:CC:DD:EE:FF format."}]',
	})
	@ApiPropertyOptional({
		description: 'HomeKit Bridge unique username / MAC address',
		example: 'CC:22:3D:E3:CE:30',
	})
	username?: string;

	@Expose({ name: 'setup_id' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsString({ message: '[{"field":"setup_id","reason":"Setup ID must be a valid string."}]' })
	@Matches(/^[0-9A-Z]{4}$/, {
		message: '[{"field":"setup_id","reason":"Setup ID must be exactly 4 uppercase alphanumeric characters."}]',
	})
	@ApiPropertyOptional({
		description: 'HomeKit 4-character setup identifier',
		example: 'SP01',
		name: 'setup_id',
	})
	setup_id?: string;

	@Expose({ name: 'mapped_device_ids' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsArray({ message: '[{"field":"mapped_device_ids","reason":"Device IDs must be an array."}]' })
	@IsUUID('4', {
		each: true,
		message: '[{"field":"mapped_device_ids","reason":"Each device ID must be a valid UUID v4."}]',
	})
	@ArrayMaxSize(149, {
		message:
			'[{"field":"mapped_device_ids","reason":"Maximum 149 accessories can be bridged to a single HomeKit bridge."}]',
	})
	@ArrayUnique({
		message: '[{"field":"mapped_device_ids","reason":"Device IDs must be unique."}]',
	})
	@ApiPropertyOptional({
		description: 'List of Smart Panel device IDs bridged into HomeKit',
		type: [String],
		example: ['d290f1ee-6c54-4b01-90e6-d701748f0851'],
		name: 'mapped_device_ids',
	})
	mapped_device_ids?: string[];
}
