import { Expose, Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { CreatePageDto } from '../../../modules/dashboard/dto/create-page.dto';
import { PAGES_CARDS_TYPE } from '../pages-cards.constants';

import { CreateCardDto } from './create-card.dto';

@ApiSchema({ name: 'PagesCardsPluginCreateCardsPage' })
export class CreateCardsPageDto extends CreatePageDto {
	readonly type: typeof PAGES_CARDS_TYPE;

	@ApiPropertyOptional({
		description: 'Page cards',
		type: [CreateCardDto],
		isArray: true,
	})
	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"tiles","reason":"Cards must be a valid array."}]' })
	@ValidateNested({ each: true })
	@Type(() => CreateCardDto)
	cards?: CreateCardDto[];
}
