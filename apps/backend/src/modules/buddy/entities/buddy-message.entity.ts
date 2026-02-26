import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('buddy_module_messages')
export class BuddyMessageEntity {
	@PrimaryColumn({ type: 'varchar' })
	id: string;

	@Column({ type: 'varchar' })
	conversationId: string;

	@Column({ type: 'varchar' })
	role: string;

	@Column({ type: 'text' })
	content: string;

	@CreateDateColumn({ type: 'datetime' })
	createdAt: Date;
}
