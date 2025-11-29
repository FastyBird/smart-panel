/**
 * OpenAPI extra models for Pages Cards plugin
 */
import { Type } from '@nestjs/common';

import { CardEntity, CardsPageEntity } from './entities/pages-cards.entity';
import { CardsConfigModel } from './models/config.model';
import { CardResponseModel, CardsResponseModel } from './models/pages-cards-response.model';

export const PAGES_CARDS_PLUGIN_SWAGGER_EXTRA_MODELS: Type<any>[] = [
	// Response models
	CardResponseModel,
	CardsResponseModel,
	// Data models
	CardsConfigModel,
	// Entities
	CardsPageEntity,
	CardEntity,
];
