import { Expose } from 'class-transformer';
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('buddy_module_conversations')
export class BuddyConversationEntity {
	@PrimaryColumn({ type: 'varchar' })
	@Expose()
	id: string;

	@Column({ type: 'varchar', nullable: true })
	@Expose()
	title: string | null;

	@Column({ type: 'varchar', nullable: true })
	@Expose({ name: 'space_id' })
	spaceId: string | null;

	@CreateDateColumn({ type: 'datetime' })
	@Expose({ name: 'created_at' })
	createdAt: Date;

	@UpdateDateColumn({ type: 'datetime' })
	@Expose({ name: 'updated_at' })
	updatedAt: Date;
}
