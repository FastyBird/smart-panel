import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { SpaceType } from '../../../modules/spaces/spaces.constants';
import { SignageInfoPanelLayout } from '../spaces-signage-info-panel.constants';

@ApiSchema({ name: 'SpacesSignageInfoPanelPluginDataSignageInfoPanelSpace' })
@ChildEntity(SpaceType.SIGNAGE_INFO_PANEL)
export class SignageInfoPanelSpaceEntity extends SpaceEntity {
	@ApiProperty({
		description: 'Layout preset for the information-panel surface.',
		enum: SignageInfoPanelLayout,
		default: SignageInfoPanelLayout.CLOCK_WEATHER_ANNOUNCEMENTS,
		example: SignageInfoPanelLayout.CLOCK_WEATHER_ANNOUNCEMENTS,
	})
	@Expose()
	@IsEnum(SignageInfoPanelLayout)
	@Column({
		type: 'varchar',
		length: 40,
		nullable: true,
		default: SignageInfoPanelLayout.CLOCK_WEATHER_ANNOUNCEMENTS,
	})
	layout: SignageInfoPanelLayout;

	@ApiProperty({
		name: 'show_clock',
		description: 'Render the clock section.',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'show_clock' })
	@IsBoolean()
	@Transform(({ obj }: { obj: { show_clock?: boolean; showClock?: boolean } }) => obj.show_clock ?? obj.showClock, {
		toClassOnly: true,
	})
	@Column({ type: 'boolean', nullable: true, default: true })
	showClock: boolean;

	@ApiProperty({
		name: 'show_weather',
		description: 'Render the weather section.',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'show_weather' })
	@IsBoolean()
	@Transform(
		({ obj }: { obj: { show_weather?: boolean; showWeather?: boolean } }) => obj.show_weather ?? obj.showWeather,
		{ toClassOnly: true },
	)
	@Column({ type: 'boolean', nullable: true, default: true })
	showWeather: boolean;

	@ApiProperty({
		name: 'show_announcements',
		description: 'Render the announcements section.',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'show_announcements' })
	@IsBoolean()
	@Transform(
		({ obj }: { obj: { show_announcements?: boolean; showAnnouncements?: boolean } }) =>
			obj.show_announcements ?? obj.showAnnouncements,
		{ toClassOnly: true },
	)
	@Column({ type: 'boolean', nullable: true, default: true })
	showAnnouncements: boolean;

	@ApiProperty({
		name: 'show_feed',
		description: 'Render the external feed section (requires feed_url).',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'show_feed' })
	@IsBoolean()
	@Transform(({ obj }: { obj: { show_feed?: boolean; showFeed?: boolean } }) => obj.show_feed ?? obj.showFeed, {
		toClassOnly: true,
	})
	@Column({ type: 'boolean', nullable: true, default: false })
	showFeed: boolean;

	@ApiPropertyOptional({
		name: 'weather_location_id',
		description: 'Weather location ID driving the weather section. Null falls back to the first available location.',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose({ name: 'weather_location_id' })
	@IsOptional()
	@ValidateIf((_, value) => value !== null)
	@IsUUID('4')
	@Transform(
		({ obj }: { obj: { weather_location_id?: string | null; weatherLocationId?: string | null } }) =>
			obj.weather_location_id ?? obj.weatherLocationId ?? null,
		{ toClassOnly: true },
	)
	@Column({ type: 'varchar', length: 36, nullable: true, default: null })
	weatherLocationId: string | null;

	@ApiPropertyOptional({
		name: 'feed_url',
		description: 'Optional URL of an external feed rendered in the feed section.',
		type: 'string',
		nullable: true,
		example: 'https://news.example.com/embed',
	})
	@Expose({ name: 'feed_url' })
	@IsOptional()
	@ValidateIf((_, value) => value !== null)
	@IsString()
	@Transform(
		({ obj }: { obj: { feed_url?: string | null; feedUrl?: string | null } }) => obj.feed_url ?? obj.feedUrl ?? null,
		{ toClassOnly: true },
	)
	@Column({ type: 'varchar', nullable: true, default: null })
	feedUrl: string | null;

	@ApiProperty({
		description: 'Space type',
		enum: [SpaceType.SIGNAGE_INFO_PANEL],
		default: SpaceType.SIGNAGE_INFO_PANEL,
		example: SpaceType.SIGNAGE_INFO_PANEL,
	})
	@Expose()
	get type(): SpaceType.SIGNAGE_INFO_PANEL {
		return SpaceType.SIGNAGE_INFO_PANEL;
	}
}
