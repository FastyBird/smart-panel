import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { CardEntity } from '../entities/pages-cards.entity';

@ApiSchema({ name: 'PagesCardsPluginResCard' })
export class CardResponseModel extends BaseSuccessResponseModel<CardEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => CardEntity,
	})
	@Expose()
	declare data: CardEntity;
}

@ApiSchema({ name: 'PagesCardsPluginResCards' })
export class CardsResponseModel extends BaseSuccessResponseModel<CardEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(CardEntity) },
	})
	@Expose()
	declare data: CardEntity[];
}
