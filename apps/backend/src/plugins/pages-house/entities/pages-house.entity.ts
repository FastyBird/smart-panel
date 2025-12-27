import { Expose, Transform } from 'class-transformer';
import { IsOptional, IsString, ValidateIf } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PageEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { PAGES_HOUSE_TYPE } from '../pages-house.constants';

@ApiSchema({ name: 'PagesHousePluginDataHousePage' })
@ChildEntity()
export class HousePageEntity extends PageEntity {
	@ApiPropertyOptional({
		name: 'view_mode',
		description: 'Display mode for the house overview page (simple or detailed)',
		type: 'string',
		enum: ['simple', 'detailed'],
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
		name: 'show_weather',
		description: 'Whether to show weather information on the house overview page',
		type: 'boolean',
		nullable: true,
		default: true,
		example: true,
	})
	@Expose({ name: 'show_weather' })
	@IsOptional()
	@ValidateIf((_, value) => value !== null)
	@Transform(
		({ obj }: { obj: { show_weather?: boolean; showWeather?: boolean } }) => obj.show_weather ?? obj.showWeather,
		{ toClassOnly: true },
	)
	@Column({ type: 'boolean', nullable: true, default: true })
	showWeather: boolean | null;

	@ApiProperty({
		description: 'Page type',
		type: 'string',
		default: PAGES_HOUSE_TYPE,
		example: PAGES_HOUSE_TYPE,
	})
	@Expose()
	get type(): string {
		return PAGES_HOUSE_TYPE;
	}
}
