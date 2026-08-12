import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

@ApiSchema({ name: 'DevicesWledPluginDataDiscoveredDevice' })
export class WledDiscoveredDeviceModel {
	@ApiProperty({ description: 'Device hostname or IP address', example: '192.168.1.100' })
	@Expose()
	@IsString()
	host: string;

	@ApiProperty({ description: 'Device name', example: 'WLED-Living-Room' })
	@Expose()
	@IsString()
	name: string;

	@ApiPropertyOptional({ description: 'Device MAC address', example: 'AA:BB:CC:DD:EE:FF', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	mac: string | null;

	@ApiProperty({ description: 'Device port', example: 80 })
	@Expose()
	@IsNumber()
	port: number;

	@ApiPropertyOptional({ description: 'Adopted Smart Panel device ID', nullable: true })
	@Expose({ name: 'adopted_device_id' })
	@IsOptional()
	@IsString()
	adoptedDeviceId: string | null;
}

@ApiSchema({ name: 'DevicesWledPluginDataDiscovery' })
export class WledDiscoveryModel {
	@ApiProperty({ description: 'Whether mDNS discovery is enabled' })
	@Expose({ name: 'mdns_enabled' })
	@IsBoolean()
	mdnsEnabled: boolean;

	@ApiProperty({ description: 'Whether the mDNS browser is running' })
	@Expose({ name: 'discovery_running' })
	@IsBoolean()
	discoveryRunning: boolean;

	@ApiProperty({ type: 'array', items: { $ref: getSchemaPath(WledDiscoveredDeviceModel) } })
	@Expose()
	@ValidateNested({ each: true })
	@Type(() => WledDiscoveredDeviceModel)
	devices: WledDiscoveredDeviceModel[];
}

@ApiSchema({ name: 'DevicesWledPluginDataAdoptionResult' })
export class WledAdoptionResultModel {
	@ApiProperty({ example: '192.168.1.100' })
	@Expose()
	@IsString()
	host: string;

	@ApiProperty({ example: 'Living room strip' })
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({ enum: ['created', 'failed'] })
	@Expose()
	@IsIn(['created', 'failed'])
	status: 'created' | 'failed';

	@ApiPropertyOptional({ nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	error: string | null;

	@ApiPropertyOptional({ description: 'Created Smart Panel device ID', nullable: true })
	@Expose({ name: 'device_id' })
	@IsOptional()
	@IsString()
	deviceId: string | null;
}

@ApiSchema({ name: 'DevicesWledPluginResDiscovery' })
export class WledDiscoveryResponseModel extends BaseSuccessResponseModel<WledDiscoveryModel> {
	@ApiProperty({ type: WledDiscoveryModel })
	@Expose()
	declare data: WledDiscoveryModel;
}

@ApiSchema({ name: 'DevicesWledPluginResProbedDevice' })
export class WledProbedDeviceResponseModel extends BaseSuccessResponseModel<WledDiscoveredDeviceModel> {
	@ApiProperty({ type: WledDiscoveredDeviceModel })
	@Expose()
	declare data: WledDiscoveredDeviceModel;
}

@ApiSchema({ name: 'DevicesWledPluginResAdoptionResults' })
export class WledAdoptionResultsResponseModel extends BaseSuccessResponseModel<WledAdoptionResultModel[]> {
	@ApiProperty({ type: 'array', items: { $ref: getSchemaPath(WledAdoptionResultModel) } })
	@Expose()
	declare data: WledAdoptionResultModel[];
}
