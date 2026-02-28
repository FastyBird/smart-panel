import { Expose } from 'class-transformer';
import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('buddy_module_messages')
export class BuddyMessageEntity {
	@PrimaryColumn({ type: 'varchar' })
	@Expose()
	id: string;

	@Column({ type: 'varchar' })
	@Expose({ name: 'conversation_id' })
	conversationId: string;

	@Column({ type: 'varchar' })
	@Expose()
	role: string;

	@Column({ type: 'text' })
	@Expose()
	content: string;

	@CreateDateColumn({ type: 'datetime' })
	@Expose({ name: 'created_at' })
	createdAt: Date;
}
