import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ZigbeeFieldContract, propertySourceContract } from '../contracts/sample-source.contract';

/** Internal adoption identity, never an API override or durable freshness assertion. */
@Entity('devices_zigbee2mqtt_sample_sources')
export class ZigbeeSampleSourceEntity {
	@PrimaryColumn({ type: 'varchar' })
	propertyId: string;
	@ManyToOne(() => ChannelPropertyEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'propertyId', foreignKeyConstraintName: 'FK_zigbee_sample_source_property' })
	property: ChannelPropertyEntity;
	@Column({ type: 'varchar' })
	deviceId: string;
	@ManyToOne(() => DeviceEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'deviceId', foreignKeyConstraintName: 'FK_zigbee_sample_source_device' })
	device: DeviceEntity;
	@Column({ type: 'varchar' })
	friendlyName: string;
	@Column({ type: 'varchar' })
	ieeeAddress: string;
	@Column({ type: 'varchar' })
	field: string;
	@Column({ type: 'varchar' })
	fingerprint: string;
	@Column({ type: 'simple-json' })
	expose: ZigbeeFieldContract;
	@Column({ type: 'simple-json' })
	mapping: ReturnType<typeof propertySourceContract>;
	@Column({ type: 'datetime' })
	identifiedAt: Date;
	@Column({ type: 'integer', default: 1 })
	revision: number;
	@Column({ type: 'boolean', default: false })
	quarantined: boolean;
	@Column({ type: 'varchar', nullable: true })
	reason: string | null;
}
