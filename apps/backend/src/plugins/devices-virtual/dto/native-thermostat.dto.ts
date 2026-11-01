import { Expose } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import type { NativeClimateMode } from '../../../modules/devices/platforms/native-climate.contract';

@ApiSchema({ name: 'DevicesVirtualPluginCreateNativeThermostat' })
export class CreateNativeThermostatDto {
	@ApiProperty()
	@Expose()
	@IsString()
	@IsNotEmpty()
	name: string;
	@ApiProperty({ name: 'source_device', format: 'uuid' })
	@Expose({ name: 'source_device' })
	@IsUUID('4')
	sourceDevice: string;
	@ApiPropertyOptional({ format: 'uuid' })
	@Expose()
	@IsOptional()
	@IsUUID('4')
	room?: string;
	@ApiPropertyOptional({ name: 'expected_graph_revision', minimum: 0 })
	@Expose({ name: 'expected_graph_revision' })
	@IsOptional()
	@IsInt()
	@Min(0)
	expectedGraphRevision?: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginUpdateNativeThermostat' })
export class UpdateNativeThermostatDto {
	@ApiProperty({ name: 'source_device', format: 'uuid' })
	@Expose({ name: 'source_device' })
	@IsUUID('4')
	sourceDevice: string;
	@ApiProperty({ name: 'expected_revision', minimum: 1 })
	@Expose({ name: 'expected_revision' })
	@IsInt()
	@Min(1)
	expectedRevision: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginRequestNativeThermostat' })
export class RequestNativeThermostatDto {
	@ApiProperty({ name: 'request_id', format: 'uuid' })
	@Expose({ name: 'request_id' })
	@IsUUID('4')
	requestId: string;
	@ApiProperty({ name: 'expected_revision', minimum: 1 })
	@Expose({ name: 'expected_revision' })
	@IsInt()
	@Min(1)
	expectedRevision: number;
	@ApiPropertyOptional({ enum: ['off', 'heat', 'cool', 'auto'] })
	@Expose()
	@IsOptional()
	@IsIn(['off', 'heat', 'cool', 'auto'])
	mode?: NativeClimateMode;
	@ApiPropertyOptional({ name: 'heating_setpoint' })
	@Expose({ name: 'heating_setpoint' })
	@IsOptional()
	@IsNumber({ allowNaN: false, allowInfinity: false })
	heatingSetpoint?: number;
	@ApiPropertyOptional({ name: 'cooling_setpoint' })
	@Expose({ name: 'cooling_setpoint' })
	@IsOptional()
	@IsNumber({ allowNaN: false, allowInfinity: false })
	coolingSetpoint?: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginReleaseNativeThermostat' })
export class ReleaseNativeThermostatDto {
	@ApiProperty({ name: 'expected_revision', minimum: 1 })
	@Expose({ name: 'expected_revision' })
	@IsInt()
	@Min(1)
	expectedRevision: number;
}
