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
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { DashboardException } from '../../../modules/dashboard/dashboard.exceptions';
import { PageEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { PagesService } from '../../../modules/dashboard/services/pages.service';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { ReqCreateCardDto } from '../dto/create-card.dto';
import { ReqUpdateCardDto } from '../dto/update-card.dto';
import { CardEntity } from '../entities/pages-cards.entity';
import { CardResponseModel, CardsResponseModel } from '../models/pages-cards-response.model';
import { PAGES_CARDS_PLUGIN_API_TAG_NAME, PAGES_CARDS_PLUGIN_PREFIX } from '../pages-cards.constants';
import { CardsService } from '../services/cards.service';

@ApiTags(PAGES_CARDS_PLUGIN_API_TAG_NAME)
@Controller('cards')
export class CardsController {
	private readonly logger = new Logger(CardsController.name);

	constructor(
		private readonly pagesService: PagesService,
		private readonly cardsService: CardsService,
	) {}

	@ApiOperation({
		tags: [PAGES_CARDS_PLUGIN_API_TAG_NAME],
		summary: 'Get all cards',
		description: 'Retrieve all cards, optionally filtered by page',
		operationId: 'get-pages-cards-plugin-page-cards',
	})
	@ApiQuery({ name: 'page', required: false, type: 'string', format: 'uuid', description: 'Filter cards by page ID' })
	@ApiSuccessResponse(
		CardsResponseModel,
		'Cards retrieved successfully. The response includes a list of cards, optionally filtered by page ID.',
	)
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(@Query('page') page?: string): Promise<CardsResponseModel> {
		this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Fetching all page cards`);

		const filterPage = page ? await this.getPageOrThrow(page) : undefined;

		const cards = await this.cardsService.findAll(filterPage?.id);

		this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Retrieved ${cards.length} page cards for pageId=${page}`);

		const response = new CardsResponseModel();
		response.data = cards;

		return response;
	}

	@ApiOperation({
		tags: [PAGES_CARDS_PLUGIN_API_TAG_NAME],
		summary: 'Get card by ID',
		description: 'Retrieve a single card by its unique identifier',
		operationId: 'get-pages-cards-plugin-page-card',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Card unique identifier' })
	@ApiSuccessResponse(
		CardResponseModel,
		'Card retrieved successfully. The response includes the complete card details with associated tiles and data sources.',
	)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Card not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<CardResponseModel> {
		this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Fetching page card id=${id}`);

		const card = await this.getOneOrThrow(id);

		this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Found page card id=${card.id}`);

		const response = new CardResponseModel();
		response.data = card;

		return response;
	}

	@Header('Location', `:baseUrl/${PAGES_CARDS_PLUGIN_PREFIX}/cards/:id`)
	@ApiOperation({
		tags: [PAGES_CARDS_PLUGIN_API_TAG_NAME],
		summary: 'Create card',
		description: 'Create a new card with optional tiles and data sources',
		operationId: 'create-pages-cards-plugin-page-card',
	})
	@ApiBody({ type: ReqCreateCardDto, description: 'The data required to create a new card' })
	@ApiCreatedSuccessResponse(
		CardResponseModel,
		'Card created successfully. The response includes the complete details of the newly created card with associated tiles and data sources.',
	)
	@ApiBadRequestResponse('Invalid request data')
	@ApiUnprocessableEntityResponse('Card could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	async create(@Body() createDto: ReqCreateCardDto): Promise<CardResponseModel> {
		this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Incoming request to create a new page card`);

		try {
			const card = await this.cardsService.create(createDto.data);

			this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Successfully created page card id=${card.id}`);

			const response = new CardResponseModel();
			response.data = card;

			return response;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Page card could not be created. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [PAGES_CARDS_PLUGIN_API_TAG_NAME],
		summary: 'Update card',
		description: 'Update an existing card by ID',
		operationId: 'update-pages-cards-plugin-page-card',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Card unique identifier' })
	@ApiBody({ type: ReqUpdateCardDto, description: 'The data to update the card with' })
	@ApiSuccessResponse(
		CardResponseModel,
		'Card updated successfully. The response includes the complete details of the updated card.',
	)
	@ApiBadRequestResponse('Invalid request data or UUID format')
	@ApiNotFoundResponse('Card not found')
	@ApiUnprocessableEntityResponse('Card could not be updated')
	@ApiInternalServerErrorResponse('Internal server error')
	@Patch(':id')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: ReqUpdateCardDto,
	): Promise<CardResponseModel> {
		this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Incoming update request for page card id=${id}`);

		const card = await this.getOneOrThrow(id);

		try {
			const updatedCard = await this.cardsService.update(card.id, updateDto.data);

			this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Successfully updated page card id=${updatedCard.id}`);

			const response = new CardResponseModel();
			response.data = updatedCard;

			return response;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Page Card could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [PAGES_CARDS_PLUGIN_API_TAG_NAME],
		summary: 'Delete card',
		description: 'Delete a card by ID',
		operationId: 'delete-pages-cards-plugin-page-card',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Card unique identifier' })
	@ApiNoContentResponse({ description: 'Card deleted successfully' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Card not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Delete(':id')
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
