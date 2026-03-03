import { Expose } from 'class-transformer';
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { LlmResponseMeta } from '../platforms/llm-provider.platform';

import { BuddyConversationEntity } from './buddy-conversation.entity';

@Entity('buddy_module_messages')
export class BuddyMessageEntity {
	@ApiProperty({ description: 'Unique message identifier', example: 'msg-abc123' })
	@PrimaryColumn({ type: 'varchar' })
	@Expose()
	id: string;

	@ApiProperty({ description: 'Parent conversation ID', example: 'conv-abc123' })
	@Column({ type: 'varchar' })
	@Expose({ name: 'conversation_id' })
	conversationId: string;

	@ApiProperty({ description: 'Message role', enum: ['user', 'assistant'], example: 'user' })
	@Column({ type: 'varchar' })
	@Expose()
	role: string;

	@ApiProperty({ description: 'Message content text' })
	@Column({ type: 'text' })
	@Expose()
	content: string;

	@ApiPropertyOptional({ description: 'LLM response metadata (provider, model, tokens, etc.)' })
	@Column({ type: 'simple-json', nullable: true, default: null })
	@Expose()
	metadata: LlmResponseMeta | null;

	@ApiProperty({ description: 'Message creation timestamp' })
	@CreateDateColumn({ type: 'datetime' })
	@Expose({ name: 'created_at' })
	createdAt: Date;

	@ManyToOne(() => BuddyConversationEntity, (conversation) => conversation.messages)
	@JoinColumn({ name: 'conversation_id' })
	conversation?: BuddyConversationEntity;
}
