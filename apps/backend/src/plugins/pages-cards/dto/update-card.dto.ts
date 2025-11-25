import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import type { components } from '../../../openapi';

type ReqUpdateCard = components['schemas']['PagesCardsPluginReqUpdateCard'];
type UpdateCard = components['schemas']['PagesCardsPluginUpdateCard'];

@ApiSchema({ name: 'PagesCardsPluginUpdateCard' })
export class UpdateCardDto implements UpdateCard {
	@ApiPropertyOptional({
		description: 'Card title',
		type: 'string',
		example: 'Living Room',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"title","reason":"Title must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"title","reason":"Title must be a non-empty string."}]' })
	title?: string;

	@ApiPropertyOptional({
		description: 'Card icon name',
		type: 'string',
		nullable: true,
		example: 'mdi-home',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@ValidateIf((_, value) => value !== null)
	icon?: string | null;

	@ApiPropertyOptional({
		description: 'Card order position',
		type: 'number',
		example: 1,
	})
	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"order","reason":"Order must be a positive number."}]' },
	)
	order?: number;
}

@ApiSchema({ name: 'PagesCardsPluginReqUpdateCard' })
export class ReqUpdateCardDto implements ReqUpdateCard {
	@ApiProperty({
		description: 'Card update data',
		type: UpdateCardDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => UpdateCardDto)
	data: UpdateCardDto;
}
