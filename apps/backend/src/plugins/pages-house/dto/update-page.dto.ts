import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePageDto } from '../../../modules/dashboard/dto/update-page.dto';

@ApiSchema({ name: 'PagesHousePluginUpdateHousePage' })
export class UpdateHousePageDto extends UpdatePageDto {
	@ApiPropertyOptional({
		name: 'view_mode',
		description: 'Display mode for the house overview page (simple or detailed)',
		type: 'string',
		enum: ['simple', 'detailed'],
		nullable: true,
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
