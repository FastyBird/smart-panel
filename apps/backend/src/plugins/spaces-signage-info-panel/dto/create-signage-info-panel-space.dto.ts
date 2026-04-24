import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { CreateSpaceDto } from '../../../modules/spaces/dto/create-space.dto';
import { SpaceType } from '../../../modules/spaces/spaces.constants';
import { SignageInfoPanelLayout } from '../spaces-signage-info-panel.constants';

@ApiSchema({ name: 'SpacesSignageInfoPanelPluginCreateSignageInfoPanelSpace' })
export class CreateSignageInfoPanelSpaceDto extends CreateSpaceDto {
	@ApiProperty({
		description: 'Space type',
		enum: [SpaceType.SIGNAGE_INFO_PANEL],
		default: SpaceType.SIGNAGE_INFO_PANEL,
		example: SpaceType.SIGNAGE_INFO_PANEL,
	})
	readonly type: SpaceType.SIGNAGE_INFO_PANEL;

	@ApiPropertyOptional({
		description: 'Layout preset for the information-panel surface.',
		enum: SignageInfoPanelLayout,
		default: SignageInfoPanelLayout.CLOCK_WEATHER_ANNOUNCEMENTS,
		example: SignageInfoPanelLayout.CLOCK_WEATHER_ANNOUNCEMENTS,
	})
	@Expose()
	@IsOptional()
	@IsEnum(SignageInfoPanelLayout, {
		message: '[{"field":"layout","reason":"Layout must be a valid SignageInfoPanelLayout value."}]',
	})
	layout?: SignageInfoPanelLayout;

	@ApiPropertyOptional({
		name: 'show_clock',
		description: 'Render the clock section.',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"show_clock","reason":"show_clock must be a boolean."}]' })
	show_clock?: boolean;

	@ApiPropertyOptional({
		name: 'show_weather',
		description: 'Render the weather section.',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"show_weather","reason":"show_weather must be a boolean."}]' })
	show_weather?: boolean;

	@ApiPropertyOptional({
		name: 'show_announcements',
		description: 'Render the announcements section.',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({
		message: '[{"field":"show_announcements","reason":"show_announcements must be a boolean."}]',
	})
	show_announcements?: boolean;

	@ApiPropertyOptional({
		name: 'show_feed',
		description: 'Render the external feed section (requires feed_url).',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"show_feed","reason":"show_feed must be a boolean."}]' })
	show_feed?: boolean;

	@ApiPropertyOptional({
		name: 'weather_location_id',
		description: 'Weather location ID driving the weather section.',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose()
	@IsOptional()
	@ValidateIf((_, value) => value !== null)
	@IsUUID('4', {
		message: '[{"field":"weather_location_id","reason":"weather_location_id must be a valid UUID (version 4)."}]',
	})
	weather_location_id?: string | null;

	@ApiPropertyOptional({
		name: 'feed_url',
		description: 'URL of an external feed rendered in the feed section.',
		type: 'string',
		nullable: true,
		example: 'https://news.example.com/embed',
	})
	@Expose()
	@IsOptional()
	@ValidateIf((_, value) => value !== null)
	@IsString({ message: '[{"field":"feed_url","reason":"feed_url must be a string."}]' })
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	feed_url?: string | null;
}
