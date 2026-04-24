import { Expose, Transform } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsString, IsUUID, Min, ValidateIf } from 'class-validator';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';

import { SignageInfoPanelSpaceEntity } from './signage-info-panel-space.entity';

@ApiSchema({ name: 'SpacesSignageInfoPanelPluginDataAnnouncement' })
@Entity('signage_info_panel_announcements')
export class SignageAnnouncementEntity extends BaseEntity {
	@ApiProperty({
		name: 'space_id',
		description: 'Identifier of the parent signage space.',
		type: 'string',
		format: 'uuid',
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose({ name: 'space_id' })
	@IsUUID('4')
	@Transform(({ obj }: { obj: { space_id?: string; spaceId?: string } }) => obj.space_id ?? obj.spaceId, {
		toClassOnly: true,
	})
	@Index()
	@Column({ type: 'varchar', length: 36, nullable: false })
	spaceId: string;

	@ManyToOne(() => SignageInfoPanelSpaceEntity, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'spaceId' })
	space: SignageInfoPanelSpaceEntity;

	@ApiProperty({
		description: 'Sort order within the parent signage space. Lower values render first.',
		type: 'integer',
		example: 0,
	})
	@Expose()
	@IsInt()
	@Min(0)
	@Index()
	@Column({ type: 'int', default: 0 })
	order: number;

	@ApiProperty({
		description: 'Announcement title rendered as the headline.',
		type: 'string',
		example: 'Lobby closed for maintenance',
	})
	@Expose()
	@IsString()
	@Column({ type: 'varchar', nullable: false })
	title: string;

	@ApiPropertyOptional({
		description: 'Longer announcement body rendered beneath the title.',
		type: 'string',
		nullable: true,
		example: 'Maintenance runs until 14:00 today. Thank you for your patience.',
	})
	@Expose()
	@IsOptional()
	@ValidateIf((_, value) => value !== null)
	@IsString()
	@Column({ type: 'varchar', nullable: true, default: null })
	body: string | null;

	@ApiPropertyOptional({
		description: 'Icon identifier rendered alongside the announcement.',
		type: 'string',
		nullable: true,
		example: 'mdi:information',
	})
	@Expose()
	@IsOptional()
	@ValidateIf((_, value) => value !== null)
	@IsString()
	@Column({ type: 'varchar', nullable: true, default: null })
	icon: string | null;

	@ApiPropertyOptional({
		name: 'active_from',
		description: 'Active-window lower bound. Announcement renders when now >= active_from.',
		type: 'string',
		format: 'date-time',
		nullable: true,
		example: '2025-01-25T08:00:00Z',
	})
	@Expose({ name: 'active_from' })
	@IsOptional()
	@ValidateIf((_, value) => value !== null)
	@IsDate()
	@Transform(
		({ obj }: { obj: { active_from?: string | Date | null; activeFrom?: string | Date | null } }) => {
			const value = obj.active_from ?? obj.activeFrom ?? null;
			if (!value) return null;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	@Column({ type: 'datetime', nullable: true, default: null })
	activeFrom: Date | null;

	@ApiPropertyOptional({
		name: 'active_until',
		description: 'Active-window upper bound. Announcement renders while now < active_until.',
		type: 'string',
		format: 'date-time',
		nullable: true,
		example: '2025-01-25T14:00:00Z',
	})
	@Expose({ name: 'active_until' })
	@IsOptional()
	@ValidateIf((_, value) => value !== null)
	@IsDate()
	@Transform(
		({ obj }: { obj: { active_until?: string | Date | null; activeUntil?: string | Date | null } }) => {
			const value = obj.active_until ?? obj.activeUntil ?? null;
			if (!value) return null;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	@Column({ type: 'datetime', nullable: true, default: null })
	activeUntil: Date | null;

	@ApiProperty({
		description: 'Announcement priority. Higher values render before lower.',
		type: 'integer',
		example: 0,
	})
	@Expose()
	@IsInt()
	@Column({ type: 'int', default: 0 })
	priority: number;
}
