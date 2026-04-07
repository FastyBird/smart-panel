import { Expose } from 'class-transformer';
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { SuggestionType } from '../buddy.constants';

export enum SuggestionStatus {
	ACTIVE = 'active',
	ACCEPTED = 'accepted',
	DISMISSED = 'dismissed',
	EXPIRED = 'expired',
}

@Entity('buddy_module_suggestions')
@Index('idx_suggestion_status', ['status'])
@Index('idx_suggestion_expires', ['expiresAt'])
@Index('idx_suggestion_space_type', ['spaceId', 'type'])
export class BuddySuggestionEntity {
	@ApiProperty({ description: 'Unique suggestion identifier' })
	@PrimaryColumn({ type: 'varchar' })
	@Expose()
	id: string;

	@ApiProperty({ description: 'Suggestion type', enum: SuggestionType })
	@Column({ type: 'varchar' })
	@Expose()
	type: SuggestionType;

	@ApiProperty({ name: 'space_id', description: 'Associated space ID' })
	@Column({ type: 'varchar' })
	@Expose({ name: 'space_id' })
	spaceId: string;

	@ApiProperty({ description: 'Suggestion title' })
	@Column({ type: 'varchar' })
	@Expose()
	title: string;

	@ApiProperty({ description: 'Suggestion reason/body' })
	@Column({ type: 'text' })
	@Expose()
	reason: string;

	@ApiPropertyOptional({ description: 'Additional metadata (JSON)' })
	@Column({ type: 'simple-json', nullable: true })
	@Expose()
	metadata: Record<string, unknown> | null;

	@ApiProperty({ description: 'Suggestion status', enum: SuggestionStatus })
	@Column({ type: 'varchar', default: SuggestionStatus.ACTIVE })
	@Expose()
	status: SuggestionStatus;

	@ApiProperty({ name: 'created_at', description: 'Creation timestamp' })
	@CreateDateColumn({ type: 'datetime' })
	@Expose({ name: 'created_at' })
	createdAt: Date;

	@ApiProperty({ name: 'expires_at', description: 'Expiry timestamp' })
	@Column({ type: 'datetime' })
	@Expose({ name: 'expires_at' })
	expiresAt: Date;

	@ApiPropertyOptional({ name: 'feedback_at', description: 'When user gave feedback' })
	@Column({ type: 'datetime', nullable: true })
	@Expose({ name: 'feedback_at' })
	feedbackAt: Date | null;
}
