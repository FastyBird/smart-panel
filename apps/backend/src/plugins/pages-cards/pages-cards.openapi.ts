/**
 * OpenAPI extra models for Pages Cards plugin
 */
import { CardEntity, CardsPageEntity } from './entities/pages-cards.entity';
import { CardsConfigModel } from './models/config.model';
import { CardResponseModel, CardsResponseModel } from './models/pages-cards-response.model';

export const PAGES_CARDS_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// Response models
	CardResponseModel,
	CardsResponseModel,
	// Data models
	CardsConfigModel,
	// Entities
	CardsPageEntity,
	CardEntity,
];
