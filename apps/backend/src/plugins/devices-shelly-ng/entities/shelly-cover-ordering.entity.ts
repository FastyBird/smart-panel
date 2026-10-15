import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Deliberately has no cascading device FK: deletion/re-adoption cannot erase an uncertain physical send. */
@Entity('devices_shelly_ng_cover_ordering')
export class ShellyCoverOrderingEntity {
	@PrimaryColumn({ type: 'text' })
	physicalIdentity: string;
	@Column({ type: 'text' })
	token: string;
	@Column({ type: 'datetime' })
	startedAt: Date;
}
