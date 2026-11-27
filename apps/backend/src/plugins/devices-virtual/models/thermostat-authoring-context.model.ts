import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatProtectionCandidate' })
export class ThermostatProtectionCandidateModel {
	@ApiProperty({ description: 'Eligible canonical Celsius property UUID' }) @Expose() property: string;
	@ApiProperty({ description: 'Retained physical input UUID' }) @Expose() physical_property: string;
	@ApiProperty({ description: 'Human source label' }) @Expose() name: string;
	@ApiProperty({ description: 'Validated source contract fingerprint' }) @Expose() fingerprint: string;
	@ApiProperty({
		description: 'Read-only public component/peripheral/calibration snapshot, never sample evidence',
		nullable: true,
		type: 'object',
		additionalProperties: true,
	})
	@Expose()
	snapshot: object | null;
}
@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatSafetyExtension' })
export class ThermostatSafetyExtensionModel {
	@ApiProperty() @Expose() id: string;
	@ApiProperty() @Expose() version: number;
	@ApiProperty() @Expose() name: string;
	@ApiProperty({ enum: ['heating', 'cooling'], enumName: 'DevicesVirtualPluginThermostatActuatorRole', isArray: true })
	@Expose()
	roles: ('heating' | 'cooling')[];
	@ApiProperty() @Expose() requires_cooling_protection: boolean;
	@ApiProperty({ type: String, nullable: true }) @Expose() installation_path: string | null;
	@ApiProperty({ type: [ThermostatProtectionCandidateModel] })
	@Expose()
	@Type(() => ThermostatProtectionCandidateModel)
	candidates: ThermostatProtectionCandidateModel[];
	@ApiProperty({ type: String, nullable: true }) @Expose() device_hardware_id: string | null;
	@ApiProperty({ type: String, nullable: true }) @Expose() firmware: string | null;
	@ApiProperty({ type: String, nullable: true }) @Expose() switch_configuration_json: string | null;
	@ApiProperty({ type: [String] }) @Expose() reasons: string[];
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatAuthoringContext' })
export class ThermostatAuthoringContextModel {
	@ApiProperty({
		type: [ThermostatSafetyExtensionModel],
		description: 'Optional safety profiles offered by the actuator integration',
	})
	@Expose()
	@Type(() => ThermostatSafetyExtensionModel)
	safety_extensions: ThermostatSafetyExtensionModel[];
	@ApiProperty({ description: 'Canonical physical actuator identity' }) @Expose() physical_identity: string;
	@ApiProperty({
		type: Number,
		nullable: true,
		description: 'Current controller configuration revision for an installed claim',
	})
	@Expose()
	configuration_revision: number | null;
	@ApiProperty({ type: Number, nullable: true, description: 'Current claim revision' }) @Expose() claim_revision:
		| number
		| null;
	@ApiProperty({ description: 'Current structural graph revision' }) @Expose() graph_revision: number;
	@ApiProperty({
		type: [ThermostatProtectionCandidateModel],
		description: 'Celsius sources eligible for software floor and cooled-surface protection',
	})
	@Expose()
	@Type(() => ThermostatProtectionCandidateModel)
	candidates: ThermostatProtectionCandidateModel[];
	@ApiProperty({
		type: String,
		nullable: true,
		description: 'Cached live delegate hardware identity; absent when metadata is unavailable',
	})
	@Expose()
	device_hardware_id: string | null;
	@ApiProperty({ type: String, nullable: true, description: 'Current cached delegate firmware' }) @Expose() firmware:
		| string
		| null;
	@ApiProperty({
		type: String,
		nullable: true,
		description: 'Read-only public switch catalog snapshot, never equipment qualification',
	})
	@Expose()
	switch_configuration_json: string | null;
	@ApiProperty({
		type: [String],
		description: 'Concrete authoring/staging blockers; no actuation readiness is implied',
	})
	@Expose()
	reasons: string[];
}
@ApiSchema({ name: 'DevicesVirtualPluginResThermostatAuthoringContext' })
export class ThermostatAuthoringContextResponseModel extends BaseSuccessResponseModel<ThermostatAuthoringContextModel> {
	@ApiProperty({ type: ThermostatAuthoringContextModel })
	@Expose()
	@Type(() => ThermostatAuthoringContextModel)
	declare data: ThermostatAuthoringContextModel;
}
