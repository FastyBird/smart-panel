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

import { DashboardException } from '../../../modules/dashboard/dashboard.exceptions';
import { PageEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { PagesService } from '../../../modules/dashboard/services/pages.service';
import { ReqCreateCardDto } from '../dto/create-card.dto';
import { ReqUpdateCardDto } from '../dto/update-card.dto';
import { CardEntity } from '../entities/pages-cards.entity';
import { PAGES_CARDS_PLUGIN_PREFIX } from '../pages-cards.constants';
import { CardsService } from '../services/cards.service';

@Controller('cards')
export class CardsController {
	private readonly logger = new Logger(CardsController.name);

	constructor(
		private readonly pagesService: PagesService,
		private readonly cardsService: CardsService,
	) {}

	@Get()
	async findAll(@Query('page') page?: string): Promise<CardEntity[]> {
		this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Fetching all page cards`);

		const filterPage = page ? await this.getPageOrThrow(page) : undefined;

		const cards = await this.cardsService.findAll(filterPage?.id);

		this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Retrieved ${cards.length} page cards for pageId=${page}`);

		return cards;
	}

	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<CardEntity> {
		this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Fetching page card id=${id}`);

		const card = await this.getOneOrThrow(id);

		this.logger.debug(`[PAGES CARDS][CARDS CONTROLLER] Found page card id=${card.id}`);

		return card;
	}

	@Post()
	@Header('Location', `:baseUrl/${PAGES_CARDS_PLUGIN_PREFIX}/cards/:id`)
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
