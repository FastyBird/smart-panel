import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import {
	THERMOSTAT_ATTESTATION_KINDS,
	ThermostatGuardSetup,
	ThermostatOperatorAttestation,
} from '../services/thermostat-installation.types';

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatInstallationRange' })
export class ThermostatInstallationRangeModel {
	@ApiProperty({}) @Expose() minimum: number;
	@ApiProperty({}) @Expose() maximum: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatFloorConversion' })
export class ThermostatFloorConversionModel {
	@ApiProperty({ enum: ['steinhart_hart'] }) @Expose() kind: 'steinhart_hart';
	@ApiProperty({}) @Expose() referenceVoltage: number;
	@ApiProperty({}) @Expose() seriesResistance: number;
	@ApiProperty({}) @Expose() a: number;
	@ApiProperty({}) @Expose() b: number;
	@ApiProperty({}) @Expose() c: number;
	@ApiProperty({ enum: ['low', 'high'] }) @Expose() thermistorLeg: 'low' | 'high';
	@ApiProperty({ type: ThermostatInstallationRangeModel })
	@Expose()
	@Type(() => ThermostatInstallationRangeModel)
	inputRange: ThermostatInstallationRangeModel;
	@ApiProperty({ type: ThermostatInstallationRangeModel })
	@Expose()
	@Type(() => ThermostatInstallationRangeModel)
	outputRange: ThermostatInstallationRangeModel;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatGuardSetup' })
export class ThermostatGuardSetupModel implements ThermostatGuardSetup {
	@ApiProperty({}) @Expose() deviceHardwareId: string;
	@ApiProperty({}) @Expose() firmware: string;
	@ApiProperty({}) @Expose() endpointHostname: string;
	@ApiProperty({}) @Expose() scriptId: number;
	@ApiProperty({}) @Expose() epochKey: string;
	@ApiProperty({
		type: ThermostatInstallationRangeModel,
		nullable: true,
		description: 'Explicit installed comfort range; null only for an absent branch',
	})
	@Expose()
	@Type(() => ThermostatInstallationRangeModel)
	heatingSetpointRange: ThermostatInstallationRangeModel | null;
	@ApiProperty({
		type: ThermostatInstallationRangeModel,
		nullable: true,
		description: 'Explicit installed comfort range; null only for an absent branch',
	})
	@Expose()
	@Type(() => ThermostatInstallationRangeModel)
	coolingSetpointRange: ThermostatInstallationRangeModel | null;
	@ApiProperty({}) @Expose() minimumLeaseSeconds: number;
	@ApiProperty({}) @Expose() maximumLeaseSeconds: number;
	@ApiProperty({}) @Expose() watchdogMs: number;
	@ApiProperty({}) @Expose() floorMaximumAgeMs: number;
	@ApiProperty({ enum: ['temperature', 'voltmeter', 'input'] }) @Expose() floorComponentType:
		| 'temperature'
		| 'voltmeter'
		| 'input';
	@ApiProperty({}) @Expose() floorComponentId: number;
	@ApiProperty({ enum: ['tC', 'xvoltage', 'xpercent', 'voltage'] }) @Expose() floorAttribute:
		| 'tC'
		| 'xvoltage'
		| 'xpercent'
		| 'voltage';
	@ApiProperty({}) @Expose() floorConfigurationJson: string;
	@ApiProperty({}) @Expose() switchConfigurationJson: string;
	@ApiProperty() @Expose() peripheralsJson: string;
	@ApiPropertyOptional({ type: ThermostatFloorConversionModel })
	@Expose()
	@Type(() => ThermostatFloorConversionModel)
	floorConversion?: ThermostatFloorConversionModel;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatOperatorAttestation' })
export class ThermostatOperatorAttestationModel implements ThermostatOperatorAttestation {
	@ApiProperty({ enum: THERMOSTAT_ATTESTATION_KINDS }) @Expose() kind: ThermostatOperatorAttestation['kind'];
	@ApiProperty({}) @Expose() equipment: string;
	@ApiProperty({}) @Expose() procedure: string;
	@ApiProperty({}) @Expose() evidenceReference: string;
	@ApiProperty({}) @Expose() testedAt: string;
	@ApiPropertyOptional({}) @Expose() maximumObservedMs?: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatMachineObservation' })
export class ThermostatMachineObservationModel {
	@ApiProperty() @Expose() observedAt: string;
	@ApiPropertyOptional() @Expose() configurationRevision?: number;
	@ApiProperty({ enum: ['blocked', 'verified_metadata'] }) @Expose() state: 'blocked' | 'verified_metadata';
	@ApiProperty({ type: [String] }) @Expose() reasons: string[];
	@ApiPropertyOptional() @Expose() scriptHash?: string;
	@ApiPropertyOptional() @Expose() firmware?: string;
	@ApiProperty({
		type: Boolean,
		example: false,
		description: 'Always false: metadata is not physical safety certification',
	})
	@Expose()
	physicalSafetyCertified: false;
}
@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatInstallationAudit' })
export class ThermostatInstallationAuditModel {
	@ApiProperty() @Expose() id: string;
	@ApiProperty() @Expose() claimId: string;
	@ApiProperty() @Expose() revision: number;
	@ApiProperty({ enum: ['staged', 'revoked', 'activated', 'metadata_verified', 'metadata_blocked'] })
	@Expose()
	action: string;
	@ApiProperty({ type: String, nullable: true }) @Expose() actorId: string | null;
	@ApiProperty({ type: String, format: 'date-time' }) @Expose() occurredAt: Date;
	@ApiProperty({
		type: Object,
		description:
			'Typed persisted setup, attestations, binding fingerprint, expected script hash and optional observation snapshot',
	})
	@Expose()
	snapshot: object;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatInstallation' })
export class ThermostatInstallationModel {
	@ApiProperty({ description: 'Server-recorded explicit user activation intent; never physical ON or drain proof' })
	@Expose()
	activation_requested: boolean;
	@ApiProperty() @Expose() claim: string;
	@ApiProperty() @Expose() revision: number;
	@ApiProperty({ type: ThermostatGuardSetupModel })
	@Expose()
	@Type(() => ThermostatGuardSetupModel)
	setup: ThermostatGuardSetupModel;
	@ApiProperty({ type: [ThermostatOperatorAttestationModel] })
	@Expose()
	@Type(() => ThermostatOperatorAttestationModel)
	operator_attestations: ThermostatOperatorAttestationModel[];
	@ApiProperty({
		type: ThermostatMachineObservationModel,
		nullable: true,
		description: 'Diagnostic only; never trusted at restart',
	})
	@Expose()
	@Type(() => ThermostatMachineObservationModel)
	machine_observation: ThermostatMachineObservationModel | null;
	@ApiProperty({
		type: Boolean,
		example: false,
		description: 'Always false: metadata is not physical safety certification',
	})
	@Expose()
	physical_safety_certified: false;
	@ApiProperty({ enum: ['blocked', 'metadata_verified_runtime_fence_required'] }) @Expose() readiness: string;
	@ApiProperty({ type: [String] }) @Expose() reasons: string[];
	@ApiProperty({ type: String, nullable: true, description: 'Review artifact; never automatically deployed' })
	@Expose()
	artifact: string | null;
	@ApiProperty({ type: String, nullable: true }) @Expose() source_hash: string | null;
	@ApiProperty({ type: [ThermostatInstallationAuditModel] })
	@Expose()
	@Type(() => ThermostatInstallationAuditModel)
	audit: ThermostatInstallationAuditModel[];
}

@ApiSchema({ name: 'DevicesVirtualPluginResThermostatInstallation' })
export class ThermostatInstallationResponseModel extends BaseSuccessResponseModel<ThermostatInstallationModel> {
	@ApiProperty({ type: ThermostatInstallationModel })
	@Expose()
	@Type(() => ThermostatInstallationModel)
	declare data: ThermostatInstallationModel;
}
