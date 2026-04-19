import { Expose, Transform, Type } from 'class-transformer';
import {
	IsDate,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	Min,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'SpacesSignageInfoPanelPluginCreateAnnouncement' })
export class CreateAnnouncementDto {
	@ApiPropertyOptional({
		description: 'Announcement unique identifier (auto-generated when omitted).',
		type: 'string',
		format: 'uuid',
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	readonly id?: string;

	@ApiProperty({
		description: 'Announcement title rendered as the headline.',
		type: 'string',
		example: 'Lobby closed for maintenance',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"title","reason":"Title is required."}]' })
	@IsString({ message: '[{"field":"title","reason":"Title must be a string."}]' })
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
	@IsString({ message: '[{"field":"body","reason":"Body must be a string."}]' })
	body?: string | null;

	@ApiPropertyOptional({
		description: 'Icon identifier rendered alongside the announcement.',
		type: 'string',
		nullable: true,
		example: 'mdi:information',
	})
	@Expose()
	@IsOptional()
	@ValidateIf((_, value) => value !== null)
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a string."}]' })
	icon?: string | null;

	@ApiPropertyOptional({
		description: 'Sort order within the parent signage space. Lower values render first.',
		type: 'integer',
		example: 0,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"order","reason":"Order must be an integer."}]' })
	@Min(0, { message: '[{"field":"order","reason":"Order must be at least 0."}]' })
	order?: number;

	@ApiPropertyOptional({
		name: 'active_from',
		description: 'Active-window lower bound. Announcement renders when now >= active_from.',
		type: 'string',
		format: 'date-time',
		nullable: true,
		example: '2025-01-25T08:00:00Z',
	})
	@Expose()
	@IsOptional()
	@ValidateIf((_, value) => value !== null)
	@Type(() => Date)
	@IsDate({ message: '[{"field":"active_from","reason":"active_from must be a valid ISO-8601 timestamp."}]' })
	active_from?: Date | null;

	@ApiPropertyOptional({
		name: 'active_until',
		description: 'Active-window upper bound. Announcement renders while now < active_until.',
		type: 'string',
		format: 'date-time',
		nullable: true,
		example: '2025-01-25T14:00:00Z',
	})
	@Expose()
	@IsOptional()
	@ValidateIf((_, value) => value !== null)
	@Type(() => Date)
	@IsDate({ message: '[{"field":"active_until","reason":"active_until must be a valid ISO-8601 timestamp."}]' })
	active_until?: Date | null;

	@ApiPropertyOptional({
		description: 'Announcement priority. Higher values render before lower.',
		type: 'integer',
		example: 0,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"priority","reason":"Priority must be an integer."}]' })
	priority?: number;
}

@ApiSchema({ name: 'SpacesSignageInfoPanelPluginReqCreateAnnouncement' })
export class ReqCreateAnnouncementDto {
	@ApiProperty({
		description: 'Announcement creation data.',
		type: CreateAnnouncementDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => CreateAnnouncementDto)
	data: CreateAnnouncementDto;
}
