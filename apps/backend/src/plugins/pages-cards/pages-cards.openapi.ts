/**
 * OpenAPI extra models for Pages Cards plugin
 */
import { CreateCardsPageDto } from './dto/create-page.dto';
import { CardsUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateCardsPageDto } from './dto/update-page.dto';
import { CardEntity, CardsPageEntity } from './entities/pages-cards.entity';
import { CardsConfigModel } from './models/config.model';
import { CardResponseModel, CardsResponseModel } from './models/pages-cards-response.model';

export const PAGES_CARDS_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// DTOs
	CreateCardsPageDto,
	UpdateCardsPageDto,
	CardsUpdatePluginConfigDto,
	// Response models
	CardResponseModel,
	CardsResponseModel,
	// Data models
	CardsConfigModel,
	// Entities
	CardsPageEntity,
	CardEntity,
];
