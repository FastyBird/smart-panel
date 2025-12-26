import { Expose, Transform } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { ChildEntity, Column, JoinColumn, ManyToOne } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PageEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { QuickActionType } from '../../../modules/spaces/spaces.constants';
import { PAGES_SPACE_TYPE } from '../pages-space.constants';

@ApiSchema({ name: 'PagesSpacePluginDataSpacePage' })
@ChildEntity()
export class SpacePageEntity extends PageEntity {
	@ApiProperty({
		name: 'space_id',
		description: 'The space (room/zone) this page displays',
		type: 'string',
		format: 'uuid',
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose({ name: 'space_id' })
	@IsUUID('4', { message: '[{"field":"space_id","reason":"Space ID must be a valid UUID (version 4)."}]' })
	@Transform(({ obj }: { obj: { space_id?: string; spaceId?: string } }) => obj.space_id ?? obj.spaceId, {
		toClassOnly: true,
	})
	@Column({ nullable: false })
	spaceId: string;

	@ManyToOne(() => SpaceEntity, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'spaceId' })
	space: SpaceEntity;

	@ApiPropertyOptional({
		name: 'view_mode',
		description: 'Display mode for the space page (simple or advanced)',
		type: 'string',
		enum: ['simple', 'advanced'],
		nullable: true,
		default: 'simple',
		example: 'simple',
	})
	@Expose({ name: 'view_mode' })
	@IsOptional()
	@IsString()
	@ValidateIf((_, value) => value !== null)
	@Transform(({ obj }: { obj: { view_mode?: string; viewMode?: string } }) => obj.view_mode ?? obj.viewMode, {
		toClassOnly: true,
	})
	@Column({ type: 'varchar', nullable: true, default: 'simple' })
	viewMode: string | null;

	@ApiPropertyOptional({
		name: 'quick_actions',
		description:
			'List of quick action types pinned to this space page. ' +
			'If not set, defaults to standard lighting controls (off, work, relax, night).',
		type: 'array',
		items: { type: 'string', enum: Object.values(QuickActionType) },
		nullable: true,
		example: ['lighting_off', 'lighting_work', 'lighting_relax', 'lighting_night'],
	})
	@Expose({ name: 'quick_actions' })
	@IsOptional()
	@IsArray({ message: '[{"field":"quick_actions","reason":"Quick actions must be an array."}]' })
	@IsEnum(QuickActionType, {
		each: true,
		message: '[{"field":"quick_actions","reason":"Each quick action must be a valid action type."}]',
	})
	@ValidateIf((_, value) => value !== null)
	@Transform(
		({ obj }: { obj: { quick_actions?: QuickActionType[]; quickActions?: QuickActionType[] } }) =>
			obj.quick_actions ?? obj.quickActions,
		{ toClassOnly: true },
	)
	@Column({ type: 'simple-array', nullable: true, default: null })
	quickActions: QuickActionType[] | null;

	@ApiProperty({
		description: 'Page type',
		type: 'string',
		default: PAGES_SPACE_TYPE,
		example: PAGES_SPACE_TYPE,
	})
	@Expose()
	get type(): string {
		return PAGES_SPACE_TYPE;
	}
}
