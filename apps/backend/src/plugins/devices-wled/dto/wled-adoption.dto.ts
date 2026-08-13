import { Expose, Type } from 'class-transformer';
import {
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsDefined,
	IsIn,
	IsNotEmpty,
	IsObject,
	IsOptional,
	IsString,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { DeviceCategory } from '../../../modules/devices/devices.constants';

@ApiSchema({ name: 'DevicesWledPluginProbe' })
export class WledProbeDto {
	@ApiProperty({ description: 'WLED hostname or IP address', example: '192.168.1.100' })
	@Expose()
	@IsString()
	@IsNotEmpty()
	host: string;
}

@ApiSchema({ name: 'DevicesWledPluginReqProbe' })
export class WledProbeRequestDto {
	@ApiProperty({ type: WledProbeDto })
	@Expose()
	@IsDefined()
	@IsObject()
	@ValidateNested()
	@Type(() => WledProbeDto)
	data: WledProbeDto;
}

@ApiSchema({ name: 'DevicesWledPluginAdoptDevice' })
export class WledAdoptDeviceDto extends WledProbeDto {
	@ApiProperty({ description: 'Device name', example: 'Living room strip' })
	@Expose()
	@IsString()
	@IsNotEmpty()
	name: string;

	@ApiProperty({ enum: [DeviceCategory.LIGHTING], example: DeviceCategory.LIGHTING })
	@Expose()
	@IsIn([DeviceCategory.LIGHTING])
	category: DeviceCategory.LIGHTING;

	@ApiProperty({ description: 'Optional device description', nullable: true, required: false })
	@Expose()
	@IsOptional()
	@IsString()
	description?: string | null;

	@ApiProperty({ description: 'Whether the adopted device is enabled', default: true, required: false })
	@Expose()
	@IsOptional()
	@IsBoolean()
	enabled?: boolean;
}

@ApiSchema({ name: 'DevicesWledPluginAdopt' })
export class WledAdoptDto {
	@ApiProperty({ type: [WledAdoptDeviceDto] })
	@Expose()
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => WledAdoptDeviceDto)
	devices: WledAdoptDeviceDto[];
}

@ApiSchema({ name: 'DevicesWledPluginReqAdopt' })
export class WledAdoptRequestDto {
	@ApiProperty({ type: WledAdoptDto })
	@Expose()
	@IsDefined()
	@IsObject()
	@ValidateNested()
	@Type(() => WledAdoptDto)
	data: WledAdoptDto;
}
