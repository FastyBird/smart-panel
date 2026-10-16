import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { NativeTemperatureSnapshot } from '../contracts/native-temperature.contract';

/** Internal provenance metadata. Never an API DTO or a persisted fresh-measurement assertion. */
@Entity('devices_shelly_ng_sample_sources')
export class ShellySampleSourceEntity {
	@PrimaryColumn({ type: 'varchar' })
	propertyId: string;

	@ManyToOne(() => ChannelPropertyEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'propertyId', foreignKeyConstraintName: 'FK_shelly_sample_source_property' })
	property: ChannelPropertyEntity;

	@Column({ type: 'varchar' })
	deviceId: string;

	@Column({ type: 'varchar' })
	componentKey: string;

	@Column({ type: 'varchar' })
	fingerprint: string;

	@Column({ type: 'varchar' })
	unit: string;

	@Column({ type: 'varchar', nullable: true })
	expression: string | null;

	@Column({ type: 'simple-json' })
	configuration: NativeTemperatureSnapshot['configuration'];

	@Column({ type: 'simple-json' })
	peripheral: NativeTemperatureSnapshot['peripheral'];

	@Column({ type: 'datetime' })
	identifiedAt: Date;

	@Column({ type: 'boolean', default: true })
	active: boolean;

	/** Full catalog snapshot for reviewed installation derivation, never sample authority. */
	@Column({ type: 'simple-json', nullable: true })
	installationSnapshot: NativeTemperatureSnapshot['installationSnapshot'] | null;
}
