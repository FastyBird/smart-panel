import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
	BadRequestException,
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

import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import { DASHBOARD_MODULE_PREFIX } from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import { ReqCreateCardTileDto } from '../dto/create-card-tile.dto';
import { CreateTileDto } from '../dto/create-tile.dto';
import { ReqUpdateTileDto, UpdateTileDto } from '../dto/update-tile.dto';
import { CardEntity, PageEntity, TileEntity } from '../entities/dashboard.entity';
import { CardsService } from '../services/cards.service';
import { PagesService } from '../services/pages.service';
import { TileTypeMapping, TilesTypeMapperService } from '../services/tiles-type-mapper.service';
import { TilesService } from '../services/tiles.service';

@Controller('pages/:pageId/cards/:cardId')
export class PagesCardsTilesController {
	private readonly logger = new Logger(PagesCardsTilesController.name);

	constructor(
		private readonly pagesService: PagesService,
		private readonly cardsService: CardsService,
		private readonly tilesService: TilesService,
		private readonly tilesMapperService: TilesTypeMapperService,
	) {}

	@Get()
	async findAll(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('cardId', new ParseUUIDPipe({ version: '4' })) cardId: string,
	): Promise<TileEntity[]> {
		this.logger.debug(`[LOOKUP ALL] Fetching all card tiles for cardId=${cardId}`);

		const page = await this.getPageOrThrow(pageId);
		const card = await this.getCardOrThrow(cardId, page.id);

		const tiles = await this.tilesService.findAll({ cardId: card.id });

		this.logger.debug(`[LOOKUP ALL] Retrieved ${tiles.length} card tiles for cardId=${card.id}`);

		return tiles;
	}

	@Get(':id')
	async findOne(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('cardId', new ParseUUIDPipe({ version: '4' })) cardId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<TileEntity> {
		this.logger.debug(`[LOOKUP] Fetching card tile id=${id} for cardId=${cardId}`);

		const page = await this.getPageOrThrow(pageId);
		const card = await this.getCardOrThrow(cardId, page.id);

		const tile = await this.getOneOrThrow(id, card.id);

		this.logger.debug(`[LOOKUP] Found card tile id=${tile.id} for cardId=${card.id}`);

		return tile;
	}

	@Post()
	@Header('Location', `:baseUrl/${DASHBOARD_MODULE_PREFIX}/pages/:page/cards/:card/tiles/:id`)
	async create(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('cardId', new ParseUUIDPipe({ version: '4' })) cardId: string,
		@Body() createDto: ReqCreateCardTileDto,
	): Promise<TileEntity> {
		this.logger.debug(`[CREATE] Incoming request to create a new card tile for cardId=${cardId}`);

		const page = await this.getPageOrThrow(pageId);
		const card = await this.getCardOrThrow(cardId, page.id);

		const type: string | undefined = createDto.data.type;

		if (!type) {
			this.logger.error('[VALIDATION] Missing required field: type');

			throw new BadRequestException([
				JSON.stringify({ field: 'type', reason: 'Card tile property type is required.' }),
			]);
		}

		let mapping: TileTypeMapping<TileEntity, CreateTileDto, UpdateTileDto>;

		try {
			mapping = this.tilesMapperService.getMapping<TileEntity, CreateTileDto, UpdateTileDto>(type);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported card tile type: ${type}`, { message: err.message, stack: err.stack });

			if (error instanceof DashboardException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported card tile type: ${type}` }),
				]);
			}

			throw error;
		}

		const dtoInstance = plainToInstance(mapping.createDto, createDto.data, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for card tile creation error=${JSON.stringify(errors)}`);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const tile = await this.tilesService.create(createDto.data, { cardId: card.id });

			this.logger.debug(`[CREATE] Successfully created card tile id=${tile.id} for cardId=${card.id}`);

			return tile;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Card tile could not be created. Please try again later');
			}

			throw error;
		}
	}

	@Patch(':id')
	async update(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('cardId', new ParseUUIDPipe({ version: '4' })) cardId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: ReqUpdateTileDto,
	): Promise<TileEntity> {
		this.logger.debug(`[UPDATE] Incoming update request for card tile id=${id} for cardId=${cardId}`);

		const page = await this.getPageOrThrow(pageId);
		const card = await this.getCardOrThrow(cardId, page.id);
		const tile = await this.getOneOrThrow(id, card.id);

		let mapping: TileTypeMapping<TileEntity, CreateTileDto, UpdateTileDto>;

		try {
			mapping = this.tilesMapperService.getMapping<TileEntity, CreateTileDto, UpdateTileDto>(tile.type);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported card tile type for update: ${tile.type}`, {
				message: err.message,
				stack: err.stack,
			});

			if (error instanceof DashboardException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported card tile type: ${tile.type}` }),
				]);
			}

			throw error;
		}

		const dtoInstance = plainToInstance(mapping.updateDto, updateDto.data, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		if (errors.length > 0) {
			this.logger.error(
				`[VALIDATION FAILED] Validation failed for card tile modification error=${JSON.stringify(errors)}`,
			);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const updatedTile = await this.tilesService.update(tile.id, updateDto.data);

			this.logger.debug(`[UPDATE] Successfully updated card tile id=${updatedTile.id} for cardId=${card.id}`);

			return updatedTile;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Card tile could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@Delete(':id')
	async remove(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('cardId', new ParseUUIDPipe({ version: '4' })) cardId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete card tile id=${id} for cardId=${cardId}`);

		const page = await this.getPageOrThrow(pageId);
		const card = await this.getCardOrThrow(cardId, page.id);
		const tile = await this.getOneOrThrow(id, card.id);

		await this.tilesService.remove(tile.id);

		this.logger.debug(`[DELETE] Successfully deleted card tile id=${id} for cardId=${card.id}`);
	}

	private async getOneOrThrow(id: string, cardId: string): Promise<TileEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of card tile id=${id} for cardId=${cardId}`);

		const tile = await this.tilesService.findOne(id, { cardId });

		if (!tile) {
			this.logger.error(`[ERROR] Card tile with id=${id} for cardId=${cardId} not found`);

			throw new NotFoundException('Requested card tile does not exist');
		}

		return tile;
	}

	private async getCardOrThrow(cardId: string, pageId: string): Promise<CardEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of page card id=${cardId} for pageId=${pageId}`);

		const card = await this.cardsService.findOne(cardId, pageId);

		if (!card) {
			this.logger.error(`[ERROR] Page card with id=${pageId} for pageId=${pageId} not found`);

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
