import { Expose, Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import {
	THERMOSTAT_ATTESTATION_KINDS,
	ThermostatGuardSetup,
	ThermostatOperatorAttestation,
} from '../services/thermostat-installation.types';

@ApiSchema({ name: 'DevicesVirtualPluginThermostatInstallationRange' })
export class ThermostatInstallationRangeDto {
	@ApiProperty({}) @IsNumber() minimum: number;
	@ApiProperty({}) @IsNumber() maximum: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginThermostatFloorConversion' })
export class ThermostatFloorConversionDto {
	@ApiProperty({ enum: ['steinhart_hart'] }) @IsIn(['steinhart_hart']) kind: 'steinhart_hart';
	@ApiProperty({}) @IsNumber() referenceVoltage: number;
	@ApiProperty({}) @IsNumber() seriesResistance: number;
	@ApiProperty({}) @IsNumber() a: number;
	@ApiProperty({}) @IsNumber() b: number;
	@ApiProperty({}) @IsNumber() c: number;
	@ApiProperty({ enum: ['low', 'high'] }) @IsIn(['low', 'high']) thermistorLeg: 'low' | 'high';
	@ApiProperty({ type: ThermostatInstallationRangeDto })
	@ValidateNested()
	@Type(() => ThermostatInstallationRangeDto)
	inputRange: ThermostatInstallationRangeDto;
	@ApiProperty({ type: ThermostatInstallationRangeDto })
	@ValidateNested()
	@Type(() => ThermostatInstallationRangeDto)
	outputRange: ThermostatInstallationRangeDto;
}

@ApiSchema({ name: 'DevicesVirtualPluginThermostatGuardSetup' })
export class ThermostatGuardSetupDto implements ThermostatGuardSetup {
	@ApiProperty({}) @IsString() deviceHardwareId: string;
	@ApiProperty({}) @IsString() firmware: string;
	@ApiProperty({}) @IsString() endpointHostname: string;
	@ApiProperty({}) @IsNumber() scriptId: number;
	@ApiProperty({}) @IsString() epochKey: string;
	@ApiProperty({
		type: ThermostatInstallationRangeDto,
		nullable: true,
		description: 'Explicit installed comfort range; null only for an absent branch',
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => ThermostatInstallationRangeDto)
	heatingSetpointRange: ThermostatInstallationRangeDto | null;
	@ApiProperty({
		type: ThermostatInstallationRangeDto,
		nullable: true,
		description: 'Explicit installed comfort range; null only for an absent branch',
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => ThermostatInstallationRangeDto)
	coolingSetpointRange: ThermostatInstallationRangeDto | null;
	@ApiProperty({}) @IsNumber() minimumLeaseSeconds: number;
	@ApiProperty({}) @IsNumber() maximumLeaseSeconds: number;
	@ApiProperty({}) @IsNumber() watchdogMs: number;
	@ApiProperty({}) @IsNumber() floorMaximumAgeMs: number;
	@ApiProperty({ enum: ['temperature', 'voltmeter', 'input'] })
	@IsIn(['temperature', 'voltmeter', 'input'])
	floorComponentType: 'temperature' | 'voltmeter' | 'input';
	@ApiProperty({}) @IsNumber() floorComponentId: number;
	@ApiProperty({ enum: ['tC', 'xvoltage', 'xpercent', 'voltage'] })
	@IsIn(['tC', 'xvoltage', 'xpercent', 'voltage'])
	floorAttribute: 'tC' | 'xvoltage' | 'xpercent' | 'voltage';
	@ApiProperty({}) @IsString() floorConfigurationJson: string;
	@ApiProperty({}) @IsString() switchConfigurationJson: string;
	@ApiProperty() @IsString() peripheralsJson: string;
	@ApiPropertyOptional({ type: ThermostatFloorConversionDto })
	@IsOptional()
	@ValidateNested()
	@Type(() => ThermostatFloorConversionDto)
	floorConversion?: ThermostatFloorConversionDto;
}

@ApiSchema({ name: 'DevicesVirtualPluginThermostatOperatorAttestation' })
export class ThermostatOperatorAttestationDto implements ThermostatOperatorAttestation {
	@ApiProperty({ enum: THERMOSTAT_ATTESTATION_KINDS })
	@IsIn(THERMOSTAT_ATTESTATION_KINDS)
	kind: ThermostatOperatorAttestation['kind'];
	@ApiProperty({}) @IsString() equipment: string;
	@ApiProperty({}) @IsString() procedure: string;
	@ApiProperty({}) @IsString() evidenceReference: string;
	@ApiProperty({}) @IsString() testedAt: string;
	@ApiPropertyOptional({}) @IsOptional() @IsNumber() maximumObservedMs?: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginThermostatMemberGuardSetup' })
export class ThermostatMemberGuardSetupDto {
	@ApiProperty({ name: 'format_version', enum: [2], description: 'Explicit per-member installation format' })
	@Expose({ name: 'format_version' })
	@IsIn([2])
	formatVersion: 2;
	@ApiProperty({
		name: 'installed_floor_ceiling_c',
		description: 'Reviewed local hardware ceiling in Celsius; artifact enforces min(requested, ceiling)',
	})
	@Expose({ name: 'installed_floor_ceiling_c' })
	@IsNumber()
	installedFloorCeilingC: number;
	@ApiProperty({ name: 'device_hardware_id', description: 'Exact physical device identity' })
	@Expose({ name: 'device_hardware_id' })
	@IsString()
	deviceHardwareId: string;
	@ApiProperty({ description: 'Reviewed device firmware' }) @Expose() @IsString() firmware: string;
	@ApiProperty({ name: 'endpoint_hostname', description: 'Authenticated device endpoint' })
	@Expose({ name: 'endpoint_hostname' })
	@IsString()
	endpointHostname: string;
	@ApiProperty({ name: 'script_id', description: 'Reviewed script slot' })
	@Expose({ name: 'script_id' })
	@IsInt()
	scriptId: number;
	@ApiProperty({ name: 'epoch_key', description: 'Persistent guarded epoch key' })
	@Expose({ name: 'epoch_key' })
	@IsString()
	epochKey: string;
	@ApiProperty({
		name: 'heating_setpoint_range',
		type: ThermostatInstallationRangeDto,
		nullable: true,
		description: 'Reviewed comfort bounds or null for absent branch',
	})
	@Expose({ name: 'heating_setpoint_range' })
	@IsOptional()
	@ValidateNested()
	@Type(() => ThermostatInstallationRangeDto)
	heatingSetpointRange: ThermostatInstallationRangeDto | null;
	@ApiProperty({
		name: 'cooling_setpoint_range',
		type: ThermostatInstallationRangeDto,
		nullable: true,
		description: 'Reviewed comfort bounds or null for absent branch',
	})
	@Expose({ name: 'cooling_setpoint_range' })
	@IsOptional()
	@ValidateNested()
	@Type(() => ThermostatInstallationRangeDto)
	coolingSetpointRange: ThermostatInstallationRangeDto | null;
	@ApiProperty({ name: 'minimum_lease_seconds', description: 'Qualified minimum lease' })
	@Expose({ name: 'minimum_lease_seconds' })
	@IsInt()
	minimumLeaseSeconds: number;
	@ApiProperty({ name: 'maximum_lease_seconds', description: 'Qualified maximum lease' })
	@Expose({ name: 'maximum_lease_seconds' })
	@IsInt()
	maximumLeaseSeconds: number;
	@ApiProperty({ name: 'watchdog_ms', description: 'Qualified local watchdog bound' })
	@Expose({ name: 'watchdog_ms' })
	@IsInt()
	watchdogMs: number;
	@ApiProperty({ name: 'switch_configuration_json', description: 'Reviewed native switch writer/restart snapshot' })
	@Expose({ name: 'switch_configuration_json' })
	@IsString()
	switchConfigurationJson: string;
}

@ApiSchema({ name: 'DevicesVirtualPluginStageThermostatInstallation' })
export class StageThermostatInstallationDto {
	@ApiPropertyOptional({ description: 'Current controller revision reviewed by the authoring client' })
	@IsOptional()
	@IsInt()
	@Min(1)
	expected_configuration_revision?: number;
	@ApiPropertyOptional({ description: 'Current claim revision reviewed by the authoring client' })
	@IsOptional()
	@IsInt()
	@Min(1)
	expected_claim_revision?: number;
	@ApiPropertyOptional({
		type: String,
		nullable: true,
		description: 'Current recovery qualification generation reviewed by the authoring client',
	})
	@IsOptional()
	@IsString()
	expected_qualification_generation?: string | null;

	@ApiProperty() @IsInt() @Min(0) expected_revision: number;
	@ApiPropertyOptional({
		type: ThermostatMemberGuardSetupDto,
		description: 'Version two member setup; mutually exclusive with legacy setup',
	})
	@Expose({ name: 'member_setup' })
	@IsOptional()
	@ValidateNested()
	@Type(() => ThermostatMemberGuardSetupDto)
	member_setup?: ThermostatMemberGuardSetupDto;
	@ApiPropertyOptional({
		type: ThermostatGuardSetupDto,
		description: 'Legacy singleton setup; mutually exclusive with member_setup',
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => ThermostatGuardSetupDto)
	setup?: ThermostatGuardSetupDto;
	@ApiProperty({ type: [ThermostatOperatorAttestationDto] })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ThermostatOperatorAttestationDto)
	operator_attestations: ThermostatOperatorAttestationDto[];
}

@ApiSchema({ name: 'DevicesVirtualPluginInspectThermostatInstallation' })
export class ThermostatInstallationRevisionDto {
	@ApiProperty() @IsInt() @Min(1) expected_revision: number;
}
