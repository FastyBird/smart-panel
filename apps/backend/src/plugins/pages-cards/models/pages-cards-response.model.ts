import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../common/dto/response.dto';
import { CardEntity } from '../entities/pages-cards.entity';

@ApiSchema({ name: 'PagesCardsPluginResCard' })
export class CardResponseModel extends BaseSuccessResponseModel<CardEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => CardEntity,
	})
	@Expose()
	@Type(() => CardEntity)
	data: CardEntity;
}

@ApiSchema({ name: 'PagesCardsPluginResCards' })
export class CardsResponseModel extends BaseSuccessResponseModel<CardEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(CardEntity) },
	})
	@Expose()
	@Type(() => CardEntity)
	data: CardEntity[];
}
