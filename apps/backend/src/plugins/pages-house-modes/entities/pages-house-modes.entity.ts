import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateIf } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PageEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { PAGES_HOUSE_MODES_TYPE } from '../pages-house-modes.constants';

@ApiSchema({ name: 'PagesHouseModesPluginDataHouseModesPage' })
@ChildEntity()
export class HouseModesPageEntity extends PageEntity {
	@ApiPropertyOptional({
		name: 'confirm_on_away',
		description: 'Whether to require confirmation when switching to Away mode',
		type: 'boolean',
		nullable: true,
		default: true,
		example: true,
	})
	@Expose({ name: 'confirm_on_away' })
	@IsOptional()
	@IsBoolean()
	@ValidateIf((_, value) => value !== null)
	@Transform(
		({ obj }: { obj: { confirm_on_away?: boolean; confirmOnAway?: boolean } }) =>
			obj.confirm_on_away ?? obj.confirmOnAway,
		{ toClassOnly: true },
	)
	@Column({ type: 'boolean', nullable: true, default: true })
	confirmOnAway: boolean | null;

	@ApiPropertyOptional({
		name: 'show_last_changed',
		description: 'Whether to show the last changed timestamp',
		type: 'boolean',
		nullable: true,
		default: true,
		example: true,
	})
	@Expose({ name: 'show_last_changed' })
	@IsOptional()
	@IsBoolean()
	@ValidateIf((_, value) => value !== null)
	@Transform(
		({ obj }: { obj: { show_last_changed?: boolean; showLastChanged?: boolean } }) =>
			obj.show_last_changed ?? obj.showLastChanged,
		{ toClassOnly: true },
	)
	@Column({ type: 'boolean', nullable: true, default: true })
	showLastChanged: boolean | null;

	@ApiProperty({
		description: 'Page type',
		type: 'string',
		default: PAGES_HOUSE_MODES_TYPE,
		example: PAGES_HOUSE_MODES_TYPE,
	})
	@Expose()
	get type(): string {
		return PAGES_HOUSE_MODES_TYPE;
	}
}
