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
	UnprocessableEntityException,
} from '@nestjs/common';

import { DashboardModulePrefix } from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import { CreateCardDto } from '../dto/create-card.dto';
import { UpdateCardDto } from '../dto/update-card.dto';
import { CardEntity, PageEntity } from '../entities/dashboard.entity';
import { CardsService } from '../services/cards.service';
import { PagesService } from '../services/pages.service';

@Controller('pages/:pageId/cards')
export class PagesCardsController {
	private readonly logger = new Logger(PagesCardsController.name);

	constructor(
		private readonly pagesService: PagesService,
		private readonly cardsService: CardsService,
	) {}

	@Get()
	async findAll(@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string): Promise<CardEntity[]> {
		this.logger.debug(`[LOOKUP ALL] Fetching all page cards for pageId=${pageId}`);

		const page = await this.getPageOrThrow(pageId);

		const cards = await this.cardsService.findAll(page.id);

		this.logger.debug(`[LOOKUP ALL] Retrieved ${cards.length} page cards for pageId=${page.id}`);

		return cards;
	}

	@Get(':id')
	async findOne(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<CardEntity> {
		this.logger.debug(`[LOOKUP] Fetching page card id=${id} for pageId=${pageId}`);

		const page = await this.getPageOrThrow(pageId);

		const card = await this.getOneOrThrow(id, page.id);

		this.logger.debug(`[LOOKUP] Found page card id=${card.id} for pageId=${page.id}`);

		return card;
	}

	@Post()
	@Header('Location', `:baseUrl/${DashboardModulePrefix}/pages/:page/cards/:id`)
	async create(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Body() createCardDto: CreateCardDto,
	): Promise<CardEntity> {
		this.logger.debug(`[CREATE] Incoming request to create a new page card for pageId=${pageId}`);

		const page = await this.getPageOrThrow(pageId);

		try {
			const card = await this.cardsService.create(page.id, createCardDto);

			this.logger.debug(`[CREATE] Successfully created page card id=${card.id} for pageId=${page.id}`);

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
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateCardDto: UpdateCardDto,
	): Promise<CardEntity> {
		this.logger.debug(`[UPDATE] Incoming update request for page card id=${id} for pageId=${pageId}`);

		const page = await this.getPageOrThrow(pageId);
		const card = await this.getOneOrThrow(id, page.id);

		try {
			const updatedCard = await this.cardsService.update(card.id, page.id, updateCardDto);

			this.logger.debug(`[UPDATE] Successfully updated page card id=${updatedCard.id} for pageId=${page.id}`);

			return updatedCard;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Page Card could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@Delete(':id')
	async remove(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete page card id=${id} for pageId=${pageId}`);

		const page = await this.getPageOrThrow(pageId);
		const card = await this.getOneOrThrow(id, page.id);

		await this.cardsService.remove(card.id, page.id);

		this.logger.debug(`[DELETE] Successfully deleted page card id=${id} for pageId=${page.id}`);
	}

	private async getOneOrThrow(id: string, pageId: string): Promise<CardEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of page card id=${id} for pageId=${pageId}`);

		const card = await this.cardsService.findOne(id, pageId);

		if (!card) {
			this.logger.error(`[ERROR] Page card with id=${id} for pageId=${pageId} not found`);

			throw new NotFoundException('Requested page card does not exist');
		}

		return card;
	}

	private async getPageOrThrow(pageId: string): Promise<PageEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of page id=${pageId}`);

		const page = await this.pagesService.findOne(pageId);

		if (!page) {
			this.logger.error(`[ERROR] Page with id=${pageId} not found`);

			throw new NotFoundException('Requested page does not exist');
		}

		return page;
	}
}
