import { Expose, Transform, Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { CreatePageDto } from '../../../modules/dashboard/dto/create-page.dto';
import { PAGES_CARDS_TYPE } from '../pages-cards.constants';

import { CreateCardDto } from './create-card.dto';

@ApiSchema({ name: 'PagesCardsPluginCreateCardsPage' })
export class CreateCardsPageDto extends CreatePageDto {
	@ApiProperty({
		description: 'Page type',
		type: 'string',
		default: PAGES_CARDS_TYPE,
		example: PAGES_CARDS_TYPE,
	})
	readonly type: typeof PAGES_CARDS_TYPE;

	@ApiPropertyOptional({
		description: 'Page cards',
		type: 'array',
		items: { $ref: '#/components/schemas/PagesCardsPluginCreateCard' },
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsArray({ message: '[{"field":"tiles","reason":"Cards must be a valid array."}]' })
	@ValidateNested({ each: true })
	@Type(() => CreateCardDto)
	cards?: CreateCardDto[];
}
