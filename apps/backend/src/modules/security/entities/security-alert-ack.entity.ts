import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('security_module_alert_acks')
export class SecurityAlertAckEntity {
	@PrimaryColumn({ type: 'varchar' })
	id: string;

	@Column({ type: 'boolean', default: false })
	acknowledged: boolean;

	@Column({ type: 'datetime', nullable: true })
	acknowledgedAt: Date | null;

	@Column({ type: 'datetime', nullable: true })
	lastEventAt: Date | null;

	@Column({ type: 'varchar', nullable: true })
	acknowledgedBy: string | null;

	@UpdateDateColumn({ type: 'datetime' })
	updatedAt: Date;
}
