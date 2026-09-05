import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

@ApiSchema({ name: 'DevicesHomeKitPluginDataBridgeStatus' })
export class HomeKitBridgeStatusModel {
	@ApiProperty({
		description: 'Whether the HomeKit HAP server is running',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	running: boolean = false;

	@ApiProperty({
		description: 'Whether the HomeKit bridge is paired with at least one Apple Home controller',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@IsBoolean()
	paired: boolean = false;

	@ApiProperty({
		description: 'Number of Apple Home controllers paired with this bridge',
		type: 'integer',
		example: 0,
		name: 'paired_clients_count',
	})
	@Expose({ name: 'paired_clients_count' })
	@IsInt()
	pairedClientsCount: number = 0;

	@ApiProperty({
		description: 'Display name of the bridge in Apple Home',
		type: 'string',
		example: 'Smart Panel Bridge',
		name: 'bridge_name',
	})
	@Expose({ name: 'bridge_name' })
	@IsString()
	bridgeName: string = '';

	@ApiProperty({
		description: 'TCP port on which HAP server is listening',
		type: 'integer',
		example: 51826,
	})
	@Expose()
	@IsInt()
	port: number = 51826;

	@ApiProperty({
		description: 'HomeKit pairing PIN code in XXX-XX-XXX format',
		type: 'string',
		example: '031-45-154',
	})
	@Expose()
	@IsString()
	pincode: string = '';

	@ApiProperty({
		description: 'Bridge MAC / username identifier for mDNS',
		type: 'string',
		example: 'CC:22:3D:E3:CE:30',
	})
	@Expose()
	@IsString()
	username: string = '';

	@ApiProperty({
		description: 'Apple HomeKit X-HM:// setup URI payload for pairing QR code',
		type: 'string',
		example: 'X-HM://0024R932WSP01',
		name: 'setup_uri',
	})
	@Expose({ name: 'setup_uri' })
	@IsString()
	setupUri: string = '';

	@ApiProperty({
		description: 'Data URL (data:image/svg+xml;utf8,... or png) containing the pairing QR code',
		type: 'string',
		example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
		name: 'qr_code_data_uri',
	})
	@Expose({ name: 'qr_code_data_uri' })
	@IsString()
	qrCodeDataUri: string = '';

	@ApiProperty({
		description: 'Total number of Smart Panel devices currently bridged into Apple Home',
		type: 'integer',
		example: 5,
		name: 'exposed_devices_count',
	})
	@Expose({ name: 'exposed_devices_count' })
	@IsInt()
	exposedDevicesCount: number = 0;
}

@ApiSchema({ name: 'DevicesHomeKitPluginResBridgeStatus' })
export class HomeKitBridgeStatusResponseModel extends BaseSuccessResponseModel<HomeKitBridgeStatusModel> {
	@ApiProperty({
		description: 'Bridge runtime status payload',
		type: () => HomeKitBridgeStatusModel,
	})
	@Expose()
	@ValidateNested()
	@Type(() => HomeKitBridgeStatusModel)
	declare data: HomeKitBridgeStatusModel;
}
