/**
 * OpenAPI extra models for Pages Cards plugin
 */
import { CreateCardDto } from './dto/create-card.dto';
import { CreateCardsPageDto } from './dto/create-page.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { CardsUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateCardsPageDto } from './dto/update-page.dto';
import { CardEntity, CardsPageEntity } from './entities/pages-cards.entity';
import { CardsConfigModel } from './models/config.model';
import { CardResponseModel, CardsResponseModel } from './models/pages-cards-response.model';

export const PAGES_CARDS_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// DTOs
	CreateCardDto,
	CreateCardsPageDto,
	UpdateCardDto,
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
