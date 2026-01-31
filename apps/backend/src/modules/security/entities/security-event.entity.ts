import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { SecurityEventType, Severity } from '../security.constants';

@Entity('security_module_events')
export class SecurityEventEntity {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Index()
	@CreateDateColumn({ type: 'datetime' })
	timestamp: Date;

	@Column({ type: 'varchar' })
	eventType: SecurityEventType;

	@Column({ type: 'varchar', nullable: true })
	severity: Severity | null;

	@Column({ type: 'varchar', nullable: true })
	alertId: string | null;

	@Column({ type: 'varchar', nullable: true })
	alertType: string | null;

	@Column({ type: 'varchar', nullable: true })
	sourceDeviceId: string | null;

	@Column({ type: 'simple-json', nullable: true })
	payload: Record<string, unknown> | null;
}
