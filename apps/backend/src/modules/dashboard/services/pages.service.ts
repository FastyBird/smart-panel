import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource as OrmDataSource, Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { WebsocketGateway } from '../../websocket/gateway/websocket.gateway';
import { EventType } from '../dashboard.constants';
import { DashboardException, DashboardNotFoundException, DashboardValidationException } from '../dashboard.exceptions';
import { CreateCardDto } from '../dto/create-card.dto';
import { CreateDataSourceDto } from '../dto/create-data-source.dto';
import { CreatePageDto } from '../dto/create-page.dto';
import { CreateTileDto } from '../dto/create-tile.dto';
import { UpdatePageDto } from '../dto/update-page.dto';
import { CardEntity, DataSourceEntity, PageEntity, TileEntity } from '../entities/dashboard.entity';

import { DataSourcesTypeMapperService } from './data-source-type-mapper.service';
import { PagesTypeMapperService } from './pages-type-mapper.service';
import { TilesTypeMapperService } from './tiles-type-mapper.service';

@Injectable()
export class PagesService {
	private readonly logger = new Logger(PagesService.name);

	constructor(
		@InjectRepository(PageEntity)
		private readonly repository: Repository<PageEntity>,
		private readonly pagesMapperService: PagesTypeMapperService,
		private readonly tilesMapperService: TilesTypeMapperService,
		private readonly dataSourcesMapperService: DataSourcesTypeMapperService,
		private readonly dataSource: OrmDataSource,
		private readonly gateway: WebsocketGateway,
	) {}

	async findAll<TPage extends PageEntity>(): Promise<TPage[]> {
		this.logger.debug('[LOOKUP ALL] Fetching all pages');

		const pages = await this.repository.find({
			relations: [
				'cards',
				'cards.page',
				'cards.tiles',
				'cards.tiles.dataSource',
				'cards.tiles.dataSource.tile',
				'cards.dataSource',
				'cards.dataSource.card',
				'tiles',
				'tiles.page',
				'tiles.dataSource',
				'tiles.dataSource.tile',
				'tiles.device',
				'device',
				'dataSource',
				'dataSource.page',
			],
		});

		this.logger.debug(`[LOOKUP ALL] Found ${pages.length} pages`);

		return pages as TPage[];
	}

	async findOne<TPage extends PageEntity>(id: string): Promise<TPage | null> {
		this.logger.debug(`[LOOKUP] Fetching page with id=${id}`);

		const page = await this.repository.findOne({
			where: { id },
			relations: [
				'cards',
				'cards.page',
				'cards.tiles',
				'cards.tiles.dataSource',
				'cards.tiles.dataSource.tile',
				'cards.dataSource',
				'cards.dataSource.card',
				'tiles',
				'tiles.page',
				'tiles.dataSource',
				'tiles.dataSource.tile',
				'tiles.device',
				'device',
				'dataSource',
				'dataSource.page',
			],
		});

		if (!page) {
			this.logger.warn(`[LOOKUP] Page with id=${id} not found`);

			return null;
		}

		this.logger.debug(`[LOOKUP] Successfully fetched page with id=${id}`);

		return page as TPage;
	}

	async create<TPage extends PageEntity, TCreateDTO extends CreatePageDto>(createDto: CreatePageDto): Promise<TPage> {
		this.logger.debug('[CREATE] Creating new page');

		const { type } = createDto;

		if (!type) {
			this.logger.error('[CREATE] Validation failed: Missing required "type" property in data.');

			throw new DashboardException('The "type" property is required in the data.');
		}

		const mapping = this.pagesMapperService.getMapping<TPage, TCreateDTO, any>(type);

		const dtoInstance = await this.validateDto<TCreateDTO>(mapping.createDto, createDto);

		const repository: Repository<TPage> = this.dataSource.getRepository(mapping.class);

		const page = plainToInstance(mapping.class, dtoInstance, {
			enableImplicitConversion: true,
			excludeExtraneousValues: true,
			exposeUnsetFields: false,
		});

		if ('tiles' in dtoInstance && Array.isArray(dtoInstance.tiles)) {
			page['tiles'] = dtoInstance.tiles.map((createTileDto: CreateTileDto) => {
				const tileMapping = this.tilesMapperService.getMapping(createTileDto.type);

				const tileRepository: Repository<TileEntity> = this.dataSource.getRepository(tileMapping.class);

				const tile = tileRepository.create(
					plainToInstance(
						tileMapping.class,
						{ ...createTileDto, page: page.id },
						{
							enableImplicitConversion: true,
							excludeExtraneousValues: true,
							exposeUnsetFields: false,
						},
					),
				);

				tile.dataSource = (createTileDto.data_source ?? []).map((createDataSourceDto: CreateDataSourceDto) => {
					const dataSourceMapping = this.dataSourcesMapperService.getMapping(createDataSourceDto.type);

					const dataSourceRepository: Repository<DataSourceEntity> = this.dataSource.getRepository(
						dataSourceMapping.class,
					);

					return dataSourceRepository.create(
						plainToInstance(
							dataSourceMapping.class,
							{ ...createDataSourceDto, tile: tile.id },
							{
								enableImplicitConversion: true,
								excludeExtraneousValues: true,
								exposeUnsetFields: false,
							},
						),
					);
				});

				return tile;
			});
		}

		if ('data_source' in dtoInstance && Array.isArray(dtoInstance.data_source)) {
			page['dataSource'] = dtoInstance.data_source.map((createDataSourceDto: CreateDataSourceDto) => {
				const dataSourceMapping = this.dataSourcesMapperService.getMapping(createDataSourceDto.type);

				const dataSourceRepository: Repository<DataSourceEntity> = this.dataSource.getRepository(
					dataSourceMapping.class,
				);

				return dataSourceRepository.create(
					plainToInstance(
						dataSourceMapping.class,
						{ ...createDataSourceDto, tile: page.id },
						{
							enableImplicitConversion: true,
							excludeExtraneousValues: true,
							exposeUnsetFields: false,
						},
					),
				);
			});
		}

		if ('cards' in dtoInstance && Array.isArray(dtoInstance.cards)) {
			page['cards'] = dtoInstance.cards.map((createCardDto: CreateCardDto) => {
				const cardRepository: Repository<CardEntity> = this.dataSource.getRepository(CardEntity);

				return cardRepository.create(
					plainToInstance(
						CardEntity,
						{ ...createCardDto, tile: page.id },
						{
							enableImplicitConversion: true,
							excludeExtraneousValues: true,
							exposeUnsetFields: false,
						},
					),
				);
			});
		}

		const created = repository.create(page);

		// Save the page
		await repository.save(created);

		// Retrieve the saved page with its full relations
		const savedPage = await this.getOneOrThrow<TPage>(created.id);

		this.logger.debug(`[CREATE] Successfully created page with id=${savedPage.id}`);

		this.gateway.sendMessage(EventType.PAGE_CREATED, savedPage);

		return savedPage;
	}

	async update<TPage extends PageEntity, TUpdateDTO extends UpdatePageDto>(
		id: string,
		updateDto: UpdatePageDto,
	): Promise<TPage> {
		this.logger.debug(`[UPDATE] Updating page with id=${id}`);

		const page = await this.getOneOrThrow<TPage>(id);

		const mapping = this.pagesMapperService.getMapping<TPage, any, TUpdateDTO>(page.type);

		const dtoInstance = await this.validateDto<TUpdateDTO>(mapping.updateDto, updateDto);

		const repository: Repository<TPage> = this.dataSource.getRepository(mapping.class);

		Object.assign(
			page,
			omitBy(
				plainToInstance(mapping.class, dtoInstance, {
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeDefaultValues: false,
				}),
				isUndefined,
			),
		);

		await repository.save(page);

		const updatedPage = await this.getOneOrThrow<TPage>(page.id);

		this.logger.debug(`[UPDATE] Successfully updated page with id=${updatedPage.id}`);

		this.gateway.sendMessage(EventType.PAGE_UPDATED, updatedPage);

		return updatedPage;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing page with id=${id}`);

		const page = await this.getOneOrThrow<PageEntity>(id);

		await this.repository.remove(page);

		this.logger.log(`[DELETE] Successfully removed page with id=${id}`);

		this.gateway.sendMessage(EventType.PAGE_DELETED, page);
	}

	async getOneOrThrow<TPage extends PageEntity>(id: string): Promise<TPage> {
		const page = await this.findOne<TPage>(id);

		if (!page) {
			this.logger.error(`[ERROR] Page with id=${id} not found`);

			throw new DashboardNotFoundException('Requested page does not exist');
		}

		return page;
	}

	private async validateDto<T extends object>(DtoClass: new () => T, dto: any): Promise<T> {
		const dtoInstance = plainToInstance(DtoClass, dto, {
			enableImplicitConversion: true,
			excludeExtraneousValues: true,
			exposeUnsetFields: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] ${JSON.stringify(errors)}`);

			throw new DashboardValidationException('Provided page data are invalid.');
		}

		return dtoInstance;
	}
}
