import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import get from 'lodash.get';

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
import { DashboardModulePrefix } from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import { CreateDataSourceDto } from '../dto/create-data-source.dto';
import { UpdateDataSourceDto } from '../dto/update-data-source.dto';
import { CardEntity, DataSourceEntity, PageEntity } from '../entities/dashboard.entity';
import { CardsService } from '../services/cards.service';
import { DataSourceTypeMapping, DataSourcesTypeMapperService } from '../services/data-source-type-mapper.service';
import { DataSourceService } from '../services/data-source.service';
import { PagesService } from '../services/pages.service';

@Controller('pages/:pageId/cards/:cardId/data-source')
export class PagesCardsDataSourceController {
	private readonly logger = new Logger(PagesCardsDataSourceController.name);

	constructor(
		private readonly pagesService: PagesService,
		private readonly cardsService: CardsService,
		private readonly dataSourceService: DataSourceService,
		private readonly dataSourcesMapperService: DataSourcesTypeMapperService,
	) {}

	@Get()
	async findAll(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('cardId', new ParseUUIDPipe({ version: '4' })) cardId: string,
	): Promise<DataSourceEntity[]> {
		this.logger.debug(`[LOOKUP ALL] Fetching all card data sources for pageId=${pageId} cardId=${cardId}`);

		const page = await this.getPageOrThrow(pageId);
		const card = await this.getCardOrThrow(cardId, page.id);

		const dataSources = await this.dataSourceService.findAll({ cardId: card.id });

		this.logger.debug(
			`[LOOKUP ALL] Retrieved ${dataSources.length} card data sources for pageId=${page.id} cardId=${card.id}`,
		);

		return dataSources;
	}

	@Get(':id')
	async findOne(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('cardId', new ParseUUIDPipe({ version: '4' })) cardId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<DataSourceEntity> {
		this.logger.debug(`[LOOKUP] Fetching card data source id=${id} for pageId=${pageId} cardId=${cardId}`);

		const page = await this.getPageOrThrow(pageId);
		const card = await this.getCardOrThrow(cardId, page.id);

		const dataSource = await this.getOneOrThrow(id, card.id, page.id);

		this.logger.debug(`[LOOKUP] Found card data source id=${dataSource.id} for pageId=${page.id} cardId=${card.id}`);

		return dataSource;
	}

	@Post()
	@Header('Location', `:baseUrl/${DashboardModulePrefix}/pages/:page/cards/:card/data-source/:id`)
	async create(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('cardId', new ParseUUIDPipe({ version: '4' })) cardId: string,
		@Body() createDataSourceDto: any,
	): Promise<DataSourceEntity> {
		this.logger.debug(
			`[CREATE] Incoming request to create a new card data source for pageId=${pageId} cardId=${cardId}`,
		);

		const page = await this.getPageOrThrow(pageId);
		const card = await this.getCardOrThrow(cardId, page.id);

		const type: string | undefined = get(createDataSourceDto, 'type', undefined) as string | undefined;

		if (!type) {
			this.logger.error('[VALIDATION] Missing required field: type');

			throw new BadRequestException([
				JSON.stringify({ field: 'type', reason: 'Card data source property type is required.' }),
			]);
		}

		let mapping: DataSourceTypeMapping<DataSourceEntity, CreateDataSourceDto, UpdateDataSourceDto>;

		try {
			mapping = this.dataSourcesMapperService.getMapping<DataSourceEntity, CreateDataSourceDto, UpdateDataSourceDto>(
				type,
			);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported card data source type: ${type}`, {
				message: err.message,
				stack: err.stack,
			});

			if (error instanceof DashboardException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported card data source type: ${type}` }),
				]);
			}

			throw error;
		}

		const dtoInstance = plainToInstance(mapping.createDto, createDataSourceDto, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		if (errors.length > 0) {
			this.logger.error(
				`[VALIDATION FAILED] Validation failed for card data source creation error=${JSON.stringify(errors)}`,
			);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const dataSource = await this.dataSourceService.create(createDataSourceDto as CreateDataSourceDto, {
				cardId: card.id,
			});

			this.logger.debug(
				`[CREATE] Successfully created card data source id=${dataSource.id} for pageId=${page.id} cardId=${card.id}`,
			);

			return dataSource;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Card data source could not be created. Please try again later');
			}

			throw error;
		}
	}

	@Patch(':id')
	async update(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('cardId', new ParseUUIDPipe({ version: '4' })) cardId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDataSourceDto: any,
	): Promise<DataSourceEntity> {
		this.logger.debug(
			`[UPDATE] Incoming update request for card data source id=${id} for pageId=${pageId} cardId=${cardId}`,
		);

		const page = await this.getPageOrThrow(pageId);
		const card = await this.getCardOrThrow(cardId, page.id);
		const dataSource = await this.getOneOrThrow(id, card.id, page.id);

		let mapping: DataSourceTypeMapping<DataSourceEntity, CreateDataSourceDto, UpdateDataSourceDto>;

		try {
			mapping = this.dataSourcesMapperService.getMapping<DataSourceEntity, CreateDataSourceDto, UpdateDataSourceDto>(
				dataSource.type,
			);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[ERROR] Unsupported card data source type for update: ${dataSource.type} error=${err.message}`,
				err.stack,
			);

			if (error instanceof DashboardException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported card data source type: ${dataSource.type}` }),
				]);
			}

			throw error;
		}

		const dtoInstance = plainToInstance(mapping.updateDto, updateDataSourceDto, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		if (errors.length > 0) {
			this.logger.error(
				`[VALIDATION FAILED] Validation failed for card data source modification error=${JSON.stringify(errors)}`,
			);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const updatedDataSource = await this.dataSourceService.update(
				dataSource.id,
				updateDataSourceDto as UpdateDataSourceDto,
			);

			this.logger.debug(
				`[UPDATE] Successfully updated card data source id=${updatedDataSource.id} for pageId=${page.id} cardId=${card.id}`,
			);

			return updatedDataSource;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Card data source could not be updated. Please try again later');
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
		this.logger.debug(
			`[DELETE] Incoming request to delete card data source id=${id} for pageId=${pageId} cardId=${cardId}`,
		);

		const page = await this.getPageOrThrow(pageId);
		const card = await this.getCardOrThrow(cardId, page.id);
		const dataSource = await this.getOneOrThrow(id, card.id, page.id);

		await this.dataSourceService.remove(dataSource.id);

		this.logger.debug(
			`[DELETE] Successfully deleted card data source id=${id} for pageId=${page.id} cardId=${card.id}`,
		);
	}

	private async getOneOrThrow(id: string, cardId: string, pageId: string): Promise<DataSourceEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of card data source id=${id} for pageId=${pageId} cardId=${cardId}`);

		const dataSource = await this.dataSourceService.findOne(id, { cardId });

		if (!dataSource) {
			this.logger.error(`[ERROR] Card data source with id=${id} for pageId=${pageId} cardId=${cardId} not found`);

			throw new NotFoundException('Requested card data source does not exist');
		}

		return dataSource;
	}

	private async getCardOrThrow(cardId: string, pageId: string): Promise<CardEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of page card id=${cardId} for pageId=${pageId}`);

		const card = await this.cardsService.findOne(cardId, pageId);

		if (!card) {
			this.logger.error(`[ERROR] Page card with id=${cardId} for pageId=${pageId} not found`);

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
