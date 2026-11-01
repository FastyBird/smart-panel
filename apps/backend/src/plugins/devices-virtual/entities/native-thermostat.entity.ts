import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';

import type {
	NativeClimateOperationResult,
	NativeClimateRequest,
} from '../../../modules/devices/platforms/native-climate.contract';

/** Reservation survives source/owner deletion until an explicit operator unbind. */
@Entity('devices_virtual_native_thermostats')
@Check('CHK_virtual_native_binding', "\"revision\" >= 1 AND \"bindingState\" IN ('bound','releasing','released')")
@Index('UQ_virtual_native_physical', ['physicalIdentity'], { unique: true, where: '"bindingState" != \'released\'' })
@Index('UQ_virtual_native_source', ['sourceDeviceId'], { unique: true, where: '"bindingState" != \'released\'' })
export class NativeThermostatEntity {
	@PrimaryColumn({ type: 'varchar' })
	controllerId: string;
	@Column({ type: 'varchar' })
	sourceDeviceId: string;
	@Column({ type: 'text' })
	physicalIdentity: string;
	@Column({ type: 'text' })
	fingerprint: string;
	@Column({ type: 'text' })
	provider: 'home-assistant' | 'zigbee2mqtt';
	@Column({ type: 'text', default: 'bound' })
	bindingState: 'bound' | 'releasing' | 'released';
	@Column({ type: 'integer', default: 1 })
	revision: number;
	@Column({ type: 'simple-json' })
	requested: NativeClimateRequest;
	@Column({ type: 'simple-json' })
	propertyIds: Record<string, string>;
	@Column({ type: 'simple-json' })
	ownedPropertyIds: string[];
	@Column({ type: 'varchar', nullable: true })
	latestRequestId: string | null;
}

@Entity('devices_virtual_native_requests')
@Check('CHK_virtual_native_request', "\"revision\" >= 1 AND \"state\" IN ('pending','settled','interrupted')")
@Index('UQ_virtual_native_request_revision', ['controllerId', 'revision'], { unique: true })
export class NativeThermostatRequestEntity {
	@PrimaryColumn({ type: 'varchar' })
	id: string;
	@Column({ type: 'varchar' })
	controllerId: string;
	@Column({ type: 'integer' })
	revision: number;
	@Column({ type: 'simple-json' })
	request: NativeClimateRequest;
	@Column({ type: 'simple-json' })
	operations: NativeClimateOperationResult[];
	@Column({ type: 'text' })
	state: 'pending' | 'settled' | 'interrupted';
	@Column({ type: 'datetime' })
	createdAt: Date;
}
