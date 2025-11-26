import {
	Body,
	Controller,
	Delete,
	Get,
	Header,
	Logger,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Query,
	UnprocessableEntityException,
} from '@nestjs/common';
import {
	ApiBody,
	ApiCreatedResponse,
	ApiExtraModels,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiResponse,
	ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { ApiTag } from '../../../common/decorators/api-tag.decorator';
import { DashboardException } from '../../../modules/dashboard/dashboard.exceptions';
import { PageEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { PagesService } from '../../../modules/dashboard/services/pages.service';
import { CreateCardDto, CreateSingleCardDto, ReqCreateCardDto } from '../dto/create-card.dto';
import { ReqUpdateCardDto, UpdateCardDto } from '../dto/update-card.dto';
import { CardEntity, CardsPageEntity } from '../entities/pages-cards.entity';
import { CardResponseModel, CardsResponseModel } from '../models/pages-cards-response.model';
import {
	PAGES_CARDS_PLUGIN_API_TAG_DESCRIPTION,
	PAGES_CARDS_PLUGIN_API_TAG_NAME,
	PAGES_CARDS_PLUGIN_NAME,
	PAGES_CARDS_PLUGIN_PREFIX,
} from '../pages-cards.constants';
import { CardsService } from '../services/cards.service';

@ApiTag({
	tagName: PAGES_CARDS_PLUGIN_NAME,
	displayName: PAGES_CARDS_PLUGIN_API_TAG_NAME,
	description: PAGES_CARDS_PLUGIN_API_TAG_DESCRIPTION,
})
@ApiExtraModels(
	CreateCardDto,
	CreateSingleCardDto,
	ReqCreateCardDto,
	UpdateCardDto,
	ReqUpdateCardDto,
	CardEntity,
	CardsPageEntity,
	CardResponseModel,
	CardsResponseModel,
)
@Controller('cards')
export class CardsController {
	private readonly logger = new Logger(CardsController.name);

	constructor(
		private readonly pagesService: PagesService,
		private readonly cardsService: CardsService,
	) {}

	@Get()
	@ApiOperation({ summary: 'Get all cards', description: 'Retrieve all cards, optionally filtered by page' })
	@ApiQuery({ name: 'page', required: false, type: 'string', description: 'Filter cards by page ID' })
	@ApiOkResponse({ description: 'Cards retrieved successfully', type: [CardEntity] })
	async findAll(@Query('page') page?: string): Promise<CardEntity[]> {
		this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Fetching all page cards`);

		const filterPage = page ? await this.getPageOrThrow(page) : undefined;

		const cards = await this.cardsService.findAll(filterPage?.id);

		this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Retrieved ${cards.length} page cards for pageId=${page}`);

		return cards;
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get card by ID', description: 'Retrieve a single card by its unique identifier' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Card unique identifier' })
	@ApiOkResponse({ description: 'Card retrieved successfully', type: CardEntity })
	@ApiNotFoundResponse({ description: 'Card not found' })
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<CardEntity> {
		this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Fetching page card id=${id}`);

		const card = await this.getOneOrThrow(id);

		this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Found page card id=${card.id}`);

		return card;
	}

	@Post()
	@Header('Location', `:baseUrl/${PAGES_CARDS_PLUGIN_PREFIX}/cards/:id`)
	@ApiOperation({ summary: 'Create card', description: 'Create a new card' })
	@ApiBody({ type: ReqCreateCardDto })
	@ApiCreatedResponse({ description: 'Card created successfully', type: CardEntity })
	@ApiUnprocessableEntityResponse({ description: 'Card could not be created' })
	async create(@Body() createDto: ReqCreateCardDto): Promise<CardEntity> {
		this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Incoming request to create a new page card`);

		try {
			const card = await this.cardsService.create(createDto.data);

			this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Successfully created page card id=${card.id}`);

			return card;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Page card could not be created. Please try again later');
			}

			throw error;
		}
	}

	@Patch(':id')
	@ApiOperation({ summary: 'Update card', description: 'Update an existing card by ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Card unique identifier' })
	@ApiBody({ type: ReqUpdateCardDto })
	@ApiOkResponse({ description: 'Card updated successfully', type: CardEntity })
	@ApiNotFoundResponse({ description: 'Card not found' })
	@ApiUnprocessableEntityResponse({ description: 'Card could not be updated' })
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: ReqUpdateCardDto,
	): Promise<CardEntity> {
		this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Incoming update request for page card id=${id}`);

		const card = await this.getOneOrThrow(id);

		try {
			const updatedCard = await this.cardsService.update(card.id, updateDto.data);

			this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Successfully updated page card id=${updatedCard.id}`);

			return updatedCard;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Page Card could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@Delete(':id')
	@ApiOperation({ summary: 'Delete card', description: 'Delete a card by ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Card unique identifier' })
	@ApiResponse({ status: 204, description: 'Card deleted successfully' })
	@ApiNotFoundResponse({ description: 'Card not found' })
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Incoming request to delete page card id=${id}`);

		const card = await this.getOneOrThrow(id);

		await this.cardsService.remove(card.id);

		this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Successfully deleted page card id=${id}`);
	}

	private async getOneOrThrow(id: string): Promise<CardEntity> {
		this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Checking existence of page card id=${id}`);

		const card = await this.cardsService.findOne(id);

		if (!card) {
			this.logger.error(`[PAGES CARDS][CARDS CONTROLLER] Page card with id=${id} not found`);

			throw new NotFoundException('Requested page card does not exist');
		}

		return card;
	}

	private async getPageOrThrow(pageId: string): Promise<PageEntity> {
		this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Checking existence of page id=${pageId}`);

		const page = await this.pagesService.findOne(pageId);

		if (!page) {
			this.logger.error(`[PAGES CARDS][CARDS CONTROLLER] Page with id=${pageId} not found`);

			throw new NotFoundException('Requested page does not exist');
		}

		return page;
	}
}
