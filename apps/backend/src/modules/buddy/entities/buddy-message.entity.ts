import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { BuddyConversationEntity } from './buddy-conversation.entity';

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

	@ManyToOne(() => BuddyConversationEntity, (conversation) => conversation.messages, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'conversationId' })
	conversation: BuddyConversationEntity;
}
