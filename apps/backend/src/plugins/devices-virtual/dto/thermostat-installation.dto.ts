import { Type } from 'class-transformer';
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

@ApiSchema({ name: 'DevicesVirtualPluginStageThermostatInstallation' })
export class StageThermostatInstallationDto {
	@ApiProperty() @IsInt() @Min(0) expected_revision: number;
	@ApiProperty({ type: ThermostatGuardSetupDto })
	@ValidateNested()
	@Type(() => ThermostatGuardSetupDto)
	setup: ThermostatGuardSetupDto;
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
