import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateIf } from 'class-validator';

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePageDto } from '../../../modules/dashboard/dto/update-page.dto';

@ApiSchema({ name: 'PagesHouseModesPluginUpdateHouseModesPage' })
export class UpdateHouseModesPageDto extends UpdatePageDto {
	@ApiPropertyOptional({
		name: 'confirm_on_away',
		description: 'Whether to require confirmation when switching to Away mode',
		type: 'boolean',
		nullable: true,
		example: true,
	})
	@Expose({ name: 'confirm_on_away' })
	@IsOptional()
	@IsBoolean({ message: '[{"field":"confirm_on_away","reason":"Confirm on away must be a boolean."}]' })
	@ValidateIf((_, value) => value !== null && value !== undefined)
	@Transform(
		({ obj }: { obj: { confirm_on_away?: boolean; confirmOnAway?: boolean } }) =>
			obj.confirm_on_away ?? obj.confirmOnAway,
		{ toClassOnly: true },
	)
	confirm_on_away?: boolean | null;

	@ApiPropertyOptional({
		name: 'show_last_changed',
		description: 'Whether to show the last changed timestamp',
		type: 'boolean',
		nullable: true,
		example: true,
	})
	@Expose({ name: 'show_last_changed' })
	@IsOptional()
	@IsBoolean({ message: '[{"field":"show_last_changed","reason":"Show last changed must be a boolean."}]' })
	@ValidateIf((_, value) => value !== null && value !== undefined)
	@Transform(
		({ obj }: { obj: { show_last_changed?: boolean; showLastChanged?: boolean } }) =>
			obj.show_last_changed ?? obj.showLastChanged,
		{ toClassOnly: true },
	)
	show_last_changed?: boolean | null;
}
