import { Expose } from 'class-transformer';
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { BuddyMessageEntity } from './buddy-message.entity';

@Entity('buddy_module_conversations')
export class BuddyConversationEntity {
	@ApiProperty({ description: 'Unique conversation identifier', example: 'conv-abc123' })
	@PrimaryColumn({ type: 'varchar' })
	@Expose()
	id: string;

	@ApiPropertyOptional({ description: 'Optional conversation title', example: 'Living Room Setup' })
	@Column({ type: 'varchar', nullable: true })
	@Expose()
	title: string | null;

	@ApiPropertyOptional({ description: 'Associated space ID', example: 'space-1' })
	@Column({ type: 'varchar', nullable: true })
	@Expose({ name: 'space_id' })
	spaceId: string | null;

	@ApiProperty({ description: 'Conversation creation timestamp' })
	@CreateDateColumn({ type: 'datetime' })
	@Expose({ name: 'created_at' })
	createdAt: Date;

	@ApiProperty({ description: 'Last update timestamp' })
	@UpdateDateColumn({ type: 'datetime' })
	@Expose({ name: 'updated_at' })
	updatedAt: Date;

	@OneToMany(() => BuddyMessageEntity, (message) => message.conversation)
	messages?: BuddyMessageEntity[];
}
