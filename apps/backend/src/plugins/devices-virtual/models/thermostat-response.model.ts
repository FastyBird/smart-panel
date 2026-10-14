import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { VirtualThermostatRecoveryEntity } from '../entities/virtual-thermostat.entity';
import { VirtualThermostatConfigService } from '../services/virtual-thermostat-config.service';
import { ThermostatRuntimeDiagnostic } from '../services/virtual-thermostat-runtime.service';

type ThermostatConfiguration = Awaited<ReturnType<VirtualThermostatConfigService['get']>>;

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatFloorGuard' })
export class VirtualThermostatFloorGuardModel {
	@ApiProperty({ description: 'Floor temperature heating release threshold in Celsius' })
	@Expose()
	limit: number;

	@ApiProperty({ description: 'Strict recovery below limit minus this positive hysteresis' })
	@Expose()
	recoveryHysteresis: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatPolicy' })
export class VirtualThermostatPolicyModel {
	@ApiProperty({
		description: 'Heating comfort setpoint in Celsius; null means no heating branch',
		type: Number,
		nullable: true,
	})
	@Expose()
	heatingSetpoint: number | null;

	@ApiProperty({
		description: 'Cooling comfort setpoint in Celsius; null means no cooling branch',
		type: Number,
		nullable: true,
	})
	@Expose()
	coolingSetpoint: number | null;

	@ApiProperty({ description: 'Nonnegative lower threshold tolerance' })
	@Expose()
	coldTolerance: number;

	@ApiProperty({ description: 'Nonnegative upper threshold tolerance' })
	@Expose()
	hotTolerance: number;

	@ApiProperty({ description: 'Positive neutral heat/cool margin' })
	@Expose()
	neutralMargin: number;

	@ApiProperty({ description: 'Minimum branch OFF interval; never delays protective release' })
	@Expose()
	minimumOffMs: number;

	@ApiProperty({ description: 'Opposed output changeover interval; never delays release' })
	@Expose()
	changeoverMs: number;

	@ApiProperty({
		description: 'Optional independent heating-only floor protection',
		allOf: [{ $ref: getSchemaPath(VirtualThermostatFloorGuardModel) }],
		nullable: true,
	})
	@Expose()
	@Type(() => VirtualThermostatFloorGuardModel)
	floor: VirtualThermostatFloorGuardModel | null;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataWindowTrendPolicy' })
export class VirtualWindowTrendPolicyModel {
	@ApiProperty({ description: 'Bounded slope sampling window' })
	@Expose()
	sampleWindowMs: number;

	@ApiProperty({ description: 'Minimum qualified samples for inference' })
	@Expose()
	minimumSamples: number;

	@ApiProperty({ description: 'Minimum sample time span' })
	@Expose()
	minimumSpanMs: number;

	@ApiProperty({ description: 'Maximum original sample age' })
	@Expose()
	maximumSampleAgeMs: number;

	@ApiProperty({ description: 'Positive trend magnitude; direction follows heating or cooling' })
	@Expose()
	slopeThresholdCPerMinute: number;

	@ApiProperty({ description: 'Sustained trend confirmation' })
	@Expose()
	confirmationMs: number;

	@ApiProperty({ description: 'Stable trend recovery interval' })
	@Expose()
	recoveryMs: number;

	@ApiProperty({ description: 'Maximum heuristic pause; expiry only reevaluates normal safety gates' })
	@Expose()
	maximumPauseMs: number;

	@ApiProperty({ description: 'Cooldown before another heuristic pause' })
	@Expose()
	cooldownMs: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatSource' })
export class VirtualThermostatSourceModel {
	@ApiProperty({
		description:
			'Original single physical measurement identity for physical/transformed roles; ambient aggregates may have no single leaf',
		type: String,
		nullable: true,
	})
	@Expose()
	physical_identity: string | null;
	@ApiProperty({ description: 'Source metadata and transform policy revision admission fingerprint' })
	@Expose()
	contract_fingerprint: string;
	@ApiProperty({ description: 'Stable role binding UUID' })
	@Expose()
	id: string;

	@ApiProperty({ description: 'Independent measurement role', enum: ['ambient', 'floor', 'contact'] })
	@Expose()
	role: 'ambient' | 'floor' | 'contact';

	@ApiProperty({ description: 'Nullable live property FK', type: String, nullable: true })
	@Expose()
	source_property: string | null;

	@ApiProperty({ description: 'Original stable property identity; deletion never erases it' })
	@Expose()
	source_identity: string;

	@ApiProperty({ description: 'Maximum original sample age' })
	@Expose()
	maximum_age_seconds: number;

	@ApiProperty({
		description: 'Explicit contact open mapping',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		nullable: true,
	})
	@Expose()
	open_value: string | number | boolean | null;

	@ApiProperty({
		description: 'Explicit contact closed mapping',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		nullable: true,
	})
	@Expose()
	closed_value: string | number | boolean | null;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatClaim' })
export class VirtualThermostatClaimModel {
	@ApiProperty({ description: 'Durable reservation UUID' })
	@Expose()
	id: string;

	@ApiProperty({ description: 'Exclusive branch role', enum: ['heating', 'cooling'] })
	@Expose()
	role: 'heating' | 'cooling';

	@ApiProperty({ description: 'Nullable live actuator FK', type: String, nullable: true })
	@Expose()
	source_property: string | null;

	@ApiProperty({ description: 'Original stable property identity' })
	@Expose()
	source_identity: string;

	@ApiProperty({ description: 'Canonical hardware leaf retained while missing' })
	@Expose()
	physical_identity: string;

	@ApiProperty({ description: 'Claim revision authority fence' })
	@Expose()
	revision: number;

	@ApiProperty({
		description: 'Recovery generation that new internal installation evidence must match',
		type: String,
		nullable: true,
	})
	@Expose()
	qualification_generation: string | null;

	@ApiProperty({
		description: 'Reservation lifecycle; intent never constitutes release proof',
		enum: ['reserved', 'releasing', 'suspended', 'missing', 'released'],
	})
	@Expose()
	state: 'reserved' | 'releasing' | 'suspended' | 'missing' | 'released';

	@ApiProperty({ description: 'Requested qualified local ON lease' })
	@Expose()
	lease_seconds: number;

	@ApiProperty({ description: 'Repair or release reason', type: String, nullable: true })
	@Expose()
	reason: string | null;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatSetting' })
export class VirtualThermostatSettingModel {
	@ApiProperty({ description: 'Registered local property UUID' })
	@Expose()
	property: string;

	@ApiProperty({
		description: 'Owned setting semantics; enables represent intent, never physical activity',
		enum: ['heating_setpoint', 'cooling_setpoint', 'heating_enabled', 'cooling_enabled', 'locked'],
	})
	@Expose()
	setting: 'heating_setpoint' | 'cooling_setpoint' | 'heating_enabled' | 'cooling_enabled' | 'locked';
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatConfiguration' })
export class VirtualThermostatConfigurationModel implements ThermostatConfiguration {
	@ApiProperty({ description: 'Stable controller device UUID' })
	@Expose()
	controller: string;
	@ApiProperty({ description: 'Configuration schema version', enum: [1] })
	@Expose()
	schema_version: number;
	@ApiProperty({ description: 'Configuration CAS revision' })
	@Expose()
	revision: number;
	@ApiProperty({ description: 'Shared graph revision' })
	@Expose()
	graph_revision: number;
	@ApiProperty({
		description: 'Requested mode, distinct from physical activity',
		enum: ['off', 'heat', 'cool', 'auto'],
	})
	@Expose()
	requested_mode: ThermostatConfiguration['requested_mode'];
	@ApiProperty({ description: 'Local controls locked' })
	@Expose()
	locked: boolean;
	@ApiProperty({
		description: 'Validated independent comfort and heating floor guard policy',
		type: VirtualThermostatPolicyModel,
	})
	@Expose()
	@Type(() => VirtualThermostatPolicyModel)
	policy: VirtualThermostatPolicyModel;
	@ApiProperty({
		description: 'Optional independent ambient-trend window policy',
		allOf: [{ $ref: getSchemaPath(VirtualWindowTrendPolicyModel) }],
		nullable: true,
	})
	@Expose()
	@Type(() => VirtualWindowTrendPolicyModel)
	heuristic: VirtualWindowTrendPolicyModel | null;
	@ApiProperty({ description: 'Contact opening debounce' })
	@Expose()
	contact_opening_ms: number;
	@ApiProperty({ description: 'Contact closing debounce' })
	@Expose()
	contact_closing_ms: number;
	@ApiProperty({ description: 'Draft until qualified hardware and durable runtime readiness', enum: ['draft'] })
	@Expose()
	readiness: 'draft';
	@ApiProperty({ description: 'All independent readiness blockers', type: [String] })
	@Expose()
	reasons: string[];
	@ApiProperty({
		description: 'Stable role-aware source bindings, including missing identities',
		type: [VirtualThermostatSourceModel],
	})
	@Expose()
	@Type(() => VirtualThermostatSourceModel)
	sources: VirtualThermostatSourceModel[];
	@ApiProperty({
		description: 'Non-released exclusive physical reservations; user OFF and disabled retain ownership',
		type: [VirtualThermostatClaimModel],
	})
	@Expose()
	@Type(() => VirtualThermostatClaimModel)
	actuators: VirtualThermostatClaimModel[];
	@ApiProperty({ description: 'Registered local writable setting endpoints', type: [VirtualThermostatSettingModel] })
	@Expose()
	@Type(() => VirtualThermostatSettingModel)
	settings: VirtualThermostatSettingModel[];
}

@ApiSchema({ name: 'DevicesVirtualPluginResThermostatConfiguration' })
export class VirtualThermostatConfigurationResponseModel extends BaseSuccessResponseModel<VirtualThermostatConfigurationModel> {
	@ApiProperty({
		description: 'Durable thermostat configuration and readiness',
		type: VirtualThermostatConfigurationModel,
	})
	@Expose()
	@Type(() => VirtualThermostatConfigurationModel)
	declare data: VirtualThermostatConfigurationModel;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatBranchRuntime' })
export class VirtualThermostatBranchRuntimeModel {
	@ApiProperty() @Expose() claim: string;
	@ApiProperty({ enum: ['heating', 'cooling'] }) @Expose() role: 'heating' | 'cooling';
	@ApiProperty({ enum: ['on', 'off', 'unknown'] }) @Expose() activity: 'on' | 'off' | 'unknown';
	@ApiProperty() @Expose() pending_on: boolean;
	@ApiProperty() @Expose() release_pending: boolean;
	@ApiProperty() @Expose() release_attempts: number;
	@ApiProperty({ type: String, nullable: true }) @Expose() next_release_at: string | null;
	@ApiProperty() @Expose() release_proven: boolean;
	@ApiProperty({ type: String, nullable: true }) @Expose() fault: string | null;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatInputRuntime' })
export class VirtualThermostatInputRuntimeModel {
	@ApiProperty() @Expose() binding: string;
	@ApiProperty({ enum: ['ambient', 'floor', 'contact'] }) @Expose() role: 'ambient' | 'floor' | 'contact';
	@ApiProperty({ type: String, nullable: true }) @Expose() source_property: string | null;
	@ApiProperty({ enum: ['physical', 'derived', 'unknown'] }) @Expose() source_kind: 'physical' | 'derived' | 'unknown';
	@ApiProperty({ enum: ['fresh', 'stale', 'missing', 'incompatible', 'unavailable'] }) @Expose() status:
		| 'fresh'
		| 'stale'
		| 'missing'
		| 'incompatible'
		| 'unavailable';
	@ApiProperty({ enum: ['good', 'degraded', 'unavailable'] }) @Expose() quality: 'good' | 'degraded' | 'unavailable';
	@ApiProperty({ type: String, format: 'date-time', nullable: true }) @Expose() sampled_at: string | null;
	@ApiProperty({ type: Number, nullable: true }) @Expose() age_seconds: number | null;
	@ApiProperty() @Expose() maximum_age_seconds: number;
	@ApiProperty({ type: String, format: 'date-time', nullable: true }) @Expose() expires_at: string | null;
	@ApiProperty({ type: [String] }) @Expose() reasons: string[];
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatRuntime' })
export class VirtualThermostatRuntimeModel implements ThermostatRuntimeDiagnostic {
	@ApiProperty({ description: 'Process epoch for runtime invalidation hints' }) @Expose() epoch: string;
	@ApiProperty() @Expose() sequence: number;
	@ApiProperty() @Expose() configuration_revision: number;
	@ApiProperty() @Expose() decision_revision: number;
	@ApiProperty({
		type: [VirtualThermostatInputRuntimeModel],
		description: 'Current configured input freshness; historical values never establish availability',
	})
	@Expose()
	@Type(() => VirtualThermostatInputRuntimeModel)
	inputs: VirtualThermostatInputRuntimeModel[];

	@ApiProperty({ enum: ['ready', 'suspended', 'unavailable'] })
	@Expose()
	readiness: ThermostatRuntimeDiagnostic['readiness'];
	@ApiProperty({ enum: ['off', 'heat', 'cool', 'auto'] })
	@Expose()
	requested_mode: ThermostatRuntimeDiagnostic['requested_mode'];
	@ApiProperty({ type: Number, nullable: true }) @Expose() heating_setpoint: number | null;
	@ApiProperty({ type: Number, nullable: true }) @Expose() cooling_setpoint: number | null;
	@ApiProperty({ type: Number, nullable: true }) @Expose() current_temperature: number | null;
	@ApiProperty({ type: Number, nullable: true }) @Expose() floor_temperature: number | null;
	@ApiProperty() @Expose() floor_latched: boolean;
	@ApiProperty({ enum: ['off', 'heat', 'cool'] })
	@Expose()
	comfort_demand: ThermostatRuntimeDiagnostic['comfort_demand'];
	@ApiProperty({ type: [String] }) @Expose() reasons: string[];
	@ApiProperty({ type: String, nullable: true }) @Expose() headline_reason: string | null;
	@ApiProperty({ type: [VirtualThermostatBranchRuntimeModel] })
	@Expose()
	@Type(() => VirtualThermostatBranchRuntimeModel)
	branches: VirtualThermostatBranchRuntimeModel[];
}

@ApiSchema({ name: 'DevicesVirtualPluginResThermostatRuntime' })
export class VirtualThermostatRuntimeResponseModel extends BaseSuccessResponseModel<VirtualThermostatRuntimeModel> {
	@ApiProperty({ type: VirtualThermostatRuntimeModel })
	@Expose()
	@Type(() => VirtualThermostatRuntimeModel)
	declare data: VirtualThermostatRuntimeModel;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatRecovery' })
export class VirtualThermostatRecoveryModel implements Pick<
	VirtualThermostatRecoveryEntity,
	| 'id'
	| 'claimId'
	| 'physicalIdentity'
	| 'previousPropertyIdentity'
	| 'restoredPropertyId'
	| 'actorId'
	| 'reason'
	| 'createdAt'
> {
	@ApiProperty()
	@Expose()
	id: string;
	@ApiProperty({ name: 'claim' })
	@Expose({ name: 'claim' })
	claimId: string;
	@ApiProperty({ name: 'physical_identity' })
	@Expose({ name: 'physical_identity' })
	physicalIdentity: string;
	@ApiProperty({ name: 'previous_property_identity' })
	@Expose({ name: 'previous_property_identity' })
	previousPropertyIdentity: string;
	@ApiProperty({ name: 'restored_property' })
	@Expose({ name: 'restored_property' })
	restoredPropertyId: string;
	@ApiProperty({ name: 'actor' })
	@Expose({ name: 'actor' })
	actorId: string;
	@ApiProperty()
	@Expose()
	reason: string;
	@ApiProperty({ name: 'created_at' })
	@Expose({ name: 'created_at' })
	createdAt: Date;
	@ApiProperty({ name: 'disconnection_acknowledged' })
	@Expose({ name: 'disconnection_acknowledged' })
	disconnectionAcknowledged: boolean;
	@ApiProperty({ name: 'configuration_revision' })
	@Expose({ name: 'configuration_revision' })
	configurationRevision: number;
	@ApiProperty({ name: 'claim_revision' })
	@Expose({ name: 'claim_revision' })
	claimRevision: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginResThermostatRecoveries' })
export class VirtualThermostatRecoveriesResponseModel extends BaseSuccessResponseModel<
	VirtualThermostatRecoveryModel[]
> {
	@ApiProperty({ type: [VirtualThermostatRecoveryModel] })
	@Expose()
	@Type(() => VirtualThermostatRecoveryModel)
	declare data: VirtualThermostatRecoveryModel[];
}
