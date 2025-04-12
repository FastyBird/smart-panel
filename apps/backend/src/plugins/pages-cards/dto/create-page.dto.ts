import { Expose, Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';

import { CreatePageDto } from '../../../modules/dashboard/dto/create-page.dto';
import type { components } from '../../../openapi';

import { CreateCardDto } from './create-card.dto';

type CreateCardsPage = components['schemas']['DashboardCreateCardsPage'];

export class CreateCardsPageDto extends CreatePageDto implements CreateCardsPage {
	readonly type: 'cards';

	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"tiles","reason":"Cards must be a valid array."}]' })
	@ValidateNested({ each: true })
	@Type(() => CreateCardDto)
	cards?: CreateCardDto[];
}
