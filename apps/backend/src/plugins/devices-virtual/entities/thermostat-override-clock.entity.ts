import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { VirtualThermostatConfigEntity } from './virtual-thermostat.entity';

/** Recovery evidence only: advancing this bound cannot renew an override or change its intent. */
@Entity('devices_virtual_thermostat_override_clocks')
@Check(
	'CHK_thermostat_override_clock',
	'typeof("watermark") = \'integer\' AND "watermark" >= 0 AND "watermark" <= 9007199254740991',
)
export class ThermostatOverrideClockEntity {
	@PrimaryColumn({ type: 'varchar' })
	controllerId: string;
	@PrimaryColumn({ type: 'varchar' })
	overrideId: string;
	@ManyToOne(() => VirtualThermostatConfigEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'controllerId' })
	config: VirtualThermostatConfigEntity;
	@Column({ type: 'integer' })
	watermark: number;
}
