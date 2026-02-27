import { Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import { BuddyMessageEntity } from './buddy-message.entity';

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

	@OneToMany(() => BuddyMessageEntity, (message) => message.conversation)
	messages: BuddyMessageEntity[];
}
