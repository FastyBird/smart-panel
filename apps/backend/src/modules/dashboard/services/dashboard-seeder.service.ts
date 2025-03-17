import { plainToInstance } from 'class-transformer';
import inquirer from 'inquirer';
import { validate as uuidValidate } from 'uuid';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { getEnvValue } from '../../../common/utils/config.utils';
import { SeedTools, Seeder } from '../../seed/services/seed.service';
import { CreateDataSourceDto } from '../dto/create-data-source.dto';
import { CreatePageDto } from '../dto/create-page.dto';
import { CreateTileDto } from '../dto/create-tile.dto';
import { UpdatePageDto } from '../dto/update-page.dto';
import { DataSourceEntity, PageEntity, TileEntity } from '../entities/dashboard.entity';

import { DataSourcesTypeMapperService } from './data-source-type-mapper.service';
import { DataSourceService } from './data-source.service';
import { PageTypeMapping, PagesTypeMapperService } from './pages-type-mapper.service';
import { PagesService } from './pages.service';
import { TilesTypeMapperService } from './tiles-type-mapper.service';
import { TilesService } from './tiles.service';

@Injectable()
export class DashboardSeederService implements Seeder {
	private readonly logger = new Logger(DashboardSeederService.name);

	constructor(
		private readonly configService: NestConfigService,
		private readonly pagesService: PagesService,
		private readonly tilesService: TilesService,
		private readonly dataSourceService: DataSourceService,
		private readonly pagesMapperService: PagesTypeMapperService,
		private readonly tilesMapperService: TilesTypeMapperService,
		private readonly dataSourcesMapperService: DataSourcesTypeMapperService,
		private readonly seedTools: SeedTools,
	) {}

	async seed(): Promise<void> {
		const { seed } = await inquirer.prompt<{ seed: boolean }>([
			{
				type: 'confirm',
				name: 'seed',
				message: 'Would you like to seed the database with demo data for the Dashboard module?',
				default: true,
			},
		]);

		if (!seed) {
			this.logger.log('[SEED] Skipping Dashboard module.');

			return;
		}

		this.logger.log('[SEED] Seeding dashboard module...');

		const pages = this.seedTools.loadJsonData(
			getEnvValue<string>(this.configService, 'FB_SEED_PAGES_FILE', 'pages.json'),
		);
		const tiles = this.seedTools.loadJsonData(
			getEnvValue<string>(this.configService, 'FB_SEED_TILES_FILE', 'tiles.json'),
		);
		const dataSources = this.seedTools.loadJsonData(
			getEnvValue<string>(this.configService, 'FB_SEED_TILES_DATA_SOURCE_FILE', 'tiles_data_source.json'),
		);

		if (!pages.length) {
			this.logger.warn('[SEED] No pages found in pages.json');
			return;
		}

		for (const page of pages) {
			try {
				await this.createPage(page);
			} catch (error) {
				const err = error as Error;

				this.logger.error(`[SEED] Failed to create page: ${JSON.stringify(page)}`, {
					message: err.message,
					stack: err.stack,
				});
			}
		}

		// Process related entities
		await this.seedTiles(tiles);
		await this.seedDataSources(dataSources);

		this.logger.log(`[SEED] Successfully seeded ${pages.length} pages.`);
	}

	private async createPage(page: Record<string, any>) {
		if (!('type' in page) || typeof page.type !== 'string') {
			this.logger.error('[SEED] Page definition is missing type definition');

			return;
		}

		let mapping: PageTypeMapping<PageEntity, CreatePageDto, UpdatePageDto>;

		try {
			mapping = this.pagesMapperService.getMapping<PageEntity, CreatePageDto, UpdatePageDto>(page.type);
		} catch {
			this.logger.error(`[SEED] Unknown page type: ${page.type}`);

			return;
		}

		const dtoInstance = plainToInstance(mapping.createDto, page, { excludeExtraneousValues: true });

		await this.pagesService.create(dtoInstance);
	}

	private async seedTiles(tiles: Record<string, any>[]): Promise<void> {
		for (const item of tiles) {
			if (!('type' in item) || typeof item.type !== 'string') {
				this.logger.error(`[SEED] Tile definition is missing type definition`);

				continue;
			}

			const pageId: string | undefined = 'page' in item ? (item.page as string) : undefined;

			if (!uuidValidate(pageId)) {
				this.logger.error(`[SEED] Tile relation page is not a valid UUIDv4`);

				continue;
			}

			let mapping: {
				type: string;
				class: new (...args: any[]) => TileEntity;
				createDto: new (...args: any[]) => CreateTileDto;
			};

			try {
				mapping = this.tilesMapperService.getMapping(item.type);
			} catch {
				this.logger.error(`[SEED] Unknown Tile type: ${item.type}`);

				continue;
			}

			const dtoInstance = plainToInstance(mapping.createDto, item, { excludeExtraneousValues: true });

			try {
				await this.tilesService.create(dtoInstance, { pageId });
			} catch (error) {
				const err = error as Error;

				this.logger.error(`[SEED] Failed to create tile: ${JSON.stringify(item)} error=${err.message}`, err.stack);
			}
		}
	}

	private async seedDataSources(dataSources: Record<string, any>[]): Promise<void> {
		for (const item of dataSources) {
			if (!('type' in item) || typeof item.type !== 'string') {
				this.logger.error(`[SEED] Data source definition is missing type definition`);

				continue;
			}

			const tileId: string | undefined = 'tile' in item ? (item.tile as string) : undefined;

			if (!uuidValidate(tileId)) {
				this.logger.error(`[SEED] Data source relation tile is not a valid UUIDv4`);

				continue;
			}

			let mapping: {
				type: string;
				class: new (...args: any[]) => DataSourceEntity;
				createDto: new (...args: any[]) => CreateDataSourceDto;
			};

			try {
				mapping = this.dataSourcesMapperService.getMapping(item.type);
			} catch {
				this.logger.error(`[SEED] Unknown data source type: ${item.type}`);

				continue;
			}

			const dtoInstance = plainToInstance(mapping.createDto, item, { excludeExtraneousValues: true });

			try {
				await this.dataSourceService.create(dtoInstance, { tileId });
			} catch (error) {
				const err = error as Error;

				this.logger.error(
					`[SEED] Failed to create data source: ${JSON.stringify(item)} error=${err.message}`,
					err.stack,
				);
			}
		}
	}
}
