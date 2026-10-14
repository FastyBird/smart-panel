import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

import { ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { VirtualThermostatMode, VirtualThermostatPolicy } from '../services/virtual-thermostat-policy.utils';
import { VirtualWindowTrendPolicy } from '../services/virtual-window-trend.utils';

export type ThermostatSourceRole = 'ambient' | 'floor' | 'contact';
export type ThermostatActuatorRole = 'heating' | 'cooling';
export type ThermostatClaimState = 'reserved' | 'releasing' | 'suspended' | 'missing' | 'released';
export type ThermostatSetting =
	| 'heating_setpoint'
	| 'cooling_setpoint'
	| 'heating_enabled'
	| 'cooling_enabled'
	| 'locked';

/** Configuration survives owner deletion so unresolved reservations and repair diagnostics survive too. */
@Entity('devices_virtual_thermostat_configs')
@Check('CHK_virtual_thermostat_version', '"schemaVersion" = 1 AND "revision" >= 1')
export class VirtualThermostatConfigEntity {
	@PrimaryColumn({ type: 'varchar' })
	controllerId: string;
	@Column({ type: 'varchar', nullable: true })
	ownerDeviceId: string | null;
	@ManyToOne(() => DeviceEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'ownerDeviceId' })
	ownerDevice: DeviceEntity | null;
	@Column({ type: 'integer', default: 1 })
	schemaVersion: number;
	@Column({ type: 'integer', default: 1 })
	revision: number;
	@Column({ type: 'text' })
	requestedMode: VirtualThermostatMode;
	@Column({ type: 'boolean', default: false })
	locked: boolean;
	@Column({ type: 'simple-json' })
	policy: VirtualThermostatPolicy;
	@Column({ type: 'simple-json', nullable: true })
	heuristic: VirtualWindowTrendPolicy | null;
	@Column({ type: 'integer' })
	contactOpeningMs: number;
	@Column({ type: 'integer' })
	contactClosingMs: number;
	@Column({ type: 'datetime' })
	configuredAt: Date;
	@Column({ type: 'datetime', nullable: true })
	releaseRequestedAt: Date | null;
}

@Entity('devices_virtual_thermostat_sources')
@Index('UQ_virtual_thermostat_source', ['controllerId', 'role', 'sourcePropertyIdentity'], { unique: true })
export class VirtualThermostatSourceEntity {
	@PrimaryGeneratedColumn('uuid')
	id: string;
	@Column({ type: 'varchar' })
	controllerId: string;
	@ManyToOne(() => VirtualThermostatConfigEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'controllerId' })
	config: VirtualThermostatConfigEntity;
	@Column({ type: 'text' })
	role: ThermostatSourceRole;
	@Column({ type: 'varchar', nullable: true })
	sourcePropertyId: string | null;
	@ManyToOne(() => ChannelPropertyEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'sourcePropertyId' })
	sourceProperty: ChannelPropertyEntity | null;
	@Column({ type: 'varchar' })
	sourcePropertyIdentity: string;
	@Column({ type: 'text', nullable: true })
	physicalIdentity: string | null;
	@Column({ type: 'text' })
	contractFingerprint: string;
	@Column({ type: 'integer' })
	maximumAgeSeconds: number;
	@Column({ type: 'simple-json', nullable: true })
	openValue: string | number | boolean | null;
	@Column({ type: 'simple-json', nullable: true })
	closedValue: string | number | boolean | null;
}

@Entity('devices_virtual_thermostat_actuator_claims')
@Index('UQ_virtual_thermostat_physical_reservation', ['physicalIdentity'], {
	unique: true,
	where: '"state" != \'released\'',
})
@Index('UQ_virtual_thermostat_branch_reservation', ['controllerId', 'role'], {
	unique: true,
	where: '"state" != \'released\'',
})
@Check(
	'CHK_virtual_thermostat_claim',
	"\"revision\" >= 1 AND \"state\" IN ('reserved','releasing','suspended','missing','released')",
)
export class VirtualThermostatActuatorClaimEntity {
	@PrimaryGeneratedColumn('uuid')
	id: string;
	@Column({ type: 'varchar' })
	controllerId: string;
	@ManyToOne(() => VirtualThermostatConfigEntity, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'controllerId' })
	config: VirtualThermostatConfigEntity;
	@Column({ type: 'text' })
	role: ThermostatActuatorRole;
	@Column({ type: 'text' })
	physicalIdentity: string;
	@Column({ type: 'varchar', nullable: true })
	sourcePropertyId: string | null;
	@ManyToOne(() => ChannelPropertyEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'sourcePropertyId' })
	sourceProperty: ChannelPropertyEntity | null;
	@Column({ type: 'varchar' })
	sourcePropertyIdentity: string;
	@Column({ type: 'varchar', nullable: true })
	sourceDeviceId: string | null;
	@ManyToOne(() => DeviceEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'sourceDeviceId' })
	sourceDevice: DeviceEntity | null;
	@Column({ type: 'varchar' })
	sourceDeviceIdentity: string;
	@Column({ type: 'text' })
	contractFingerprint: string;
	@Column({ type: 'integer', default: 1 })
	revision: number;
	@Column({ type: 'text' })
	state: ThermostatClaimState;
	@Column({ type: 'double precision' })
	leaseSeconds: number;
	@Column({ type: 'text', nullable: true })
	reason: string | null;
	@Column({ type: 'datetime', nullable: true })
	releaseRequestedAt: Date | null;
	@Column({ type: 'datetime', nullable: true })
	releasedAt: Date | null;
	@Column({ type: 'simple-json', nullable: true })
	releaseEvidence: Record<string, string | number | boolean> | null;
}

/** Only these explicitly registered local endpoints have writable owned-value semantics. */
@Entity('devices_virtual_thermostat_settings')
@Index('UQ_virtual_thermostat_setting', ['controllerId', 'setting'], { unique: true })
export class VirtualThermostatSettingEntity {
	@PrimaryColumn({ type: 'varchar' })
	propertyId: string;
	@ManyToOne(() => ChannelPropertyEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'propertyId' })
	property: ChannelPropertyEntity;
	@Column({ type: 'varchar' })
	controllerId: string;
	@ManyToOne(() => VirtualThermostatConfigEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'controllerId' })
	config: VirtualThermostatConfigEntity;
	@Column({ type: 'text' })
	setting: ThermostatSetting;
	@Column({ type: 'text' })
	contractFingerprint: string;
}
