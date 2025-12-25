import { Expose, Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePageDto } from '../../../modules/dashboard/dto/update-page.dto';

@ApiSchema({ name: 'PagesSpacePluginUpdateSpacePage' })
export class UpdateSpacePageDto extends UpdatePageDto {
	@ApiPropertyOptional({
		name: 'space_id',
		description: 'The space (room/zone) this page displays',
		type: 'string',
		format: 'uuid',
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose({ name: 'space_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"space_id","reason":"Space ID must be a valid UUID (version 4)."}]' })
	@Transform(({ obj }: { obj: { space_id?: string; spaceId?: string } }) => obj.space_id ?? obj.spaceId, {
		toClassOnly: true,
	})
	space_id?: string;

	@ApiPropertyOptional({
		name: 'view_mode',
		description: 'Display mode for the space page (simple or advanced)',
		type: 'string',
		enum: ['simple', 'advanced'],
		nullable: true,
		example: 'simple',
	})
	@Expose({ name: 'view_mode' })
	@IsOptional()
	@IsString({ message: '[{"field":"view_mode","reason":"View mode must be a string."}]' })
	@ValidateIf((_, value) => value !== null && value !== undefined)
	@IsIn(['simple', 'advanced'], { message: '[{"field":"view_mode","reason":"View mode must be simple or advanced."}]' })
	@Transform(({ obj }: { obj: { view_mode?: string; viewMode?: string } }) => obj.view_mode ?? obj.viewMode, {
		toClassOnly: true,
	})
	view_mode?: string | null;
}
