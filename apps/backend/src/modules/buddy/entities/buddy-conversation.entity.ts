import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('buddy_module_conversations')
export class BuddyConversationEntity {
	@PrimaryColumn({ type: 'varchar' })
	id: string;

	@Column({ type: 'varchar', nullable: true })
	title: string | null;

	@Column({ type: 'varchar', nullable: true })
	spaceId: string | null;

	@CreateDateColumn({ type: 'datetime' })
	createdAt: Date;

	@UpdateDateColumn({ type: 'datetime' })
	updatedAt: Date;
}
