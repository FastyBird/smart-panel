import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { CreatePageDto } from '../../../modules/dashboard/dto/create-page.dto';
import { PAGES_HOUSE_TYPE } from '../pages-house.constants';

@ApiSchema({ name: 'PagesHousePluginCreateHousePage' })
export class CreateHousePageDto extends CreatePageDto {
	@ApiProperty({
		description: 'Page type',
		type: 'string',
		default: PAGES_HOUSE_TYPE,
		example: PAGES_HOUSE_TYPE,
	})
	readonly type: typeof PAGES_HOUSE_TYPE;

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
	@IsString({ message: '[{"field":"view_mode","reason":"View mode must be a string."}]' })
	@ValidateIf((_, value) => value !== null && value !== undefined)
	@IsIn(['simple', 'detailed'], { message: '[{"field":"view_mode","reason":"View mode must be simple or detailed."}]' })
	@Transform(({ obj }: { obj: { view_mode?: string; viewMode?: string } }) => obj.view_mode ?? obj.viewMode, {
		toClassOnly: true,
	})
	view_mode?: string | null;

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
	@IsBoolean({ message: '[{"field":"show_weather","reason":"Show weather must be a boolean."}]' })
	@ValidateIf((_, value) => value !== null && value !== undefined)
	@Transform(
		({ obj }: { obj: { show_weather?: boolean; showWeather?: boolean } }) => obj.show_weather ?? obj.showWeather,
		{ toClassOnly: true },
	)
	show_weather?: boolean | null;
}
