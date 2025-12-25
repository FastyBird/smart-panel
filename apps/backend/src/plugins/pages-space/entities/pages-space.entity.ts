import { Expose, Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { ChildEntity, Column, JoinColumn, ManyToOne } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PageEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
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
