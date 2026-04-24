import { Expose, Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'SpacesSignageInfoPanelPluginReorderAnnouncementEntry' })
export class ReorderAnnouncementEntryDto {
	@ApiProperty({
		description: 'Announcement unique identifier.',
		type: 'string',
		format: 'uuid',
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id: string;

	@ApiProperty({
		description: 'New sort order for the announcement.',
		type: 'integer',
		example: 0,
	})
	@Expose()
	@IsInt({ message: '[{"field":"order","reason":"Order must be an integer."}]' })
	@Min(0, { message: '[{"field":"order","reason":"Order must be at least 0."}]' })
	order: number;
}

@ApiSchema({ name: 'SpacesSignageInfoPanelPluginReorderAnnouncements' })
export class ReorderAnnouncementsDto {
	@ApiProperty({
		description: 'New order for each announcement in the signage space.',
		type: [ReorderAnnouncementEntryDto],
	})
	@Expose()
	@IsArray()
	@ArrayMinSize(1, { message: '[{"field":"items","reason":"Provide at least one announcement to reorder."}]' })
	@ValidateNested({ each: true })
	@Type(() => ReorderAnnouncementEntryDto)
	items: ReorderAnnouncementEntryDto[];
}

@ApiSchema({ name: 'SpacesSignageInfoPanelPluginReqReorderAnnouncements' })
export class ReqReorderAnnouncementsDto {
	@ApiProperty({
		description: 'Bulk reorder payload.',
		type: ReorderAnnouncementsDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => ReorderAnnouncementsDto)
	data: ReorderAnnouncementsDto;
}
