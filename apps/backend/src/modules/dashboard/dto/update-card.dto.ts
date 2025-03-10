import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

type ReqUpdateCard = components['schemas']['DashboardReqUpdateCard'];
type UpdateCard = components['schemas']['DashboardUpdateCard'];

export class UpdateCardDto implements UpdateCard {
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"title","reason":"Title must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"title","reason":"Title must be a non-empty string."}]' })
	title?: string;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@ValidateIf((_, value) => value !== null)
	icon?: string | null;

	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"order","reason":"Order must be a positive number."}]' },
	)
	order?: number;
}

export class ReqUpdateCardDto implements ReqUpdateCard {
	@Expose()
	@ValidateNested()
	@Type(() => UpdateCardDto)
	data: UpdateCardDto;
}
