import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import type { NativeClimateMode } from '../../../modules/devices/platforms/native-climate.contract';

@ApiSchema({ name: 'DevicesVirtualPluginDataNativeClimateRange' })
export class NativeClimateRangeModel {
	@ApiProperty({ type: 'number' })
	@Expose()
	minimum: number;
	@ApiProperty({ type: 'number' })
	@Expose()
	maximum: number;
	@ApiProperty({ type: 'number' })
	@Expose()
	step: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataNativeClimateCapabilities' })
export class NativeClimateCapabilitiesModel {
	@ApiProperty({ type: [String], enum: ['off', 'heat', 'cool', 'auto'] })
	@Expose()
	modes: readonly NativeClimateMode[];
	@ApiProperty({ type: NativeClimateRangeModel, nullable: true })
	@Expose()
	@Type(() => NativeClimateRangeModel)
	heating: NativeClimateRangeModel | null;
	@ApiProperty({ type: NativeClimateRangeModel, nullable: true })
	@Expose()
	@Type(() => NativeClimateRangeModel)
	cooling: NativeClimateRangeModel | null;
	@ApiProperty({ type: 'boolean' })
	@Expose()
	supportsCompound: boolean;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataNativeClimateRequest' })
export class NativeClimateRequestModel {
	@ApiPropertyOptional({ enum: ['off', 'heat', 'cool', 'auto'] })
	@Expose()
	mode?: NativeClimateMode;
	@ApiPropertyOptional({ type: 'number' })
	@Expose()
	heatingSetpoint?: number;
	@ApiPropertyOptional({ type: 'number' })
	@Expose()
	coolingSetpoint?: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataNativeClimateObservation' })
export class NativeClimateObservationModel {
	@ApiProperty({ type: 'boolean' })
	@Expose()
	available: boolean;
	@ApiProperty({ type: 'number', nullable: true })
	@Expose()
	temperature: number | null;
	@ApiProperty({
		type: 'string',
		nullable: true,
		description: 'Qualified observed off, heat, cool or auto; null when unknown.',
	})
	@Expose()
	mode: NativeClimateMode | null;
	@ApiProperty({ type: 'number', nullable: true })
	@Expose()
	heatingSetpoint: number | null;
	@ApiProperty({ type: 'number', nullable: true })
	@Expose()
	coolingSetpoint: number | null;
	@ApiProperty({
		type: 'string',
		nullable: true,
		description: 'Qualified heating, cooling or idle activity; null when unknown.',
	})
	@Expose()
	activity: 'heating' | 'cooling' | 'idle' | null;
	@ApiProperty({ type: 'string', format: 'date-time', nullable: true })
	@Expose()
	observedAt: string | null;
	@ApiProperty({ type: [String] })
	@Expose()
	reasons: readonly string[];
}

@ApiSchema({ name: 'DevicesVirtualPluginDataNativeClimateOperation' })
export class NativeClimateOperationModel {
	@ApiProperty({ type: 'string' })
	@Expose()
	operation: string;
	@ApiProperty({ enum: ['accepted', 'refused', 'unknown'] })
	@Expose()
	outcome: 'accepted' | 'refused' | 'unknown';
	@ApiPropertyOptional({ type: 'string' })
	@Expose()
	reason?: string;
	@ApiProperty({
		type: 'boolean',
		example: false,
		description: 'Always false: transport outcomes do not prove physical completion.',
	})
	@Expose()
	confirmed: false;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataNativeThermostatRequest' })
export class NativeThermostatRequestModel {
	@ApiProperty({ type: 'string', format: 'uuid' })
	@Expose()
	id: string;
	@ApiProperty({ type: 'number' })
	@Expose()
	revision: number;
	@ApiProperty({ enum: ['pending', 'settled', 'interrupted'] })
	@Expose()
	state: 'pending' | 'settled' | 'interrupted';
	@ApiProperty({ type: NativeClimateRequestModel })
	@Expose()
	@Type(() => NativeClimateRequestModel)
	request: NativeClimateRequestModel;
	@ApiProperty({ type: [NativeClimateOperationModel] })
	@Expose()
	@Type(() => NativeClimateOperationModel)
	operations: NativeClimateOperationModel[];
	@ApiProperty({ type: 'string', format: 'date-time' })
	@Expose()
	created_at: string;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataNativeThermostatProperties' })
export class NativeThermostatPropertiesModel {
	@ApiPropertyOptional({ type: 'string', format: 'uuid' })
	@Expose()
	mode?: string;
	@ApiPropertyOptional({ type: 'string', format: 'uuid' })
	@Expose()
	locked?: string;
	@ApiPropertyOptional({ type: 'string', format: 'uuid' })
	@Expose()
	temperature?: string;
	@ApiPropertyOptional({ type: 'string', format: 'uuid' })
	@Expose()
	heating_setpoint?: string;
	@ApiPropertyOptional({ type: 'string', format: 'uuid' })
	@Expose()
	cooling_setpoint?: string;
	@ApiPropertyOptional({ type: 'string', format: 'uuid' })
	@Expose()
	heating_enabled?: string;
	@ApiPropertyOptional({ type: 'string', format: 'uuid' })
	@Expose()
	cooling_enabled?: string;
	@ApiPropertyOptional({ type: 'string', format: 'uuid' })
	@Expose()
	heating_activity?: string;
	@ApiPropertyOptional({ type: 'string', format: 'uuid' })
	@Expose()
	cooling_activity?: string;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataNativeClimateCandidate' })
export class NativeClimateCandidateModel {
	@ApiProperty({ type: 'string', format: 'uuid' })
	@Expose()
	device: string;
	@ApiProperty({ type: 'string' })
	@Expose()
	name: string;
	@ApiProperty({ enum: ['home-assistant', 'zigbee2mqtt'] })
	@Expose()
	provider: 'home-assistant' | 'zigbee2mqtt';
	@ApiProperty({ type: 'string' })
	@Expose()
	physical_identity: string;
	@ApiProperty({ type: 'string' })
	@Expose()
	fingerprint: string;
	@ApiProperty({ type: NativeClimateCapabilitiesModel })
	@Expose()
	@Type(() => NativeClimateCapabilitiesModel)
	capabilities: NativeClimateCapabilitiesModel;
	@ApiProperty({ type: [String] })
	@Expose()
	reasons: readonly string[];
}

@ApiSchema({ name: 'DevicesVirtualPluginDataNativeThermostat' })
export class NativeThermostatModel {
	@ApiProperty({ type: 'array', items: { type: 'string', enum: ['mode', 'heating_setpoint', 'cooling_setpoint'] } })
	@Expose()
	drift: ('mode' | 'heating_setpoint' | 'cooling_setpoint')[];

	@ApiProperty({ enum: ['bound', 'releasing', 'released'] })
	@Expose()
	binding_state: 'bound' | 'releasing' | 'released';

	@ApiProperty({ type: 'string', format: 'uuid', nullable: true })
	@Expose()
	controller: string | null;
	@ApiProperty({ enum: ['native_unit'] })
	@Expose()
	control_strategy: 'native_unit';
	@ApiProperty({ type: 'number' })
	@Expose()
	revision: number;
	@ApiProperty({ type: 'string', format: 'uuid' })
	@Expose()
	source_device: string;
	@ApiProperty({ enum: ['home-assistant', 'zigbee2mqtt'] })
	@Expose()
	provider: 'home-assistant' | 'zigbee2mqtt';
	@ApiProperty({ type: 'string' })
	@Expose()
	physical_identity: string;
	@ApiProperty({ type: 'string' })
	@Expose()
	fingerprint: string;
	@ApiProperty({ type: NativeClimateRequestModel })
	@Expose()
	@Type(() => NativeClimateRequestModel)
	requested: NativeClimateRequestModel;
	@ApiProperty({ type: NativeClimateObservationModel })
	@Expose()
	@Type(() => NativeClimateObservationModel)
	observed: NativeClimateObservationModel;
	@ApiProperty({ type: NativeClimateCapabilitiesModel, nullable: true })
	@Expose()
	@Type(() => NativeClimateCapabilitiesModel)
	capabilities: NativeClimateCapabilitiesModel | null;
	@ApiProperty({ type: NativeThermostatPropertiesModel })
	@Expose()
	@Type(() => NativeThermostatPropertiesModel)
	properties: NativeThermostatPropertiesModel;
	@ApiProperty({ type: NativeThermostatRequestModel, nullable: true })
	@Expose()
	@Type(() => NativeThermostatRequestModel)
	latest_request: NativeThermostatRequestModel | null;
}

@ApiSchema({ name: 'DevicesVirtualPluginResNativeThermostat' })
export class NativeThermostatResponseModel extends BaseSuccessResponseModel<NativeThermostatModel> {
	@ApiProperty({ type: NativeThermostatModel })
	@Expose()
	@Type(() => NativeThermostatModel)
	declare data: NativeThermostatModel;
}

@ApiSchema({ name: 'DevicesVirtualPluginResNativeClimateCandidates' })
export class NativeClimateCandidatesResponseModel extends BaseSuccessResponseModel<NativeClimateCandidateModel[]> {
	@ApiProperty({ type: [NativeClimateCandidateModel] })
	@Expose()
	@Type(() => NativeClimateCandidateModel)
	declare data: NativeClimateCandidateModel[];
}
