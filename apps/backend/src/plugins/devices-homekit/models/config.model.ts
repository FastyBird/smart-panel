import { Expose } from 'class-transformer';
import { IsArray, IsInt, IsString, Matches, Max, Min } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import {
	DEFAULT_HOMEKIT_BRIDGE_NAME,
	DEFAULT_HOMEKIT_PORT,
	DEVICES_HOMEKIT_PLUGIN_NAME,
	generateRandomHomeKitPin,
	generateRandomMacAddress,
	generateRandomSetupId,
} from '../devices-homekit.constants';

@ApiSchema({ name: 'DevicesHomeKitPluginDataConfig' })
export class HomeKitConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: DEVICES_HOMEKIT_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: typeof DEVICES_HOMEKIT_PLUGIN_NAME = DEVICES_HOMEKIT_PLUGIN_NAME;

	@ApiProperty({
		description: 'HomeKit Bridge display name visible in Apple Home app',
		type: 'string',
		example: DEFAULT_HOMEKIT_BRIDGE_NAME,
		name: 'bridge_name',
	})
	@Expose({ name: 'bridge_name' })
	@IsString()
	bridgeName: string = DEFAULT_HOMEKIT_BRIDGE_NAME;

	@ApiProperty({
		description: 'TCP port for the HomeKit Accessory Protocol server',
		type: 'integer',
		example: DEFAULT_HOMEKIT_PORT,
	})
	@Expose()
	@IsInt()
	@Min(1024)
	@Max(65535)
	port: number = DEFAULT_HOMEKIT_PORT;

	@ApiProperty({
		description: 'HomeKit pairing PIN code in standard XXX-XX-XXX format',
		type: 'string',
		example: '031-45-154',
	})
	@Expose()
	@IsString()
	@Matches(/^\d{3}-\d{2}-\d{3}$/, {
		message: 'PIN code must be in XXX-XX-XXX format (8 digits)',
	})
	pincode: string = generateRandomHomeKitPin();

	@ApiProperty({
		description: 'HomeKit Bridge unique username / MAC address',
		type: 'string',
		example: 'CC:22:3D:E3:CE:30',
	})
	@Expose()
	@IsString()
	@Matches(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/, {
		message: 'Username must be a MAC address in AA:BB:CC:DD:EE:FF format',
	})
	username: string = generateRandomMacAddress();

	@ApiProperty({
		description: 'HomeKit 4-character setup identifier',
		type: 'string',
		example: 'SP01',
		name: 'setup_id',
	})
	@Expose({ name: 'setup_id' })
	@IsString()
	@Matches(/^[0-9A-Z]{4}$/, {
		message: 'Setup ID must be exactly 4 uppercase alphanumeric characters',
	})
	setupId: string = generateRandomSetupId();

	@ApiProperty({
		description: 'List of Smart Panel device IDs bridged into HomeKit',
		type: [String],
		example: ['d290f1ee-6c54-4b01-90e6-d701748f0851'],
		name: 'mapped_device_ids',
	})
	@Expose({ name: 'mapped_device_ids' })
	@IsArray()
	@IsString({ each: true })
	mappedDeviceIds: string[] = [];
}
